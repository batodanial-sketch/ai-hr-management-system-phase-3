/** Edge Shield request classification, isolated from storage/limiter adapters. */
export type EdgeRateCategory = "auth" | "webhook" | "module" | "copilot";

/** True when the request path belongs to an edge-limited category. */
export function edgeRateCategoryFor(pathname: string): EdgeRateCategory | null {
  if (
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/desktop/") ||
    pathname.startsWith("/api/scim/")
  ) {
    return "webhook";
  }
  // Only authentication API calls consume the auth budget. Counting page
  // navigation (/login, /signup, /auth/license) made legitimate reloads
  // exhaust the 10-request API limit before a credential/SSO action occurred.
  if (pathname.startsWith("/api/auth")) {
    return "auth";
  }
  if (pathname.startsWith("/api/ai/") || pathname.startsWith("/api/engine/")) {
    return "copilot";
  }
  if (
    pathname.startsWith("/api/employees") ||
    pathname.startsWith("/api/benefits") ||
    pathname.startsWith("/api/equity") ||
    pathname.startsWith("/api/expenses") ||
    pathname.startsWith("/api/surveys") ||
    pathname.startsWith("/api/planning") ||
    pathname.startsWith("/api/contractors") ||
    pathname.startsWith("/api/offboarding") ||
    pathname.startsWith("/api/assets") ||
    pathname.startsWith("/api/documents") ||
    pathname.startsWith("/api/screening") ||
    pathname.startsWith("/api/team")
  ) {
    return "module";
  }
  return null;
}
