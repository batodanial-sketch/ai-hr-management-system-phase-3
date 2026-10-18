import { NextResponse } from "next/server";
import { createWebhook, deleteWebhook, listWebhooks } from "@/lib/webhooks";
import { recordAudit } from "@/lib/audit";
import { readBoundedRequestBody } from "@/lib/security/bounded-request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const subscriptions = await listWebhooks();
  return NextResponse.json({ subscriptions });
}

export async function POST(request: Request): Promise<NextResponse> {
  const bodyResult = await readBoundedRequestBody(request, 64 * 1024);
  if (!bodyResult.ok) {
    return NextResponse.json({ ok: false, message: "Webhook configuration body exceeds the 64 KiB limit." }, { status: 413 });
  }
  let body: { url?: string; events?: string[]; secret?: string };
  try {
    const parsed: unknown = JSON.parse(bodyResult.text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ ok: false, message: "Request body must be a JSON object." }, { status: 400 });
    }
    body = parsed as { url?: string; events?: string[]; secret?: string };
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.url) {
    return NextResponse.json({ ok: false, message: "url is required." }, { status: 400 });
  }
  const id = await createWebhook({
    url: body.url,
    events: (body.events ?? []) as never[],
    secret: body.secret,
  });
  await recordAudit({ action: "webhook.create", entity: "webhook", entityId: id });
  return NextResponse.json({ ok: true, id });
}
