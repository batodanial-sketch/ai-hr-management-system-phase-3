import { NextResponse } from "next/server";
import { adminClient, hasSupabaseEnv } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dependency readiness for PostgreSQL/Supabase; never exposes connection data. */
export async function GET(): Promise<NextResponse> {
  if (!hasSupabaseEnv()) {
    return NextResponse.json(
      { status: "unavailable", dependency: "database", reason: "not_configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const { error } = await adminClient()
      .from("organizations")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    return NextResponse.json(
      { status: error ? "unavailable" : "healthy", dependency: "database" },
      { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable", dependency: "database", reason: "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
