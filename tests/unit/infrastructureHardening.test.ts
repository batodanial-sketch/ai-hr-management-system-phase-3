jest.mock("server-only", () => ({}));

import { sendEmail } from "@/lib/email";
import { getStorageProvider, storageConfigured } from "@/lib/storage/provider";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("production external dependency fail-closed behavior", () => {
  test("email console mode cannot masquerade as delivery in production", async () => {
    process.env.APP_ENV = "production";
    delete process.env.EMAIL_PROVIDER;
    await expect(sendEmail({ to: "redacted@example.test", subject: "test" })).rejects.toThrow(
      "Email delivery is not configured in production",
    );
  });

  test("SMTP mode without a relay fails instead of falling back to console", async () => {
    process.env.APP_ENV = "production";
    process.env.EMAIL_PROVIDER = "smtp";
    delete process.env.EMAIL_HTTP_URL;
    await expect(sendEmail({ to: "redacted@example.test", subject: "test" })).rejects.toThrow(
      "SMTP mode requires EMAIL_HTTP_URL",
    );
  });

  test.each(["production", "Production", "PRODUCTION"]) (
    "production Storage cannot silently use the local filesystem (%s)",
    (environment) => {
      process.env.APP_ENV = environment;
      delete process.env.STORAGE_PROVIDER;
      expect(storageConfigured()).toBe(false);
      expect(() => getStorageProvider()).toThrow("Supabase Storage is required");
    },
  );
});
