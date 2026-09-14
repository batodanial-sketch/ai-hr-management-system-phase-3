import { GET as systemReadiness } from "@/app/api/system/ready/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dependency readiness. Unlike liveness, this returns 503 when required
 * production dependencies are unavailable. The non-sensitive inventory remains
 * available at `/api/health/infrastructure`.
 */
export async function GET(): Promise<Response> {
  return systemReadiness();
}
