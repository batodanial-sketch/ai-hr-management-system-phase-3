import { createHmac } from "node:crypto";
import { verifySlackSignature } from "@/lib/security/slack";

const SECRET = "slack-test-secret";
const BODY = JSON.stringify({ type: "event_callback", event: { type: "app_mention" } });
const NOW = 1_700_000_000_000;
const TIMESTAMP = String(Math.floor(NOW / 1000));

function signature(body = BODY, timestamp = TIMESTAMP): string {
  return `v0=${createHmac("sha256", SECRET).update(`v0:${timestamp}:${body}`).digest("hex")}`;
}

describe("Slack webhook signature verification", () => {
  it("accepts the exact timestamped v0 HMAC", () => {
    expect(verifySlackSignature(BODY, TIMESTAMP, signature(), SECRET, NOW)).toBe(true);
  });

  it("rejects body tampering, missing data, and stale timestamps", () => {
    expect(verifySlackSignature(`${BODY}x`, TIMESTAMP, signature(), SECRET, NOW)).toBe(false);
    expect(verifySlackSignature(BODY, null, signature(), SECRET, NOW)).toBe(false);
    expect(verifySlackSignature(BODY, TIMESTAMP, signature(), undefined, NOW)).toBe(false);
    expect(verifySlackSignature(BODY, String(Number(TIMESTAMP) - 301), signature(BODY, String(Number(TIMESTAMP) - 301)), SECRET, NOW)).toBe(false);
  });
});
