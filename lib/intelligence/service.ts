import "server-only";

import { adminClient } from "@/lib/supabase/server";
import { runIntelligenceSweep, DEFAULT_SWEEP_ORGANIZATION_LIMIT, type IntelligenceSweepDeps, type IntelligenceSweepReport } from "./sweep";
import type { InsightSet } from "./aggregator";

/** Infrastructure identity; this is not an HR role and cannot approve actions. */
export const INTELLIGENCE_INFRASTRUCTURE_ACTOR = "infrastructure:intelligence-sweep" as const;

export type IntelligenceTenantTable =
  | "attendance_records"
  | "leave_requests"
  | "employees"
  | "goals"
  | "pulse_surveys"
  | "offboarding_cases"
  | "documents"
  | "expense_reports"
  | "candidates"
  | "applications"
  | "interviews"
  | "daily_employee_tasks";

interface QueryResult<T = unknown> {
  data: T | null;
  error: { message: string } | null;
}

interface ServiceQuery {
  eq(column: string, value: string): ServiceQuery;
  order(column: string, options?: { ascending?: boolean }): ServiceQuery;
  limit(limit: number): Promise<QueryResult<unknown[]>>;
  maybeSingle(): Promise<QueryResult>;
}

interface ServiceRoleDb {
  from(table: string): { select(columns: string): ServiceQuery };
}

export interface IntelligenceTenantContext {
  readonly organizationId: string;
  readonly actor: typeof INTELLIGENCE_INFRASTRUCTURE_ACTOR;
  /**
   * The only supported sessionless data read. Table names are allow-listed,
   * organization_id is applied internally, and every read is bounded.
   */
  readonly readRows: (table: IntelligenceTenantTable, columns: string, limit?: number) => Promise<Record<string, unknown>[]>;
}

function serviceDb(): ServiceRoleDb {
  return adminClient() as unknown as ServiceRoleDb;
}

function boundedLimit(value: number | undefined): number {
  return Math.min(DEFAULT_SWEEP_ORGANIZATION_LIMIT, Math.max(1, Math.floor(value ?? DEFAULT_SWEEP_ORGANIZATION_LIMIT)));
}

function boundedRecordLimit(value: number | undefined): number {
  return Math.min(500, Math.max(1, Math.floor(value ?? 500)));
}

/**
 * Discovers only minimal organization identities through the trusted admin
 * client. No request/model-provided organization id enters this function.
 */
export async function discoverOrganizationsForIntelligenceSweep(
  options: { limit?: number; db?: ServiceRoleDb } = {},
): Promise<Array<{ organizationId: string }>> {
  const limit = boundedLimit(options.limit);
  const { data, error } = await (options.db ?? serviceDb())
    .from("organizations")
    .select("id")
    .order("id", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Organization discovery failed: ${error.message}`);

  return (Array.isArray(data) ? data : [])
    .map((row) => (row && typeof row === "object" ? (row as { id?: unknown }).id : undefined))
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .map((organizationId) => ({ organizationId }));
}

/**
 * Pins one verified organization before any sessionless evaluation begins.
 * The existence check is performed with the trusted service client, while the
 * returned context contains no mutable tenant selector or user role.
 */
export async function pinIntelligenceOrganization(
  organizationId: string,
  options: { db?: ServiceRoleDb } = {},
): Promise<IntelligenceTenantContext> {
  if (!organizationId || organizationId.trim() !== organizationId) {
    throw new Error("A non-empty canonical organization id is required.");
  }
  const { data, error } = await (options.db ?? serviceDb())
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`Organization pinning failed: ${error.message}`);
  const verified = data && typeof data === "object" && (data as { id?: unknown }).id === organizationId;
  if (!verified) throw new Error("Organization is not eligible for intelligence evaluation.");

  const readRows = async (table: IntelligenceTenantTable, columns: string, limit?: number): Promise<Record<string, unknown>[]> => {
    const result = await (options.db ?? serviceDb())
      .from(table)
      .select(columns)
      .eq("organization_id", organizationId)
      .limit(boundedRecordLimit(limit));
    if (result.error) throw new Error(`Tenant data read failed: ${result.error.message}`);
    return (Array.isArray(result.data) ? result.data : []).filter(
      (row): row is Record<string, unknown> => Boolean(row && typeof row === "object"),
    );
  };

  return Object.freeze({ organizationId, actor: INTELLIGENCE_INFRASTRUCTURE_ACTOR, readRows });
}

/**
 * Runs the existing H1 sweep with a trusted discovery/pinning boundary.
 * The evaluator receives only the pinned context; it cannot select another
 * organization during this invocation.
 */
export async function runTrustedIntelligenceSweep(
  evaluateOrganization: (context: IntelligenceTenantContext) => Promise<InsightSet>,
  options: { organizationLimit?: number; now?: () => Date; db?: ServiceRoleDb } = {},
): Promise<IntelligenceSweepReport> {
  const deps: IntelligenceSweepDeps = {
    listOrganizations: async (limit) => {
      const organizations = await discoverOrganizationsForIntelligenceSweep({ limit, db: options.db });
      return organizations.map(({ organizationId }) => ({ id: organizationId }));
    },
    evaluateOrganization: async (organizationId) => {
      const context = await pinIntelligenceOrganization(organizationId, { db: options.db });
      return evaluateOrganization(context);
    },
  };
  return runIntelligenceSweep(deps, options);
}

export type { ServiceRoleDb };
