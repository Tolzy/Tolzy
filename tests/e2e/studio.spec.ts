import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/studio/sample");
  await expect(page.getByRole("radiogroup", { name: "Material preset" })).toBeVisible();
});

test("selecting a material can be undone and redone", async ({ page, isMobile }) => {
  const chrome = page.getByRole("radio", { name: "Chrome" });
  await chrome.click();
  await expect(chrome).toHaveAttribute("aria-checked", "true");

  if (isMobile) return; // undo/redo live in the desktop top bar
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("radio", { name: "Original" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(chrome).toHaveAttribute("aria-checked", "true");
});

test("context rail switches inspector panels", async ({ page }) => {
  const rail = page.getByRole("navigation", { name: "Properties" });
  await rail.getByRole("button", { name: "Motion" }).click();
  await expect(page.getByRole("complementary", { name: "Interaction properties" })).toBeVisible();
  await expect(page.getByText("Follow cursor")).toBeVisible();

  await rail.getByRole("button", { name: "Light" }).click();
  await expect(page.getByRole("radiogroup", { name: "Lighting preset" })).toBeVisible();
});

test("background setting drives the viewport", async ({ page }) => {
  await page.getByRole("navigation", { name: "Properties" }).getByRole("button", { name: "Scene" }).click();
  await page.getByRole("radio", { name: "Solid" }).click();
  await page.getByRole("radio", { name: "Paper" }).click();
  await expect(page.getByRole("region", { name: "3D viewport" })).toHaveCSS("background-color", "rgb(244, 243, 239)");
});

test("viewport toolbar controls zoom and cursor tracking", async ({ page }) => {
  const toolbar = page.getByRole("toolbar", { name: "Viewport" });
  await toolbar.getByRole("button", { name: "Zoom in" }).click();
  await expect(toolbar.getByText("110%")).toBeVisible();
  await toolbar.getByRole("button", { name: "Reset view" }).click();
  await expect(toolbar.getByText("100%")).toBeVisible();

  const tracking = toolbar.getByRole("button", { name: "Cursor tracking" });
  await expect(tracking).toHaveAttribute("aria-pressed", "true");
  await tracking.click();
  await expect(tracking).toHaveAttribute("aria-pressed", "false");
});

test("backslash toggles the properties panel on desktop", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop only");
  const panel = page.getByRole("complementary", { name: "Material properties" });
  await expect(panel).toBeVisible();
  await page.keyboard.press("\\");
  await expect(panel).toBeHidden();
  await page.keyboard.press("\\");
  await expect(panel).toBeVisible();
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("cursor tracking starts off", async ({ page }) => {
    await expect(
      page.getByRole("toolbar", { name: "Viewport" }).getByRole("button", { name: "Cursor tracking" }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});
