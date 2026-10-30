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

test.describe("light theme accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("ps-theme", "light"));
  });

  for (const path of ["/dashboard", "/settings/appearance", "/studio/sample"]) {
    test(`${path} has no serious violations in light`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious, JSON.stringify(serious.map((v) => [v.id, v.nodes.map((n) => n.target)]))).toEqual([]);
    });
  }
});
