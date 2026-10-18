import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * Playwright configuration for the Fluxentiq AI HR Management System.
 *
 * Environment variables consumed (set them in .env.local / CI):
 *   E2E_BASE_URL            — base URL of the running Next.js app (default http://localhost:3000)
 *   E2E_WEBSERVER_COMMAND   — optional override for the dev-server command launched by Playwright
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY          (or SUPABASE_SERVICE_ROLE_KEY)
 *   SUPABASE_PROJECT_REF
 *   E2E_TEST_USER_EMAIL
 *   E2E_TEST_USER_PASSWORD
 *   BRIDGE_SECRET_KEY       — shared secret for Next.js → Python bridge auth
 *   PYTHON_BRIDGE_ALLOWED_SCRAPE_HOSTS — comma-separated hosts the bridge may scrape
 *
 * Two long-lived processes are orchestrated by `webServer`:
 *   1. Next.js app            → http://localhost:3000
 *   2. Python AI bridge       → http://localhost:8000 (auth-gated via BRIDGE_SECRET_KEY)
 */

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const BRIDGE_URL = process.env.E2E_BRIDGE_URL ?? "http://localhost:8000";
const CI = Boolean(process.env.CI);

const STORAGE_STATE = path.join(process.cwd(), "e2e", ".auth", "storageState.json");
const SKIP_BRIDGE = process.env.E2E_BRIDGE_COMMAND === "true";

export default defineConfig({
  testDir: ".",
  testMatch: ["e2e/**/*.spec.ts", "tests/e2e/**/*.spec.ts"],
  // Several integration specs share deterministic seeded rows and remove
  // rows by source_tag in afterAll. The full DB-backed E2E job sets
  // E2E_SERIAL=1 to prevent separate files from racing those shared fixtures.
  // The hermetic, no-DB smoke job can still run independent files concurrently.
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: process.env.E2E_SERIAL === "1" ? 1 : CI ? 2 : undefined,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "playwright-report/results.json" }],
  ],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    storageState: STORAGE_STATE,
    // Chromium-first: capture a trace + screenshot + video on failure so any
    // red run is fully diagnosable. Traces are retained on failure only.
    trace: CI ? "retain-on-failure" : "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "en-US",
    timezoneId: "Asia/Karachi",
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      // Next.js application. E2E_ROLE_OVERRIDE_ENABLED is a strictly
      // header-gated test hook (see lib/rbac.ts) — it lets the rbac-boundaries
      // spec simulate under-privileged roles; it is inert for every other
      // request and never active in production builds.
      command: process.env.E2E_WEBSERVER_COMMAND ?? "npm run dev",
      // The E2E suite deliberately exercises many auth/API paths from one IP
      // in parallel. Keep rate limiting enabled but give that test-only server
      // enough headroom that unrelated tests do not 429 one another.
      env: {
        E2E_ROLE_OVERRIDE_ENABLED: "1",
        EDGE_AUTH_RATE_LIMIT: "500",
        EDGE_WEBHOOK_RATE_LIMIT: "500",
        EDGE_MODULE_RATE_LIMIT: "500",
        EDGE_COPILOT_RATE_LIMIT: "500",
      },
      url: BASE_URL,
      reuseExistingServer: !CI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    ...(SKIP_BRIDGE
      ? []
      : [
          {
            // Python AI bridge (reads .env.local for BRIDGE_SECRET_KEY + scrape hosts).
            command: process.env.E2E_BRIDGE_COMMAND ?? "python3 -m uvicorn server:app --host 0.0.0.0 --port 8000",
            url: `${BRIDGE_URL}/health`,
            reuseExistingServer: !CI,
            timeout: 120_000,
            stdout: "pipe" as const,
            stderr: "pipe" as const,
          },
        ]),
  ],
});
