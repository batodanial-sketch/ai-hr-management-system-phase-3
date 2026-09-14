export const INFRASTRUCTURE_STATUSES = [
  "NOT_IMPLEMENTED",
  "IMPLEMENTED_UNCONFIGURED",
  "CONFIGURED",
  "REACHABILITY_FAILED",
  "AUTHENTICATION_FAILED",
  "FUNCTIONAL",
  "VERIFIED",
  "DEGRADED",
  "BLOCKED-EXTERNAL",
] as const;

export type InfrastructureStatus = (typeof INFRASTRUCTURE_STATUSES)[number];
export type InfrastructureCriticality = "critical" | "high" | "medium" | "enterprise" | "operational";

export interface InfrastructureCheck {
  service: string;
  check: string;
  timestamp: string;
  status: InfrastructureStatus;
  evidence: string;
  error?: string;
}

export interface InfrastructureService {
  id: string;
  name: string;
  criticality: InfrastructureCriticality;
  requiredEnv: string[];
  documentation: string;
  checkConfiguration(env?: NodeJS.ProcessEnv): InfrastructureCheck;
  checkReachability?(): Promise<InfrastructureCheck>;
}
