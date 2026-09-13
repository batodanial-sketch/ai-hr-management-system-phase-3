import { z } from "zod";
import { createServerSupabaseClient } from "@/src/lib/supabase";
import { requireOrganizationContext } from "@/app/actions/_shared";
import { createHmac, createHash } from "crypto";
import { safeOutboundFetch, UnsafeOutboundUrlError } from "@/lib/security/outbound";

export const runtime = "nodejs";

const schema = z.object({
  url: z.string().url(),
  eventType: z.string().min(2).max(120),
  payload: z.record(z.string(), z.unknown()),
  secret: z.string().min(16).max(512),
});

export async function POST(request: Request): Promise<Response> {
  const auth = await requireOrganizationContext("admin");
  if (!auth.success) return Response.json(auth, { status: 401 });

  try {
    const parsed = schema.parse(await request.json());
    const body = JSON.stringify({
      organizationId: auth.data.organizationId,
      eventType: parsed.eventType,
      payload: parsed.payload,
    });
    const response = await safeOutboundFetch(parsed.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-fluxentiq-signature": createHmac("sha256", parsed.secret).update(body).digest("hex"),
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    // Do not follow redirects and never persist the caller-supplied signing
    // secret. The endpoint is logged only as a destination audit field.
    const db = await createServerSupabaseClient();
    await db.from("external_webhook_logs").insert({
      organization_id: auth.data.organizationId,
      direction: "outbound",
      event_type: parsed.eventType,
      endpoint: parsed.url,
      status_code: response.status,
      payload_hash: createHash("sha256").update(body).digest("hex"),
    });
    return Response.json(
      { success: response.ok, data: { status: response.status }, error: response.ok ? undefined : "External endpoint rejected request." },
      { status: response.ok ? 202 : 502 },
    );
  } catch (error) {
    if (error instanceof UnsafeOutboundUrlError) {
      return Response.json({ success: false, error: error.message, code: error.code }, { status: 400 });
    }
    return Response.json(
      { success: false, error: error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(" ") : "Invalid outbound trigger." },
      { status: 400 },
    );
  }
}
