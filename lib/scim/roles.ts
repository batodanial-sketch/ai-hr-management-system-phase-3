import type { CanonicalRoleCode } from "@/lib/authz/model";

/** Maps IdP-facing SCIM role labels to canonical memberships.role values. */
const SCIM_ROLE_TO_CANONICAL: Record<string, CanonicalRoleCode> = {
  owner: "owner",
  super_admin: "owner",
  admin: "admin",
  hr_admin: "admin",
  manager: "manager",
  employee: "member",
  member: "member",
};

/** Unknown provisioning labels fail safe to the least-privileged role. */
export function normalizeScimRoleCode(raw: unknown): CanonicalRoleCode {
  const value = String(raw ?? "member").toLowerCase().trim();
  return SCIM_ROLE_TO_CANONICAL[value] ?? "member";
}
