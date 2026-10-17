import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readBoundedRequestBody } from "@/lib/security/bounded-request-body";
import { adminClient, hasSupabaseEnv } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  domain: z.string().trim().toLowerCase().min(1).max(253),
});

export async function POST(request: Request): Promise<NextResponse> {
  const bounded = await readBoundedRequestBody(request, 8 * 1024);
  if (!bounded.ok) return NextResponse.json({ message: "Request body is too large." }, { status: 413 });
  const parsed = schema.safeParse(JSON.parse(bounded.text || "null"));
  if (!parsed.success) return NextResponse.json({ message: "A valid company email and domain are required." }, { status: 400 });
  if (!hasSupabaseEnv()) return NextResponse.json({ message: "Workspace access requests are unavailable." }, { status: 503 });

  const { email, domain } = parsed.data;
  if (email.slice(email.lastIndexOf("@") + 1) !== domain) {
    return NextResponse.json({ message: "The email domain does not match the requested workspace domain." }, { status: 400 });
  }

  try {
    const admin = adminClient();
    const { data: config, error: configError } = await admin.from("workspace_domains")
      .select("organization_id, provisioning_status, membership_policy, allow_personal_accounts")
      .eq("domain", domain).maybeSingle();
    if (configError) throw configError;
    if (!config || config.provisioning_status !== "provisioned") {
      return NextResponse.json({ message: "This domain is not provisioned for workspace access." }, { status: 403 });
    }
    const personal = ["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "icloud.com", "aol.com", "proton.me", "protonmail.com"].includes(domain);
    if (personal && !config.allow_personal_accounts) return NextResponse.json({ message: "Personal accounts are not permitted." }, { status: 403 });
    if (config.membership_policy !== "require_membership") {
      return NextResponse.json({ message: "This workspace does not accept self-service access requests." }, { status: 403 });
    }

    const sourceTag = process.env.CI === "true" ? "e2e" : "google_workspace";
    const { data: existing, error: existingError } = await admin.from("access_requests")
      .select("id, email, domain, status")
      .eq("organization_id", config.organization_id).eq("email", email)
      .eq("status", "pending").eq("source_tag", sourceTag).limit(1).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return NextResponse.json({ ...existing, token: null });

    const { data: created, error: createError } = await admin.from("access_requests").insert({
      id: randomUUID(),
      organization_id: config.organization_id,
      email,
      domain,
      status: "pending",
      token: null,
      source_tag: sourceTag,
    }).select("id, email, domain, status").single();
    if (createError) throw createError;
    return NextResponse.json({ ...created, token: null });
  } catch {
    return NextResponse.json({ message: "Unable to record the access request." }, { status: 500 });
  }
}
