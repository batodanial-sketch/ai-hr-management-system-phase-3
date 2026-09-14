import { createHmac, timingSafeEqual } from "node:crypto";

export const SLACK_MAX_CLOCK_SKEW_SECONDS = 300;

/** Verifies Slack's v0 timestamped signing contract without exposing secrets. */
export function verifySlackSignature(
  rawBody: string,
  timestamp: string | null,
  received: string | null,
  secret: string | undefined,
  now = Date.now(),
): boolean {
  if (!timestamp || !received || !secret || !/^\d{10}$/.test(timestamp)) return false;
  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > SLACK_MAX_CLOCK_SKEW_SECONDS * 1000) return false;
  const base = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${createHmac("sha256", secret).update(base).digest("hex")}`;
  const expectedBytes = Buffer.from(expected, "utf8");
  const receivedBytes = Buffer.from(received, "utf8");
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}
