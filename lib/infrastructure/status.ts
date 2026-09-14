import type { InfrastructureStatus } from "./types";

export function statusForConfiguration(configured: boolean, implemented = true): InfrastructureStatus {
  if (!implemented) return "NOT_IMPLEMENTED";
  return configured ? "CONFIGURED" : "IMPLEMENTED_UNCONFIGURED";
}

export function isVerified(status: InfrastructureStatus): boolean {
  return status === "VERIFIED";
}

export function isCritical(service: { criticality: string }): boolean {
  return service.criticality === "critical";
}
