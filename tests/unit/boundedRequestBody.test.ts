import { readBoundedRequestBody } from "@/lib/security/bounded-request-body";

describe("readBoundedRequestBody", () => {
  it("rejects a body early when Content-Length exceeds the byte limit", async () => {
    const request = new Request("https://example.test/webhook", {
      method: "POST",
      headers: { "content-length": "11" },
      body: "hello world",
    });

    await expect(readBoundedRequestBody(request, 10)).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("rejects oversized bodies while streaming even without Content-Length", async () => {
    const request = new Request("https://example.test/webhook", {
      method: "POST",
      body: "a".repeat(1024),
    });
    request.headers.delete("content-length");

    await expect(readBoundedRequestBody(request, 100)).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("counts UTF-8 bytes rather than JavaScript characters", async () => {
    const request = new Request("https://example.test/webhook", {
      method: "POST",
      body: "é",
    });
    request.headers.delete("content-length");

    await expect(readBoundedRequestBody(request, 2)).resolves.toEqual({
      ok: true,
      text: "é",
      bytes: 2,
    });
  });

  it("returns the complete body when within the configured limit", async () => {
    const request = new Request("https://example.test/webhook", {
      method: "POST",
      body: JSON.stringify({ event: "workflow.completed" }),
    });
    request.headers.delete("content-length");
    const expected = JSON.stringify({ event: "workflow.completed" });

    await expect(readBoundedRequestBody(request, 1024)).resolves.toEqual({
      ok: true,
      text: expected,
      bytes: new TextEncoder().encode(expected).byteLength,
    });
  });
});
