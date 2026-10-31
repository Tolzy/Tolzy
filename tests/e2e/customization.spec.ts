import { expect, test, type Page } from "@playwright/test";

/*
 * Milestone 4 customisation: opacity, the colour picker, lighting adjustments,
 * backgrounds, undo/redo and saved settings — verified on the real renderer
 * through the viewer's data attributes (read back from three.js objects).
 */

test.describe.configure({ timeout: 120_000 });

const SETTLE = { timeout: 20_000 };
const surface = (page: Page) => page.getByTestId("viewer-surface");
const data = (page: Page, key: string) => surface(page).getAttribute(`data-${key}`);

async function openStudio(page: Page) {
  await page.goto("/studio/sample");
  await expect(page.getByRole("img", { name: "3D sample head" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("status").filter({ hasText: "Loading model" })).toHaveCount(0, { timeout: 30_000 });
  await expect(surface(page)).toHaveAttribute("data-material", "original", SETTLE);
}
const panel = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Properties" }).getByRole("button", { name }).click();
async function material(page: Page, name: string) {
  await page.getByRole("radiogroup", { name: "Material preset" }).getByRole("radio", { name }).click();
  await expect(surface(page)).toHaveAttribute("data-material", name.toLowerCase(), SETTLE);
}
async function slide(page: Page, name: string, key: string, times = 1) {
  const slider = page.getByRole("slider", { name, exact: true });
  await slider.focus();
  for (let i = 0; i < times; i++) await page.keyboard.press(key);
}

test.describe("material opacity", () => {
  test.beforeEach(async ({ page }) => openStudio(page));

  test("makes the whole surface translucent without inner-face artefacts", async ({ page }) => {
    await material(page, "Chrome");
    await page.getByRole("button", { name: "Adjust" }).click();
    await slide(page, "Opacity", "PageDown", 5); // 100 % → 50 %
    await expect(surface(page)).toHaveAttribute("data-opacity", "0.500", SETTLE);
    // A depth-only pre-pass is drawn so only the front-most surface blends.
    expect(Number(await data(page, "depth-prepass"))).toBeGreaterThan(0);
    // Shadows lighten with the surface.
    await expect.poll(async () => Number(await data(page, "shadow-intensity")), SETTLE).toBeCloseTo(0.5, 2);

    await slide(page, "Opacity", "End");
    await expect(surface(page)).toHaveAttribute("data-opacity", "1.000", SETTLE);
    await expect(surface(page)).toHaveAttribute("data-depth-prepass", "0", SETTLE);
  });

  test("Original keeps its textures; Glass has no opacity control", async ({ page }) => {
    await page.getByRole("button", { name: "Adjust" }).click();
    await slide(page, "Opacity", "PageDown", 4);
    await expect(surface(page)).toHaveAttribute("data-opacity", "0.600", SETTLE);
    // A translucent copy of the original material, not a preset material.
    await expect(surface(page)).toHaveAttribute("data-material-type", "MeshStandardMaterial");
    await expect(page.getByRole("slider", { name: "Roughness" })).toHaveCount(0);

    await material(page, "Glass");
    await expect(page.getByRole("slider", { name: "Opacity" })).toHaveCount(0);
    await expect(page.getByText("Glass is see-through by nature")).toBeVisible();

    // Back to Original at full opacity: the exact source materials again.
    await material(page, "Original");
    await expect(surface(page)).toHaveAttribute("data-opacity", "1.000", SETTLE);
    await expect(surface(page)).toHaveAttribute("data-depth-prepass", "0");
  });
});

test.describe("colour picker", () => {
  test.beforeEach(async ({ page }) => {
    await openStudio(page);
    await material(page, "Ceramic");
    await page.getByRole("button", { name: "Adjust" }).click();
    await page.getByRole("button", { name: /^Tint colour picker/ }).click();
    await expect(page.getByRole("dialog", { name: "Tint colour" })).toBeVisible();
  });

  test("every format shows the same colour and edits the real material", async ({ page }) => {
    const picker = page.getByRole("dialog", { name: "Tint colour" });
    const hex = picker.getByLabel("Tint hex", { exact: true });
    await hex.fill("3366CC");
    await hex.press("Enter");
    await expect(surface(page)).toHaveAttribute("data-material-color", "#3366cc", SETTLE);

    const format = picker.getByRole("combobox", { name: "Colour format" });
    const pick = async (name: string) => {
      await format.click();
      await page.getByRole("option", { name, exact: true }).click();
    };
    await pick("RGB");
    await expect(picker.getByLabel("Tint red", { exact: true })).toHaveValue("51");
    await expect(picker.getByLabel("Tint green", { exact: true })).toHaveValue("102");
    await expect(picker.getByLabel("Tint blue", { exact: true })).toHaveValue("204");
    await pick("HSL");
    await expect(picker.getByLabel("Tint hue", { exact: true })).toHaveValue("220");
    await expect(picker.getByLabel("Tint saturation", { exact: true })).toHaveValue("60");
    await expect(picker.getByLabel("Tint lightness", { exact: true })).toHaveValue("50");
    await pick("HSB");
    await expect(picker.getByLabel("Tint saturation", { exact: true })).toHaveValue("75");
    await expect(picker.getByLabel("Tint brightness", { exact: true })).toHaveValue("80");

    // Numeric input drives the renderer.
    await picker.getByLabel("Tint brightness", { exact: true }).fill("40");
    await picker.getByLabel("Tint brightness", { exact: true }).press("Enter");
    // HSB 220° 75 % 40 % = RGB (25.5, 51, 102): either rounding of the half step is correct.
    await expect(surface(page)).toHaveAttribute("data-material-color", /^#1[9a]3366$/, SETTLE);
    await pick("HEX");
    await expect(hex).toHaveValue(/^1[9A]3366$/);
  });

  test("spectrum and hue slider work by keyboard; recent colours persist", async ({ page }) => {
    const picker = page.getByRole("dialog", { name: "Tint colour" });
    const before = await data(page, "material-color");
    await picker.getByRole("slider", { name: "Tint saturation and brightness" }).focus();
    await page.keyboard.press("Shift+ArrowRight");
    await expect.poll(() => data(page, "material-color"), SETTLE).not.toBe(before);
    const afterSpectrum = await data(page, "material-color");
    await picker.getByRole("slider", { name: "Tint hue slider" }).focus();
    await page.keyboard.press("PageUp");
    await expect.poll(() => data(page, "material-color"), SETTLE).not.toBe(afterSpectrum);

    const recent = picker.getByRole("list", { name: "Recent colours" }).getByRole("button");
    await expect(recent.first()).toBeVisible();
    await page.reload();
    await expect(surface(page)).toHaveAttribute("data-material", "ceramic", SETTLE); // settings were saved
    await page.getByRole("button", { name: "Adjust" }).click();
    await page.getByRole("button", { name: /^Tint colour picker/ }).click();
    await expect(page.getByRole("list", { name: "Recent colours" }).getByRole("button").first()).toBeVisible();
  });

  test("copies and pastes colour values", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "clipboard permissions");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const picker = page.getByRole("dialog", { name: "Tint colour" });
    await picker.getByRole("button", { name: "Copy tint colour" }).click();
    await expect(picker.getByRole("status")).toHaveText(/Copied #F2EEE7/);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("#F2EEE7");

    await page.evaluate(() => navigator.clipboard.writeText("rgb(255 0 0)"));
    await picker.getByRole("button", { name: "Paste tint colour" }).click();
    await expect(surface(page)).toHaveAttribute("data-material-color", "#ff0000", SETTLE);

    // Pasting any format straight into a field applies it.
    await page.evaluate(() => navigator.clipboard.writeText("hsl(120 100% 25%)"));
    await picker.getByLabel("Tint hex", { exact: true }).focus();
    await page.keyboard.press("ControlOrMeta+V");
    await expect(surface(page)).toHaveAttribute("data-material-color", "#008000", SETTLE);
  });
});

test.describe("lighting adjustments", () => {
  test.beforeEach(async ({ page }) => {
    await openStudio(page);
    await panel(page, "Light");
    await page.getByRole("button", { name: "Adjust" }).click();
  });

  test("colour, ambient and shadow strength change the scene; reset restores the preset", async ({ page }) => {
    const colors = await data(page, "light-colors");
    const ambient = Number(await data(page, "ambient"));
    const env = Number(await data(page, "environment-intensity"));

    const field = page.getByLabel("Light colour", { exact: true });
    await field.fill("FFD2A1");
    await field.press("Enter");
    await expect.poll(() => data(page, "light-colors"), SETTLE).not.toBe(colors);

    await slide(page, "Ambient", "PageDown");
    await expect.poll(async () => Number(await data(page, "ambient")), SETTLE).toBeLessThan(ambient);
    await expect.poll(async () => Number(await data(page, "environment-intensity")), SETTLE).toBeLessThan(env);

    await slide(page, "Strength", "PageDown", 3);
    await expect.poll(async () => Number(await data(page, "shadow-intensity")), SETTLE).toBeCloseTo(0.7, 2);

    await page.getByRole("button", { name: "Reset to preset" }).click();
    await expect.poll(() => data(page, "light-colors"), SETTLE).toBe(colors);
    await expect.poll(async () => Number(await data(page, "shadow-intensity")), SETTLE).toBe(1);
    await expect(page.getByRole("button", { name: "Reset to preset" })).toBeDisabled();
  });
});

test.describe("scene background", () => {
  test.beforeEach(async ({ page }) => {
    await openStudio(page);
    await panel(page, "Scene");
  });

  test("presets and custom colours with opacity update the viewport only", async ({ page }) => {
    const bg = page.getByTestId("viewport-background");
    const lights = await data(page, "lights");
    await page.getByRole("radiogroup", { name: "Background preset" }).getByRole("radio", { name: "Midnight" }).click();
    await expect(bg).toHaveCSS("background-image", /rgb\(29, 36, 51\)/);

    await page.getByRole("radio", { name: "Solid", exact: true }).click();
    const colour = page.getByLabel("Colour", { exact: true });
    await colour.fill("336699");
    await colour.press("Enter");
    await expect(bg).toHaveCSS("background-color", "rgb(51, 102, 153)");

    // Opacity through the picker: the checkerboard shows through.
    await page.getByRole("button", { name: /^Colour colour picker/ }).click();
    const opacity = page.getByRole("dialog", { name: "Colour colour" }).getByLabel("Colour opacity percent");
    await opacity.fill("50");
    await opacity.press("Enter");
    await expect(bg).toHaveCSS("background-color", "rgba(51, 102, 153, 0.5)");
    await expect(page.getByRole("region", { name: "3D viewport" })).toHaveClass(/checkerboard/);
    // Material and lighting are untouched.
    await expect(surface(page)).toHaveAttribute("data-material", "original");
    expect(await data(page, "lights")).toBe(lights);
  });
});

test.describe("history and persistence", () => {
  test("undo and redo restore material and lighting changes", async ({ page, isMobile }) => {
    test.skip(isMobile, "undo/redo buttons live in the desktop top bar");
    await openStudio(page);
    await material(page, "Gold");
    await page.getByRole("button", { name: "Adjust" }).click();
    await slide(page, "Roughness", "PageUp");
    await expect.poll(() => data(page, "roughness"), SETTLE).not.toBe("0.160");

    const undo = page.getByRole("button", { name: "Undo" });
    await undo.click();
    await expect(surface(page)).toHaveAttribute("data-roughness", "0.160", SETTLE);
    await undo.click();
    await expect(surface(page)).toHaveAttribute("data-material", "original", SETTLE);
    await page.getByRole("button", { name: "Redo" }).click();
    await expect(surface(page)).toHaveAttribute("data-material", "gold", SETTLE);

    await panel(page, "Light");
    await page.getByRole("radiogroup", { name: "Lighting preset" }).getByRole("radio", { name: "Rim" }).click();
    await expect(surface(page)).toHaveAttribute("data-light-rig", "rim", SETTLE);
    await page.keyboard.press("ControlOrMeta+Z");
    await expect(surface(page)).toHaveAttribute("data-light-rig", "studio", SETTLE);
  });

  test("settings are saved on this device and restored after reload", async ({ page }) => {
    await openStudio(page);
    await material(page, "Obsidian");
    await panel(page, "Light");
    await page.getByRole("radiogroup", { name: "Lighting preset" }).getByRole("radio", { name: "Soft" }).click();
    await expect(surface(page)).toHaveAttribute("data-light-rig", "soft", SETTLE);
    await page.waitForTimeout(800); // debounced save
    await page.reload();
    await expect(surface(page)).toHaveAttribute("data-material", "obsidian", { timeout: 30_000 });
    await expect(surface(page)).toHaveAttribute("data-light-rig", "soft", SETTLE);
  });
});
