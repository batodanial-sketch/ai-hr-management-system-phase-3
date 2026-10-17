import { expect, test, type Page } from "@playwright/test";

/**
 * 3D WebGL & theme visuals.
 *
 * Verifies the landing hero mounts its lazy-loaded R3F canvas, that the
 * Metropolis Light/Dark tokens flip correctly on theme change, and that a
 * WebGL-less environment degrades to the token-driven CSS gradient fallback
 * instead of crashing.
 *
 * Runs unauthenticated against the public marketing surface (`/`), so no
 * storageState is required.
 */
test.use({ storageState: { cookies: [], origins: [] } });

/** Reads a computed CSS custom property off the document root. */
async function tokenValue(page: Page, property: string): Promise<string> {
  return page.evaluate(
    (prop) =>
      getComputedStyle(document.documentElement).getPropertyValue(prop).trim(),
    property,
  );
}

test.describe("Landing visuals", () => {
  test("hero renders its canvas or the documented CSS fallback", async ({ page }) => {
    await page.goto("/");

    const hero = page.getByLabel("Fluxentiq 3D hero visual");
    const canvas = hero.locator("canvas");
    const fallback = hero.locator('[aria-hidden="true"]').first();

    await expect(hero).toBeVisible();

    // WebGL is not guaranteed on every CI runner. If the scene cannot mount,
    // the hero must still render its token-driven background instead of going
    // blank or crashing. On WebGL-capable runners, the canvas is checked too.
    await expect.poll(async () => (await canvas.count()) > 0 || await fallback.isVisible(), {
      timeout: 20_000,
    }).toBe(true);

    if ((await canvas.count()) === 0) {
      const backgroundImage = await fallback.evaluate((element) =>
        getComputedStyle(element).backgroundImage,
      );
      expect(backgroundImage).toContain("gradient");
    }
  });

  test("theme toggles the Metropolis light/dark tokens", async ({ page }) => {
    await page.goto("/");

    // Default brand identity is dark.
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(await tokenValue(page, "--bg-base")).toBe("#020510");

    // Switch to light and confirm the token + class flip.
    await page.evaluate(() => localStorage.setItem("fluxentiq.theme", "light"));
    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    expect(await tokenValue(page, "--bg-base")).toBe("#F8FAFC");

    // And back to dark.
    await page.evaluate(() => localStorage.setItem("fluxentiq.theme", "dark"));
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(await tokenValue(page, "--bg-base")).toBe("#020510");
  });

  test("falls back to the CSS gradient when WebGL is disabled", async ({ browser }) => {
    const context = await browser.newContext();
    // Stub out WebGL context creation so the R3F canvas cannot initialize.
    await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...args: unknown[]
      ) {
        if (typeof type === "string" && type.toLowerCase().includes("webgl")) {
          return null;
        }
        return original.call(this, type, ...(args as Parameters<typeof original>));
      } as typeof HTMLCanvasElement.prototype.getContext;
    });

    const page = await context.newPage();
    await page.goto("/");

    const hero = page.getByLabel("Fluxentiq 3D hero visual");
    await expect(hero).toBeVisible();

    // No WebGL canvas mounts; the error boundary keeps the gradient fallback.
    await expect(hero.locator("canvas")).toHaveCount(0);

    // The token-driven gradient fallback layer is present.
    await expect(hero.locator('[aria-hidden="true"]').first()).toBeVisible();

    await context.close();
  });
});
