import { isProductionRuntime } from "@/lib/supabase/env";

describe("production configuration boundary", () => {
  it("recognizes APP_ENV production", () => {
    expect(isProductionRuntime({ APP_ENV: "production", NODE_ENV: "development" })).toBe(true);
  });

  it("recognizes NODE_ENV production when APP_ENV is absent", () => {
    expect(isProductionRuntime({ NODE_ENV: "production" })).toBe(true);
  });

  it("keeps local preview and test environments out of production mode", () => {
    expect(isProductionRuntime({ APP_ENV: "development", NODE_ENV: "development" })).toBe(false);
    expect(isProductionRuntime({ NODE_ENV: "test" })).toBe(false);
  });
});
