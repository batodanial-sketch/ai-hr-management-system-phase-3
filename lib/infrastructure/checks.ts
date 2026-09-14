import { configurationChecks } from "./registry";
import type { InfrastructureCheck } from "./types";

/** Safe, configuration-only checks. Live checks deliberately live in scripts so
 * credentials and destructive setup never run from an unauthenticated health request. */
export function getInfrastructureConfigurationChecks(env = process.env): InfrastructureCheck[] {
  return configurationChecks(env);
}

export function summarizeInfrastructure(checks: InfrastructureCheck[]) {
  const critical = checks.filter((check) => ["Supabase/PostgreSQL", "Supabase Auth", "PostgreSQL RLS / tenant isolation", "Production deployment"].includes(check.service));
  return {
    status: critical.every((check) => check.status === "VERIFIED") ? "VERIFIED" : "DEGRADED",
    criticalVerified: critical.filter((check) => check.status === "VERIFIED").length,
    criticalTotal: critical.length,
  } as const;
}
