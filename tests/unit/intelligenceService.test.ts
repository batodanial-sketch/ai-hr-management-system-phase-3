jest.mock("server-only", () => ({}), { virtual: true });

import {
  INTELLIGENCE_INFRASTRUCTURE_ACTOR,
  discoverOrganizationsForIntelligenceSweep,
  pinIntelligenceOrganization,
  runTrustedIntelligenceSweep,
  type ServiceRoleDb,
} from "@/lib/intelligence/service";

function fakeDb(rows: Record<string, unknown>[]): ServiceRoleDb {
  return {
    from: () => ({
      select: () => {
        let filtered = rows;
        const query = {
          eq: (column: string, value: string) => {
            filtered = rows.filter((row) => row[column] === value);
            return query;
          },
          order: () => query,
          limit: async (limit: number) => ({ data: filtered.slice(0, limit), error: null }),
          maybeSingle: async () => ({ data: filtered[0] ?? null, error: null }),
        };
        return query;
      },
    }),
  } as unknown as ServiceRoleDb;
}

describe("sessionless intelligence service boundary", () => {
  it("discovers only bounded minimal organization identities", async () => {
    const result = await discoverOrganizationsForIntelligenceSweep({ limit: 2, db: fakeDb([{ id: "org-a", name: "A" }, { id: "org-b" }, { id: "org-c" }]) });
    expect(result).toEqual([{ organizationId: "org-a" }, { organizationId: "org-b" }]);
    expect(result[0]).not.toHaveProperty("name");
  });

  it("rejects missing or unknown organizations before evaluation", async () => {
    await expect(pinIntelligenceOrganization("", { db: fakeDb([]) })).rejects.toThrow(/canonical organization/);
    await expect(pinIntelligenceOrganization("org-z", { db: fakeDb([{ id: "org-a" }]) })).rejects.toThrow(/not eligible/);
  });

  it("creates a frozen infrastructure context with organization-pinned bounded reads", async () => {
    const context = await pinIntelligenceOrganization("org-a", { db: fakeDb([{ id: "org-a" }]) });
    expect(Object.isFrozen(context)).toBe(true);
    expect(context).toMatchObject({ organizationId: "org-a", actor: INTELLIGENCE_INFRASTRUCTURE_ACTOR });
    expect(context.readRows).toBeDefined();
    await expect(context.readRows("candidates", "email", 10)).rejects.toThrow(/projection/);
  });

  it("runs H1 orchestration through discovery and pinning without switching tenants", async () => {
    const seen: string[] = [];
    const db = fakeDb([
      { id: "org-a" },
      { id: "org-b" },
      { id: "org-c" },
      { id: "candidate-a", organization_id: "org-a" },
      { id: "candidate-b", organization_id: "org-b" },
    ]);
    const report = await runTrustedIntelligenceSweep(
      async (context) => {
        seen.push(context.organizationId);
        const rows = await context.readRows("candidates", "id, stage", 10);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ organization_id: context.organizationId });
        return { insights: [], sources: [], generatedAt: "2026-09-13T00:00:00.000Z" };
      },
      { organizationLimit: 2, db, now: () => new Date("2026-09-13T00:00:00.000Z") },
    );

    expect(seen).toEqual(["org-a", "org-b"]);
    expect(report.organizationsProcessed).toBe(2);
    expect(report.organizationsFailed).toBe(0);
  });
});
