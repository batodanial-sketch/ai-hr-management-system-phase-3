import { NextResponse } from "next/server";
import { getInfrastructureConfigurationChecks, summarizeInfrastructure } from "@/lib/infrastructure/checks";
import { safeInfrastructureEvidence } from "@/lib/infrastructure/evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Safe configuration/dependency inventory. This endpoint intentionally does not
 * perform destructive live tests or disclose hosts, keys, tenants, or tokens.
 * `VERIFIED` is reserved for evidence produced by the live verification
 * commands, never for environment-variable presence.
 */
export async function GET(): Promise<NextResponse> {
  const checks = getInfrastructureConfigurationChecks();
  const summary = summarizeInfrastructure(checks);
  return NextResponse.json({
    status: summary.status,
    dependencies: safeInfrastructureEvidence(checks).map((check) => ({
      service: check.service,
      status: check.status,
      evidence: check.evidence,
    })),
    critical: { verified: summary.criticalVerified, total: summary.criticalTotal },
    timestamp: new Date().toISOString(),
  }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
