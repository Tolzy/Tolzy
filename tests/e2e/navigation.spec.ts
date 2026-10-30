import { expect, test } from "@playwright/test";

test("root redirects to the dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1, name: "Portraits" })).toBeVisible();
});

test("sample portrait opens the studio and back returns to the dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: /Sample head/ }).click();
  await expect(page).toHaveURL(/\/studio\/sample$/);
  await expect(page.getByRole("region", { name: "3D viewport" })).toBeVisible();
  await page.getByRole("link", { name: "Back to portraits" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("new portrait opens the creation flow", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "New portrait" }).first().click();
  await expect(page.getByRole("heading", { name: "Start with a photo" })).toBeVisible();
});

test("unknown portraits show the not-found page", async ({ page }) => {
  await page.goto("/studio/does-not-exist");
  await expect(page.getByRole("heading", { name: "This page doesn’t exist" })).toBeVisible();
});

test("app pages cannot be framed", async ({ request }) => {
  const res = await request.get("/dashboard");
  expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});

test("mobile navigation opens and navigates", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Projects" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
});
