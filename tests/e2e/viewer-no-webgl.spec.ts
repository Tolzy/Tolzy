import { expect, test } from "@playwright/test";

// A browser without WebGL: the studio must explain itself and keep working.
test.use({ launchOptions: { args: ["--disable-webgl", "--disable-3d-apis"] } });

test("explains that 3D is unavailable", async ({ page }) => {
  await page.goto("/studio/sample");
  await expect(page.getByRole("alert").filter({ hasText: "3D isn’t available in this browser" })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Material preset" })).toBeVisible();
});
