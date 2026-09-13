import { toJson } from "@/lib/utils";
import { z } from "zod";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@/src/lib/supabase";
import { claimWebhookReplay, verifyTimestampedHmac } from "@/lib/security/webhook-replay";
import { resolveExternalApiKey } from "@/src/lib/security/webhookAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  organizationId: z.string().uuid(),
  workflowId: z.string().uuid(),
  triggerEvent: z.string().min(1).max(120),
  payload: z.record(z.string(), z.unknown()).default({}),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]).default("queued"),
  errorMessage: z.string().max(4000).optional().nullable(),
});

const MAX_PAYLOAD_CHARS = 8_000;

function boundedPayload(value: unknown): unknown {
  try {
    const serialized = JSON.stringify(value ?? {});
    return serialized.length <= MAX_PAYLOAD_CHARS ? value : { truncated: true, preview: serialized.slice(0, MAX_PAYLOAD_CHARS) };
  } catch {
    return { truncated: true, preview: null };
  }
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) return Response.json({ success: false, error: "Supabase admin credentials are not configured." }, { status: 503 });
  const rawBody = await request.text();
  const secret = process.env.N8N_WEBHOOK_SECRET;
  const timestamp = request.headers.get("x-fluxentiq-timestamp");
  const eventId = request.headers.get("x-fluxentiq-event-id");
  const signature = request.headers.get("x-fluxentiq-n8n-signature");
  if (!secret || !verifyTimestampedHmac(rawBody, timestamp, signature, secret) || !eventId) {
    return Response.json({ success: false, error: "Unauthorized n8n webhook." }, { status: 401 });
  }

  try {
    const payload = schema.parse(JSON.parse(rawBody));
    const machineKey = await resolveExternalApiKey(request, "workflows:write");
    if (!machineKey.success || machineKey.data.organization_id !== payload.organizationId) {
      return Response.json({ success: false, error: "Webhook tenant authorization failed." }, { status: 403 });
    }
    const supabase = createAdminSupabaseClient();
    const { data: workflow, error: workflowError } = await supabase
      .from("workflows")
      .select("id, organization_id")
      .eq("id", payload.workflowId)
      .eq("organization_id", payload.organizationId)
      .maybeSingle();
    if (workflowError || !workflow) return Response.json({ success: false, error: "Workflow does not belong to the organization." }, { status: 403 });

    const claim = await claimWebhookReplay({ provider: "n8n", eventId, organizationId: payload.organizationId, rawBody });
    if (claim === "duplicate") return Response.json({ success: true, duplicate: true, data: { eventId } }, { status: 200 });
    if (claim !== "claimed") return Response.json({ success: false, error: "Webhook replay protection is unavailable." }, { status: 503 });

    const safePayload = boundedPayload(payload.payload);
    const { data: run, error: runError } = await supabase.from("workflow_runs").insert({
      organization_id: payload.organizationId,
      workflow_id: payload.workflowId,
      status: payload.status,
      trigger_payload: toJson({ event: payload.triggerEvent, payload: safePayload }),
      output: toJson(payload.status === "succeeded" ? safePayload : {}),
      error_message: payload.errorMessage || null,
      started_at: new Date().toISOString(),
      finished_at: ["succeeded", "failed", "cancelled"].includes(payload.status) ? new Date().toISOString() : null,
    }).select().single();
    if (runError || !run) return Response.json({ success: false, error: runError?.message || "Unable to persist n8n workflow run." }, { status: 500 });

    const { error: auditError } = await supabase.from("audit_logs").insert({
      organization_id: payload.organizationId,
      actor_user_id: null,
      action: "generate",
      entity_type: `n8n:${payload.triggerEvent}`,
      entity_id: run.id,
      before_state: null,
      after_state: toJson({ status: payload.status, payload: safePayload, event_id: eventId }),
    });
    if (auditError) return Response.json({ success: false, error: auditError.message }, { status: 500 });
    return Response.json({ success: true, data: { workflowRunId: run.id, status: run.status } }, { status: 202 });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(" ") : "Invalid n8n webhook payload.";
    return Response.json({ success: false, error: message }, { status: 400 });
  }
}
