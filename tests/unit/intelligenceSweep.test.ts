jest.mock("server-only", () => ({}), { virtual: true });

import { runIntelligenceSweep } from "@/lib/intelligence/sweep";
import type { InsightSet } from "@/lib/intelligence/aggregator";

const insight = (id: string) => ({
  id,
  category: "recruitment" as const,
  title: id,
  detail: "grounded",
  severity: "warning" as const,
  confidence: 0.8,
  evidence: ["count = 1"],
  scope: { type: "org" as const, label: "Organization" },
  freshness: { asOf: "2026-09-13T00:00:00.000Z", source: "test" },
  explanation: "evidence supports review",
  limitations: [],
  recommendedAction: { label: "Review", detail: "Review evidence", requiresApproval: false },
  insufficientData: false,
});

function set(...ids: string[]): InsightSet {
  return { insights: ids.map(insight), sources: [], generatedAt: "2026-09-13T00:00:00.000Z" };
}

describe("runIntelligenceSweep", () => {
  it("bounds organizations and isolates a tenant failure", async () => {
    const evaluated: string[] = [];
    const report = await runIntelligenceSweep(
      {
        listOrganizations: async (limit) => Array.from({ length: limit + 5 }, (_, i) => ({ id: `org-${i}` })),
        evaluateOrganization: async (organizationId) => {
          evaluated.push(organizationId);
          if (organizationId === "org-1") throw new Error("source unavailable");
          return set(`${organizationId}:finding`);
        },
      },
      { organizationLimit: 2, now: () => new Date("2026-09-13T00:00:00.000Z") },
    );

    expect(evaluated).toEqual(["org-0", "org-1"]);
    expect(report.organizationsDiscovered).toBe(7);
    expect(report.organizationsProcessed).toBe(1);
    expect(report.organizationsFailed).toBe(1);
    expect(report.failures).toEqual([{ organizationId: "org-1", reason: "source unavailable" }]);
    expect(report.insights).toHaveLength(1);
  });

  it("deduplicates repeated logical insights within a tenant but not across tenants", async () => {
    const report = await runIntelligenceSweep(
      {
        listOrganizations: async () => [{ id: "org-a" }, { id: "org-b" }],
        evaluateOrganization: async (organizationId) => set("recruitment:stage-bottleneck", "recruitment:stage-bottleneck"),
      },
      { now: () => new Date("2026-09-13T00:00:00.000Z") },
    );

    expect(report.insightsObserved).toBe(4);
    expect(report.insights).toHaveLength(2);
    expect(report.insightsDeduplicated).toBe(2);
  });

  it("clamps invalid and excessive limits to a safe positive bound", async () => {
    let requested = 0;
    await runIntelligenceSweep({
      listOrganizations: async (limit) => {
        requested = limit;
        return [];
      },
      evaluateOrganization: async () => set("unused"),
    }, { organizationLimit: 999999 });
    expect(requested).toBe(25);
  });
});
