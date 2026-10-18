import { proxyToBridge } from "@/lib/ai-proxy";
import { requireRole, rbacErrorResponse } from "@/lib/rbac";
import { readBoundedRequestBody } from "@/lib/security/bounded-request-body";

export const runtime = "nodejs";

const ALLOWED_EVENTS = new Set([
  "employee.created",
  "employee.updated",
  "leave.requested",
  "leave.resolved",
  "candidate.moved",
  "payroll.completed",
  "workflow.completed",
  "expense.created",
  "screening.completed",
  "offboarding.completed",
]);

export async function POST(request: Request): Promise<Response> {
  let context;
  try {
    context = await requireRole("HR_ADMIN");
  } catch (error) {
    return rbacErrorResponse(error) ?? Response.json(
      { error: "Unauthorized." },
      { status: 401 },
    );
  }

  const bounded = await readBoundedRequestBody(request, 64 * 1024);
  if (!bounded.ok) {
    return Response.json({ error: "Request body exceeds the 64 KiB limit." }, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bounded.text);
  } catch {
    return Response.json({ error: "A valid JSON object is required." }, { status: 400 });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return Response.json({ error: "A JSON object is required." }, { status: 400 });
  }

  const body = parsed as Record<string, unknown>;
  if ("workflow" in body) {
    return Response.json(
      { error: "Inline workflow graphs are not accepted. Publish the workflow and trigger its event instead." },
      { status: 400 },
    );
  }
  if (typeof body.event !== "string" || !ALLOWED_EVENTS.has(body.event)) {
    return Response.json({ error: "Unsupported workflow event." }, { status: 400 });
  }
  if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) {
    return Response.json({ error: "payload must be a JSON object." }, { status: 400 });
  }

  // The canonical membership is the only allowed source of organization scope.
  const payload = {
    ...(body.payload as Record<string, unknown>),
    organization_id: context.organizationId,
  };
  const sanitized = new Request(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event: body.event, payload }),
  });
  return proxyToBridge(sanitized, "/api/workflows/trigger");
}
