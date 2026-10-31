import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("dark is the default theme", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("light theme can be chosen and persists across visits", async ({ page }) => {
  await page.goto("/settings/appearance");
  await page.getByRole("radio", { name: /Light/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.goto("/dashboard");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.goto("/settings/appearance");
  await page.getByRole("radio", { name: /Dark/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("the theme menu switches the whole app immediately, from the Studio too", async ({ page, isMobile }) => {
  await page.goto("/studio/sample");
  await expect(page.getByTestId("viewer-surface")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Theme: Dark" }).click();
  await page.getByRole("menuitemradio", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect
    .poll(() => bgLuma(page.getByRole("complementary", { name: "Material properties" })))
    .toBeGreaterThan(200);
  // The stage stays dark.
  await expect(page.getByTestId("viewport-background")).toHaveCSS("background-image", /rgb\(31, 31, 35\)/);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  // Sidebar menu on the dashboard (desktop sidebar), back to dark.
  if (isMobile) return;
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Theme: Light" }).first().click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("the saved theme is applied before first paint (no flash)", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("ps-theme", "light");
    const seen: string[] = [];
    (window as unknown as { __themes: string[] }).__themes = seen;
    new MutationObserver(() => seen.push(document.documentElement.dataset.theme ?? "")).observe(
      document.documentElement,
      {
        attributes: true,
        attributeFilter: ["data-theme"],
      },
    );
  });
  await page.goto("/dashboard");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const themes = await page.evaluate(() => (window as unknown as { __themes: string[] }).__themes);
  expect(themes.every((t) => t === "light")).toBe(true);
});

const PAGES = ["/dashboard", "/projects", "/settings", "/settings/appearance", "/settings/storage", "/create"];

for (const theme of ["dark", "light"] as const) {
  test(`every major page follows the ${theme} theme`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("ps-theme", t), theme);
    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      const luma = await bgLuma(page.locator("h1").first());
      if (theme === "light") expect(luma, path).toBeGreaterThan(200);
      else expect(luma, path).toBeLessThan(60);
    }
  });
}

test.describe("light theme accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("ps-theme", "light"));
  });

  for (const path of [
    "/dashboard",
    "/projects",
    "/settings",
    "/settings/appearance",
    "/settings/storage",
    "/create",
    "/studio/sample",
  ]) {
    test(`${path} has no serious violations in light`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious, JSON.stringify(serious.map((v) => [v.id, v.nodes.map((n) => n.target)]))).toEqual([]);
    });
  }
});

/** Luminance (0–255) of the background an element is drawn on (nearest painted ancestor). */
async function bgLuma(locator: import("@playwright/test").Locator) {
  return locator.evaluate((start) => {
    for (let el: Element | null = start; el; el = el.parentElement) {
      const css = getComputedStyle(el).backgroundColor;
      const n = css.match(/[\d.]+/g)!.map(Number);
      // oklab()/oklch(): perceptual lightness L (0–1) is a fine proxy here.
      if (css.startsWith("okl")) {
        if (n.length === 3 || n[3] > 0.5) return n[0] * 255;
        continue;
      }
      // "rgb(r g b / a)" uses 0–255; "color(srgb r g b / a)" uses 0–1.
      const scale = css.startsWith("color(") ? 255 : 1;
      const m = n.map((v, i) => (i < 3 ? v * scale : v));
      if (m.length === 3 || m[3] > 0.5) return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
    }
    return -1;
  });
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`studio in ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("ps-theme", t), theme);
      await page.goto("/studio/sample");
      await expect(page.getByTestId("viewer-surface")).toHaveAttribute("data-material", "original", {
        timeout: 30_000,
      });
    });

    test("interface chrome follows the theme; the viewport stays dark", async ({ page }) => {
      const light = theme === "light";
      const expectThemed = async (luma: number) =>
        light ? expect(luma).toBeGreaterThan(200) : expect(luma).toBeLessThan(60);

      await expectThemed(await bgLuma(page.locator("body")));
      await expectThemed(await bgLuma(page.getByRole("toolbar", { name: "Viewport" })));
      await expectThemed(await bgLuma(page.getByRole("complementary", { name: "Material properties" })));

      // The viewport is the same dark studio in both themes.
      const viewport = page.getByTestId("viewport-background");
      await expect(viewport).toHaveCSS("background-image", /radial-gradient\(.*rgb\(31, 31, 35\).*rgb\(11, 11, 12\)/);

      // Overlays: the share dialog follows the theme too.
      await page.getByRole("button", { name: "Share" }).first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      // Polled: the dialog animates in.
      if (light) await expect.poll(() => bgLuma(dialog)).toBeGreaterThan(200);
      else await expect.poll(() => bgLuma(dialog)).toBeLessThan(60);
    });

    test("the theme never changes the model, materials or lighting", async ({ page }) => {
      const surface = page.getByTestId("viewer-surface");
      await expect(surface).toHaveAttribute("data-light-rig", "studio", { timeout: 20_000 });
      // Identical values in both theme runs: these come from the scene itself.
      await expect(surface).toHaveAttribute("data-material-type", "MeshStandardMaterial");
      await expect(surface).toHaveAttribute("data-lights", "-2.2,2.4,2.6@2.10s;2.6,1.6,-2.4@2.20;-2.4,-0.4,-1.8@0.60");
      await expect(surface).toHaveAttribute("data-yaw", "0.00");
    });
  });
}
