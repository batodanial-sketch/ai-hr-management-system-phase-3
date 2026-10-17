import { NextResponse } from "next/server";
import { z } from "zod";
import { readBoundedRequestBody } from "@/lib/security/bounded-request-body";
import { adminClient, hasSupabaseEnv } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().trim().min(1).max(2048) });
const invalid = () => NextResponse.json({ status: "invalid", email: null });

export async function POST(request: Request): Promise<NextResponse> {
  const bounded = await readBoundedRequestBody(request, 8 * 1024);
  if (!bounded.ok) return NextResponse.json({ message: "Request body is too large." }, { status: 413 });
  const parsed = schema.safeParse(JSON.parse(bounded.text || "null"));
  if (!parsed.success) return invalid();
  if (!hasSupabaseEnv()) return NextResponse.json({ message: "Access request activation is unavailable." }, { status: 503 });

  try {
    const admin = adminClient();
    // Claim the approved token with one update so it cannot be replayed concurrently.
    const { data: claimed, error: claimError } = await admin.from("access_requests")
      .update({ token: null }).eq("token", parsed.data.token).eq("status", "approved")
      .select("id, organization_id, email, domain, source_tag").maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return invalid();

    const { data: member, error: memberLookupError } = await admin.from("workspace_memberships")
      .select("id").eq("organization_id", claimed.organization_id).eq("email", claimed.email).maybeSingle();
    if (memberLookupError) throw memberLookupError;
    if (!member) {
      const { error: insertError } = await admin.from("workspace_memberships").insert({
        organization_id: claimed.organization_id,
        email: claimed.email,
        domain: claimed.domain,
        role: "member",
        source_tag: claimed.source_tag || "google_workspace",
      });
      if (insertError) {
        // Restore the token if the membership write failed; an administrator can retry.
        await admin.from("access_requests").update({ token: parsed.data.token }).eq("id", claimed.id).is("token", null);
        throw insertError;
      }
    }

    // If the approved user has already signed up, attach the canonical membership
    // and pin the active workspace. A not-yet-created account can redeem the same
    // approved access record after identity signup is completed.
    const { data: account, error: accountError } = await admin.from("users")
      .select("id").ilike("email", claimed.email).maybeSingle();
    if (accountError) throw accountError;
    if (account?.id) {
      const { error: membershipError } = await admin.from("memberships").upsert({
        user_id: account.id,
        organization_id: claimed.organization_id,
        role: "member",
      }, { onConflict: "user_id,organization_id" });
      if (membershipError) throw membershipError;
      const { data: authAccount } = await admin.auth.admin.getUserById(account.id);
      const oldMetadata = authAccount.user?.app_metadata && typeof authAccount.user.app_metadata === "object"
        ? authAccount.user.app_metadata as Record<string, unknown>
        : {};
      const { error: claimError } = await admin.auth.admin.updateUserById(account.id, {
        app_metadata: { ...oldMetadata, organization_id: claimed.organization_id },
      });
      if (claimError) throw claimError;
    }
    return NextResponse.json({ status: "activated", email: claimed.email });
  } catch {
    return NextResponse.json({ message: "Unable to activate the access request." }, { status: 500 });
  }
}
