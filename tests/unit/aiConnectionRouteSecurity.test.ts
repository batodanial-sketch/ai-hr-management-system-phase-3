jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/ai-proxy", () => ({ bridgeSecret: jest.fn(() => ""), bridgeUrl: jest.fn(() => "https://bridge.example.com") }));
jest.mock("@/lib/rbac", () => ({
  getRbacContext: jest.fn(),
  rbacErrorResponse: jest.fn(() => null),
}));
jest.mock("@/lib/auth", () => ({ roleAtLeast: jest.fn(() => true) }));
jest.mock("@/lib/license", () => ({ getLicenseState: jest.fn(async () => ({ tier: "enterprise" })) }));
jest.mock("@/lib/settings/config", () => ({ readSettings: jest.fn(async () => ({ ai: { provider: "groq", model: "", baseUrl: "" } })) }));
jest.mock("@/lib/security/outbound", () => ({
  assertSafeOutboundUrl: jest.fn(async () => new URL("https://api.example.com/v1/chat/completions")),
  UnsafeOutboundUrlError: class extends Error {},
}));

import { POST } from "@/app/api/ai/test-connection/route";
import { getRbacContext } from "@/lib/rbac";

describe("AI connection route authorization", () => {
  it("rejects before parsing or forwarding when canonical auth fails", async () => {
    (getRbacContext as jest.Mock).mockRejectedValueOnce(new Error("unauthenticated"));
    const response = await POST(new Request("http://localhost/api/ai/test-connection", {
      method: "POST",
      body: JSON.stringify({ provider: "groq" }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(401);
  });
});
