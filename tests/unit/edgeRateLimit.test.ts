import { edgeRateCategoryFor } from "@/lib/edge/rate-limit";

describe("edgeRateCategoryFor", () => {
  it("does not rate-limit public authentication page navigation as API traffic", () => {
    expect(edgeRateCategoryFor("/login")).toBeNull();
    expect(edgeRateCategoryFor("/signup")).toBeNull();
    expect(edgeRateCategoryFor("/auth/license")).toBeNull();
  });

  it("keeps authentication API endpoints rate-limited", () => {
    expect(edgeRateCategoryFor("/api/auth/sso-callback")).toBe("auth");
    expect(edgeRateCategoryFor("/api/auth/request-access")).toBe("auth");
  });

  it("keeps integration and AI endpoints in their own rate-limit categories", () => {
    expect(edgeRateCategoryFor("/api/webhooks/inbound/provider")).toBe("webhook");
    expect(edgeRateCategoryFor("/api/ai/copilot")).toBe("copilot");
    expect(edgeRateCategoryFor("/api/employees")).toBe("module");
  });
});
