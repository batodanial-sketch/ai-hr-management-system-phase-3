import { expect, test } from "../fixtures/customTest";

/**
 * Visual regression suite: pixel-diff screenshot assertions for the dashboard
 * and analytics surfaces.
 *
 * Baselines live in Playwright's
 * visual-regression.spec.ts-snapshots directory and are committed. These tests
 * use deterministic demo-mode data, not a database-specific view. CI fails when the diff exceeds
 * maxDiffPixelRatio, which is tuned to tolerate sub-pixel font rendering.
 */
test.describe("Visual regression", () => {
  test.skip(
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    "Pixel baselines use deterministic demo data; DB-backed behavior is verified by functional E2E tests.",
  );

  test("dashboard matches the golden baseline", async ({ page, dashboardPage }) => {
    await dashboardPage.goto();
    await expect(page).toHaveScreenshot("dashboard.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test("analytics matches the golden baseline", async ({ page, analyticsPage }) => {
    await analyticsPage.goto();
    await analyticsPage.expectAllChartsLoaded();
    await expect(page).toHaveScreenshot("analytics.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});
