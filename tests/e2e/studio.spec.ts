import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/studio/sample");
  await expect(page.getByRole("radiogroup", { name: "Material preset" })).toBeVisible();
  // The panel is server-rendered; the 3D viewer only mounts once the page is
  // interactive, so wait for it before using keyboard shortcuts.
  await expect(page.getByTestId("viewer-surface")).toBeVisible();
});

test("a setting change can be undone and redone", async ({ page, isMobile }) => {
  test.skip(isMobile, "undo/redo live in the desktop top bar");
  await page.getByRole("navigation", { name: "Properties" }).getByRole("button", { name: "Scene" }).click();
  const solid = page.getByRole("radio", { name: "Solid" });
  await solid.click();
  await expect(solid).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("radio", { name: "Gradient" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(solid).toHaveAttribute("aria-checked", "true");
});

test("controls that do not work yet are disabled and labelled", async ({ page }) => {
  const rail = page.getByRole("navigation", { name: "Properties" });
  // Exports: Milestone 8.
  await rail.getByRole("button", { name: "Export" }).click();
  await expect(page.getByText("GLB downloads and PNG renders are coming in Milestone 8.")).toBeVisible();
  for (const name of ["1×", "2×", "4×"]) await expect(page.getByRole("radio", { name })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Render PNG" })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("button", { name: "Download GLB · Original" })).toHaveAttribute("aria-disabled", "true");

  // Public embeds: Milestone 9.
  await page.getByRole("button", { name: "Share and embed" }).click();
  await expect(page.getByRole("radio", { name: /Public embed/ })).toBeDisabled();
  await expect(page.getByText(/Public embeds are coming in Milestone 9/)).toBeVisible();
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
