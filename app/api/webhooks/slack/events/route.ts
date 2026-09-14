import { verifySlackSignature } from "@/lib/security/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Slack Events API ingress. Authentication is performed over the exact raw
 * request body using Slack's timestamped v0 HMAC contract. Event processing is
 * intentionally limited until a tenant-specific Slack installation/config is
 * available; authenticated URL-verification/event acknowledgements do not
 * claim that downstream business processing occurred.
 */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");
  if (!verifySlackSignature(rawBody, timestamp, signature, process.env.SLACK_SIGNING_SECRET)) {
    return Response.json({ success: false, error: "Unauthorized Slack event." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ success: false, error: "Invalid Slack event body." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") {
    return Response.json({ success: false, error: "Invalid Slack event body." }, { status: 400 });
  }
  const event = payload as Record<string, unknown>;
  if (event.type === "url_verification" && typeof event.challenge === "string") {
    return Response.json({ challenge: event.challenge }, { status: 200 });
  }

  // Acknowledgement only: no tenant-bound business mutation is performed by
  // this route until a verified Slack installation is resolved.
  return Response.json({ success: true, acknowledged: true }, { status: 200 });
}
