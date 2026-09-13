import { toJson } from "@/lib/utils";
import { z } from "zod";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@/src/lib/supabase";
import { claimWebhookReplay, verifyTimestampedHmac } from "@/lib/security/webhook-replay";
import { resolveExternalApiKey } from "@/src/lib/security/webhookAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bridgePayloadSchema = z.object({
  organizationId: z.string().uuid(),
  event: z.enum(["ai_assessment_completed", "workflow_completed", "workflow_failed", "scrape_completed", "attendance_event", "document_generated"]),
  workflowId: z.string().uuid().optional(),
  workflowRunId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  candidateId: z.string().uuid().optional(),
  applicationId: z.string().uuid().optional(),
  title: z.string().min(1).max(240).optional(),
  body: z.string().max(4000).optional(),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]).optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

const MAX_PAYLOAD_CHARS = 8_000;

function failure(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function boundedPayload(value: unknown): unknown {
  try {
    const serialized = JSON.stringify(value ?? {});
    return serialized.length <= MAX_PAYLOAD_CHARS ? value : { truncated: true, preview: serialized.slice(0, MAX_PAYLOAD_CHARS) };
  } catch {
    return { truncated: true, preview: null };
  }
}

export async function POST(request: Request) {
  if (!process.env.PYTHON_BRIDGE_WEBHOOK_SECRET) return failure("Python bridge webhook secret is not configured.", 503);
  if (!isSupabaseAdminConfigured) return failure("Python bridge storage is not configured.", 503);
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-fluxentiq-timestamp");
  const eventId = request.headers.get("x-fluxentiq-event-id");
  const signature = request.headers.get("x-fluxentiq-bridge-signature") ?? request.headers.get("x-fluxentiq-bridge-secret");
  if (!eventId || !verifyTimestampedHmac(rawBody, timestamp, signature, process.env.PYTHON_BRIDGE_WEBHOOK_SECRET)) return failure("Unauthorized Python bridge request.", 401);

  let event: z.infer<typeof bridgePayloadSchema>;
  try {
    event = bridgePayloadSchema.parse(JSON.parse(rawBody));
  } catch (error) {
    return failure(error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(" ") : "Invalid Python bridge payload.", 400);
  }

  try {
    const machineKey = await resolveExternalApiKey(request, "bridge:write");
    if (!machineKey.success || machineKey.data.organization_id !== event.organizationId) return failure("Webhook tenant authorization failed.", 403);
    const supabase = createAdminSupabaseClient();
    const { data: organization } = await supabase.from("organizations").select("id").eq("id", event.organizationId).maybeSingle();
    if (!organization) return failure("Organization was not found.", 404);

    const checks: Array<PromiseLike<{ data: unknown; error: unknown }>> = [];
    if (event.workflowId) checks.push(supabase.from("workflows").select("id").eq("id", event.workflowId).eq("organization_id", event.organizationId).maybeSingle());
    if (event.workflowRunId) checks.push(supabase.from("workflow_runs").select("id").eq("id", event.workflowRunId).eq("organization_id", event.organizationId).maybeSingle());
    if (event.employeeId) checks.push(supabase.from("employees").select("id").eq("id", event.employeeId).eq("organization_id", event.organizationId).maybeSingle());
    if (event.candidateId) checks.push(supabase.from("candidates").select("id").eq("id", event.candidateId).eq("organization_id", event.organizationId).maybeSingle());
    if (event.applicationId) checks.push(supabase.from("applications").select("id").eq("id", event.applicationId).eq("organization_id", event.organizationId).maybeSingle());
    const resources = await Promise.all(checks);
    if (resources.some((result) => result.error || !result.data)) return failure("Webhook resource does not belong to the organization.", 403);

    const claim = await claimWebhookReplay({ provider: "python-bridge", eventId, organizationId: event.organizationId, rawBody });
    if (claim === "duplicate") return Response.json({ success: true, duplicate: true, data: { eventId } }, { status: 200 });
    if (claim !== "claimed") return failure("Webhook replay protection is unavailable.", 503);

    const safePayload = boundedPayload(event.payload);
    let workflowRunId = event.workflowRunId || null;
    if (event.workflowId && event.status) {
      const { data: run, error: runError } = await supabase.from("workflow_runs").insert({
        organization_id: event.organizationId,
        workflow_id: event.workflowId,
        status: event.status,
        trigger_payload: toJson(safePayload),
        output: toJson(event.status === "succeeded" ? safePayload : {}),
        error_message: event.status === "failed" ? event.body || "Python bridge reported a workflow failure." : null,
        started_at: new Date().toISOString(),
        finished_at: ["succeeded", "failed", "cancelled"].includes(event.status) ? new Date().toISOString() : null,
      }).select().single();
      if (runError || !run) return failure("Unable to persist workflow run.", 500);
      workflowRunId = run.id;
    }

    if (event.title) {
      const { error: notificationError } = await supabase.from("notifications").insert({
        organization_id: event.organizationId,
        user_id: null,
        employee_id: event.employeeId || null,
        channel: "in_app",
        title: event.title,
        body: event.body || null,
        link: workflowRunId ? `/workflows/${workflowRunId}` : null,
        delivered_at: new Date().toISOString(),
      });
      if (notificationError) return failure("Notification persistence failed.", 500);
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      organization_id: event.organizationId,
      actor_user_id: null,
      action: event.event === "workflow_failed" ? "update" : "generate",
      entity_type: `python_bridge:${event.event}`,
      entity_id: workflowRunId || event.applicationId || event.candidateId || event.employeeId || null,
      before_state: null,
      after_state: toJson({ payload: safePayload, workflow_run_id: workflowRunId, event_id: eventId }),
    });
    if (auditError) return failure("Audit persistence failed.", 500);
    return Response.json({ success: true, data: { workflowRunId, event: event.event } }, { status: 202 });
  } catch {
    return failure("Python bridge processing failed.", 500);
  }
}
