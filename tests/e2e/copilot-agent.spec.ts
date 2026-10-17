import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Agentic Copilot — tool-calling loop, inline approval UX, and result cards.
 *
 * Hermetic: the AI bridge is never called. We intercept `/api/ai/copilot`
 * (the Next.js orchestrator) and replay a scripted SSE stream:
 *
 *   planner  → tool_call (confirmationRequired + proposalId) → done
 *   approve  → proposalId-only request → tool_call → tool_result → done
 *
 * This exercises the full client path — streaming parser, approval card,
 * Approve/Deny interactions, the server-side proposal-ID resend, and the
 * inline result cards with live status badges — with zero external dependencies.
 */

const COPILOT_PATH = "/copilot";
const COPILOT_ENDPOINT = "**/api/ai/copilot";

const APPROVAL_PROPOSAL_ID = "00000000-0000-4000-8000-00000000ab01";
const DENIAL_PROPOSAL_ID = "00000000-0000-4000-8000-00000000ab02";

const approvalStream = (
  tool: string,
  args: Record<string, unknown>,
  proposalId = APPROVAL_PROPOSAL_ID,
) => [
  {
    type: "tool_call",
    call: {
      name: tool,
      arguments: args,
      confirmationRequired: true,
      description: "Creates a pending expense claim.",
      proposalId,
    },
  },
  { type: "done", result: { text: "", actions: [], requiresConfirmation: true } },
];

const executionStream = (tool: string, data: Record<string, unknown>, finalText: string) => [
  { type: "tool_call", call: { name: tool, arguments: {}, confirmationRequired: false, status: "executing" } },
  { type: "tool_result", result: { tool, ok: true, message: "Tool completed.", data } },
  { type: "delta", content: finalText },
  { type: "done", result: { text: finalText, actions: [] } },
];

function sse(events: Array<Record<string, unknown>>): string {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
}

async function routeCopilot(page: Page, handler: (route: Route, body: unknown) => Promise<void>) {
  await page.route(COPILOT_ENDPOINT, async (route) => {
    const body = (await route.request().postDataJSON()) as Record<string, unknown>;
    await handler(route, body);
  });
}

async function askCopilot(page: Page, message: string) {
  await page.goto(COPILOT_PATH);
  await page.getByLabel("Copilot message").fill(message);
  await page.getByLabel("Send message").click();
}

test.describe("Agentic Copilot tool loop", () => {
  test("write tool renders an approval card; Approve executes it and shows the result card", async ({ page }) => {
    const requests: unknown[] = [];
    await routeCopilot(page, async (route, body) => {
      requests.push(body);
      if (body.approveProposal) {
        // Approval sends only the server-side proposal ID, never client-supplied
        // write arguments. The route returns the execution stream for that ID.
        expect(body.approveProposal).toBe(APPROVAL_PROPOSAL_ID);
        expect(body.confirmToolCall).toBeUndefined();
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: sse(
            executionStream(
              "create_expense",
              { id: "exp-e2e-1", status: "submitted", recommendation: null },
              "Expense submitted — awaiting finance review.",
            ),
          ),
        });
        return;
      }
      if (body.denyProposal) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
        return;
      }
      // Planner: wants to create an expense (write tool → confirmation).
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sse(
          approvalStream("create_expense", {
            employeeId: "00000000-0000-4000-8000-000000000001",
            amount: 240,
            category: "Software",
            expenseDate: "2026-08-30",
            currencyCode: "USD",
            merchant: "AWS",
          }),
        ),
      });
    });

    await askCopilot(page, "Create an expense for AWS training");

    // Inline approval card with the write tool awaiting consent.
    const approvalCard = page.getByTestId("tool-step-card");
    await expect(approvalCard).toBeVisible();
    await expect(approvalCard).toContainText("Create expense");
    await expect(approvalCard).toContainText("Awaiting approval");

    await page.getByLabel("Approve Create expense").click();

    // Confirm only the opaque, server-side proposal ID is sent on approval.
    await expect
      .poll(() => requests.length, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(2);
    const confirmedRequest = requests[1] as Record<string, unknown>;
    expect(confirmedRequest.approveProposal).toBe(APPROVAL_PROPOSAL_ID);
    expect(confirmedRequest.confirmToolCall).toBeUndefined();
    expect(confirmedRequest.messages).toEqual([
      { role: "user", content: "Create an expense for AWS training" },
    ]);

    // The tool result card renders live status badges from the CRUD response.
    await expect(page.getByTestId("tool-result-card")).toBeVisible();
    await expect(page.getByTestId("tool-result-card")).toContainText("Status: submitted");
    await expect(page.getByText("Expense submitted — awaiting finance review.")).toBeVisible();
  });

  test("Deny closes the approval card and sends the proposal ID without executing the tool", async ({ page }) => {
    const requests: Array<Record<string, unknown>> = [];
    await routeCopilot(page, async (route, body) => {
      requests.push(body);
      if (body.denyProposal) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sse(
          approvalStream(
            "approve_offboarding",
            { id: "00000000-0000-4000-8000-000000000002" },
            DENIAL_PROPOSAL_ID,
          ),
        ),
      });
    });

    await askCopilot(page, "Approve offboarding for case 2");

    await expect(page.getByTestId("tool-step-card")).toContainText("Approve offboarding");
    await page.getByLabel("Deny Approve offboarding").click();

    await expect(page.getByTestId("tool-step-card")).toContainText("Denied");
    await expect.poll(() => requests.length, { timeout: 5_000 }).toBe(2);
    expect(requests[1].denyProposal).toBe(DENIAL_PROPOSAL_ID);
    expect(requests[1].approveProposal).toBeUndefined();
    expect(requests[1].confirmToolCall).toBeUndefined();
  });

  test("read tools execute immediately and stream the final answer", async ({ page }) => {
    await routeCopilot(page, async (route, body) => {
      if (body.approveProposal) {
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: sse([{ type: "done", result: { text: "unexpected", actions: [] } }]),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sse(
          executionStream(
            "fetch_expenses",
            [{ id: "exp-1", employeeName: "Priya Nair", status: "pending" }],
            "You have 3 pending expense claims.",
          ),
        ),
      });
    });

    await askCopilot(page, "Show pending expenses");

    // Read tools need no approval: result card + final answer appear directly.
    await expect(page.getByTestId("tool-step-card")).toContainText("Fetch expenses");
    await expect(page.getByTestId("tool-result-card")).toBeVisible();
    await expect(page.getByText("You have 3 pending expense claims.")).toBeVisible();
    await expect(page.getByLabel("Approve Fetch expenses")).toHaveCount(0);
  });
});
