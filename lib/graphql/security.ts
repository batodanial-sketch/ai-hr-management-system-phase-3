import "server-only";

import { getRbacContext, type RbacContext } from "@/lib/rbac";
import { roleAtLeast } from "@/lib/auth";

/** GraphQL exposes broad HR/financial data, so it is an HR-admin boundary. */
export function isGraphqlRoleAllowed(role: RbacContext["role"]): boolean {
  return roleAtLeast(role, "HR_ADMIN");
}

export async function requireGraphqlContext(): Promise<RbacContext> {
  const context = await getRbacContext();
  if (!isGraphqlRoleAllowed(context.role)) {
    const error = new Error("GraphQL requires an HR_ADMIN or SUPER_ADMIN role.");
    Object.assign(error, { code: "RBAC_FORBIDDEN", status: 403 });
    throw error;
  }
  return context;
}

export function graphqlAuthorizationError(error: unknown): Response {
  const status = typeof error === "object" && error !== null && "status" in error && (error as { status?: unknown }).status === 403 ? 403 : 401;
  return Response.json({ ok: false, error: status === 403 ? "GraphQL access is restricted to HR administrators." : "Unauthorized." }, { status });
}
