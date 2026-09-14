import type { InfrastructureCheck } from "./types";

export function safeInfrastructureEvidence(checks: InfrastructureCheck[]): InfrastructureCheck[] {
  return checks.map(({ service, check, timestamp, status, evidence, error }) => ({
    service, check, timestamp, status,
    evidence: evidence.replace(/(key|token|secret|password|authorization)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]"),
    ...(error ? { error: error.replace(/(key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]") } : {}),
  }));
}
