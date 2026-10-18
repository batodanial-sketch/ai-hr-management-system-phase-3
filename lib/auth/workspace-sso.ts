import "server-only";

import { adminClient } from "@/lib/supabase/server";

export type WorkspaceDecisionPath =
  | "existing_membership_allowed"
  | "invited_membership_activated"
  | "membership_required"
  | "domain_not_provisioned"
  | "personal_account_blocked"
  | "ambiguous_domain_blocked";

export interface WorkspaceSsoDecision {
  decision: WorkspaceDecisionPath;
  email: string;
  domain: string;
  message: string;
  redirectTo: string | null;
}

const PERSONAL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
  "yahoo.com", "icloud.com", "aol.com", "proton.me", "protonmail.com",
]);

const COPY: Record<WorkspaceDecisionPath, string> = {
  existing_membership_allowed: "Existing membership verified.",
  invited_membership_activated: "Pending invite activated.",
  membership_required: "Access requires approval for this domain.",
  domain_not_provisioned: "This domain is not provisioned for Google Workspace access.",
  personal_account_blocked: "Personal accounts are not permitted. Use your company account.",
  ambiguous_domain_blocked: "Domain ownership could not be verified.",
};

function result(decision: WorkspaceDecisionPath, email: string, domain: string): WorkspaceSsoDecision {
  const allowed = decision === "existing_membership_allowed" || decision === "invited_membership_activated";
  return { decision, email, domain, message: COPY[decision], redirectTo: allowed ? "/dashboard" : null };
}

function canonicalRole(role: unknown): "owner" | "admin" | "manager" | "member" {
  return role === "owner" || role === "admin" || role === "manager" || role === "member" ? role : "member";
}

async function attachCanonicalMembership(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  organizationId: string,
  role: unknown,
  appMetadata: unknown,
): Promise<void> {
  const { error: membershipError } = await admin.from("memberships").upsert({
    user_id: userId,
    organization_id: organizationId,
    role: canonicalRole(role),
  }, { onConflict: "user_id,organization_id" });
  if (membershipError) throw new Error(`Unable to assign workspace membership: ${membershipError.message}`);

  const metadata = appMetadata && typeof appMetadata === "object"
    ? appMetadata as Record<string, unknown>
    : {};
  const { error: claimError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...metadata, organization_id: organizationId },
  });
  if (claimError) throw new Error(`Unable to select active workspace: ${claimError.message}`);
}

/**
 * Workspace decisioning runs only with an identity verified by Supabase Auth.
 * Without userId the function can classify a domain, but never grants access.
 */
export async function resolveWorkspaceSsoDecision(
  rawEmail: string,
  userId?: string,
  appMetadata?: unknown,
): Promise<WorkspaceSsoDecision> {
  const email = rawEmail.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  const domain = at > 0 ? email.slice(at + 1) : "";
  if (!email || at <= 0 || !domain) return result("domain_not_provisioned", email, domain);

  const admin = adminClient();
  const { data: domainConfig, error: domainError } = await admin
    .from("workspace_domains")
    .select("organization_id, provisioning_status, membership_policy, allow_personal_accounts")
    .eq("domain", domain)
    .maybeSingle();
  if (domainError) throw new Error(`Unable to resolve workspace domain: ${domainError.message}`);

  if (PERSONAL_DOMAINS.has(domain) && !domainConfig?.allow_personal_accounts) {
    return result("personal_account_blocked", email, domain);
  }
  if (!domainConfig) return result("domain_not_provisioned", email, domain);
  if (domainConfig.provisioning_status === "ambiguous") return result("ambiguous_domain_blocked", email, domain);
  if (domainConfig.provisioning_status !== "provisioned") return result("domain_not_provisioned", email, domain);

  const organizationId = String(domainConfig.organization_id);
  const { data: workspaceMembership, error: workspaceMembershipError } = await admin
    .from("workspace_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("email", email)
    .maybeSingle();
  if (workspaceMembershipError) throw new Error(`Unable to check workspace membership: ${workspaceMembershipError.message}`);

  let canonicalMembership: { role?: string } | null = null;
  if (userId) {
    const { data, error } = await admin.from("memberships")
      .select("role").eq("user_id", userId).eq("organization_id", organizationId).maybeSingle();
    if (error) throw new Error(`Unable to check canonical membership: ${error.message}`);
    canonicalMembership = data;
  }

  if (workspaceMembership || canonicalMembership) {
    if (userId) {
      await attachCanonicalMembership(
        admin, userId, organizationId,
        workspaceMembership?.role ?? canonicalMembership?.role,
        appMetadata,
      );
    }
    return result("existing_membership_allowed", email, domain);
  }

  const { data: invite, error: inviteError } = await admin.from("workspace_invites")
    .select("id, role").eq("organization_id", organizationId).eq("email", email)
    .eq("status", "pending").maybeSingle();
  if (inviteError) throw new Error(`Unable to check workspace invite: ${inviteError.message}`);

  if (invite && userId) {
    const { error: activateError } = await admin.from("workspace_invites")
      .update({ status: "activated" }).eq("id", invite.id).eq("status", "pending");
    if (activateError) throw new Error(`Unable to activate workspace invite: ${activateError.message}`);

    const { error: provisionError } = await admin.from("workspace_memberships").insert({
      organization_id: organizationId,
      email,
      domain,
      role: invite.role === "admin" ? "admin" : "member",
      source_tag: "google_workspace",
    });
    if (provisionError) throw new Error(`Unable to provision invited member: ${provisionError.message}`);

    await attachCanonicalMembership(admin, userId, organizationId, invite.role, appMetadata);
    return result("invited_membership_activated", email, domain);
  }

  return result("membership_required", email, domain);
}
