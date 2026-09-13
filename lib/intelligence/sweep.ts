import "server-only";

import type { InsightSet } from "./aggregator";
import type { Insight } from "./types";

/** Maximum organizations a single scheduler invocation may inspect. */
export const DEFAULT_SWEEP_ORGANIZATION_LIMIT = 25;

export interface IntelligenceSweepOrganization {
  id: string;
}

export interface IntelligenceSweepDeps {
  /** Must return an already-authorized, tenant-scoped organization list. */
  listOrganizations: (limit: number) => Promise<IntelligenceSweepOrganization[]>;
  /** Must evaluate one organization using the canonical Insight aggregator. */
  evaluateOrganization: (organizationId: string) => Promise<InsightSet>;
}

export interface IntelligenceSweepReport {
  startedAt: string;
  finishedAt: string;
  organizationsDiscovered: number;
  organizationsProcessed: number;
  organizationsFailed: number;
  insightsObserved: number;
  insightsDeduplicated: number;
  insights: Insight[];
  failures: { organizationId: string; reason: string }[];
}

/**
 * Bounded, failure-isolated orchestration for proactive intelligence.
 *
 * This deliberately does not add an intelligence table: Insight is currently
 * a deterministic projection of canonical tenant data, and its stable id is
 * the existing deduplication identity. A future durable alert/acknowledgement
 * store can consume this report without changing detector contracts.
 *
 * Organizations are processed sequentially. That is intentionally conservative
 * for a cron invocation: it bounds concurrent database work and ensures one
 * tenant failure cannot discard successful results from other tenants.
 */
export async function runIntelligenceSweep(
  deps: IntelligenceSweepDeps,
  options: { organizationLimit?: number; now?: () => Date } = {},
): Promise<IntelligenceSweepReport> {
  const limit = Math.min(
    DEFAULT_SWEEP_ORGANIZATION_LIMIT,
    Math.max(1, Math.floor(options.organizationLimit ?? DEFAULT_SWEEP_ORGANIZATION_LIMIT)),
  );
  const startedAt = (options.now?.() ?? new Date()).toISOString();
  const organizations = await deps.listOrganizations(limit);
  const failures: IntelligenceSweepReport["failures"] = [];
  const deduped = new Map<string, Insight>();
  let insightsObserved = 0;
  let processed = 0;

  for (const organization of organizations.slice(0, limit)) {
    try {
      const result = await deps.evaluateOrganization(organization.id);
      processed += 1;
      for (const insight of result.insights) {
        insightsObserved += 1;
        // The canonical id is stable per rule and scope. Repeated detector
        // output in one sweep therefore cannot create duplicate surfaced items.
        const tenantScopedId = `${organization.id}:${insight.id}`;
        if (!deduped.has(tenantScopedId)) deduped.set(tenantScopedId, insight);
      }
    } catch (error) {
      failures.push({
        organizationId: organization.id,
        reason: error instanceof Error ? error.message.slice(0, 240) : "organization evaluation failed",
      });
    }
  }

  const finishedAt = (options.now?.() ?? new Date()).toISOString();
  const insights = [...deduped.values()];
  return {
    startedAt,
    finishedAt,
    organizationsDiscovered: organizations.length,
    organizationsProcessed: processed,
    organizationsFailed: failures.length,
    insightsObserved,
    insightsDeduplicated: insightsObserved - insights.length,
    insights,
    failures,
  };
}
