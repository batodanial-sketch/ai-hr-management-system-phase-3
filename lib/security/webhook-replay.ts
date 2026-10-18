import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { adminClient, hasSupabaseEnv } from "@/lib/supabase/server";

export const WEBHOOK_MAX_CLOCK_SKEW_SECONDS = 300;

export function signedWebhookBody(timestamp: string, rawBody: string): string {
  return `${timestamp}.${rawBody}`;
}

export function verifyTimestamp(timestamp: string | null, now = Date.now()): boolean {
  if (!timestamp || !/^\d{10,13}$/.test(timestamp)) return false;
  const milliseconds = timestamp.length === 10 ? Number(timestamp) * 1000 : Number(timestamp);
  if (!Number.isFinite(milliseconds)) return false;
  return Math.abs(now - milliseconds) <= WEBHOOK_MAX_CLOCK_SKEW_SECONDS * 1000;
}

export function verifyTimestampedHmac(rawBody: string, timestamp: string | null, received: string | null, secret: string): boolean {
  if (!timestamp || !received || !secret || !verifyTimestamp(timestamp)) return false;
  const expected = createHmac("sha256", secret).update(signedWebhookBody(timestamp, rawBody)).digest("hex");
  const actual = received.startsWith("sha256=") ? received.slice(7) : received;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

/** Atomically claims a machine event id through the unique database key. */
export async function claimWebhookReplay(input: {
  provider: string;
  eventId: string;
  organizationId: string;
  rawBody: string;
}): Promise<"claimed" | "duplicate" | "unavailable"> {
  if (!hasSupabaseEnv()) return "unavailable";
  const eventId = input.eventId.trim();
  if (!eventId || eventId.length > 240) return "duplicate";
  const db = adminClient();
  const { error } = await db.from("webhook_replay_nonces").insert({
    provider: input.provider,
    event_id: eventId,
    organization_id: input.organizationId,
    payload_hash: createHash("sha256").update(input.rawBody).digest("hex"),
  });
  if (!error) return "claimed";
  if (error.code === "23505") return "duplicate";
  return "unavailable";
}
