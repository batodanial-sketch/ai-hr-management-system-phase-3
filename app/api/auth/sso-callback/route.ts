import { NextResponse } from "next/server";
import { hasSupabaseEnv, serverClient } from "@/lib/supabase/server";
import { resolveWorkspaceSsoDecision } from "@/lib/auth/workspace-sso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ requiresOAuth: true }, { status: 401 });
  }
  try {
    const { data, error } = await serverClient().auth.getUser();
    if (error || !data.user?.email) {
      return NextResponse.json({ requiresOAuth: true }, { status: 401 });
    }
    // Decisioning uses the verified session email; caller-supplied identity is ignored.
    const decision = await resolveWorkspaceSsoDecision(data.user.email, data.user.id, data.user.app_metadata);
    return NextResponse.json(decision);
  } catch {
    return NextResponse.json(
      { requiresOAuth: false, message: "Unable to verify Google Workspace access right now." },
      { status: 503 },
    );
  }
}
