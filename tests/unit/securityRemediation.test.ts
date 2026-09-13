jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("react", () => ({ ...jest.requireActual("react"), cache: (fn: unknown) => fn }));

import { isGraphqlRoleAllowed } from "@/lib/graphql/security";
import { isBlockedIp, parseSafeOutboundUrl } from "@/lib/security/outbound";
import { signedWebhookBody, verifyTimestamp, verifyTimestampedHmac } from "@/lib/security/webhook-replay";
import { createHmac } from "node:crypto";

describe("GraphQL authorization boundary", () => {
  it("allows only HR administrators and owners", () => {
    expect(isGraphqlRoleAllowed("EMPLOYEE")).toBe(false);
    expect(isGraphqlRoleAllowed("MANAGER")).toBe(false);
    expect(isGraphqlRoleAllowed("HR_ADMIN")).toBe(true);
    expect(isGraphqlRoleAllowed("SUPER_ADMIN")).toBe(true);
  });
});

describe("outbound URL policy", () => {
  it.each(["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "::1", "fd00::1"])("blocks private address %s", (address) => {
    expect(isBlockedIp(address)).toBe(true);
  });

  it.each(["http://127.0.0.1", "http://localhost", "ftp://example.com", "https://user:pass@example.com", "https://example.com:8443"])("rejects unsafe URL %s", (url) => {
    expect(() => parseSafeOutboundUrl(url)).toThrow();
  });

  it("accepts a public HTTPS provider URL", () => {
    expect(parseSafeOutboundUrl("https://api.example.com/v1").hostname).toBe("api.example.com");
  });
});

describe("timestamped webhook signatures", () => {
  it("accepts a fresh signature and rejects replay-window timestamps", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ event: "workflow.completed" });
    const secret = "test-secret";
    const signature = createHmac("sha256", secret).update(signedWebhookBody(timestamp, body)).digest("hex");
    expect(verifyTimestamp(timestamp, Date.now())).toBe(true);
    expect(verifyTimestampedHmac(body, timestamp, signature, secret)).toBe(true);
    expect(verifyTimestampedHmac(body, String(Number(timestamp) - 601), signature, secret)).toBe(false);
    expect(verifyTimestampedHmac(body, timestamp, signature, "wrong-secret")).toBe(false);
  });
});
