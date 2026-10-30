import { expect, test, type Page } from "@playwright/test";

// Exposes gc() so heap measurements are stable. Keeps the software-WebGL flags from the config.
test.use({
  launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--js-flags=--expose-gc"] },
});
test.skip(({ isMobile }) => isMobile, "heap measurement runs once, on desktop");

async function heapMB(page: Page) {
  return page.evaluate(async () => {
    const w = window as unknown as { gc?: () => void; performance: { memory?: { usedJSHeapSize: number } } };
    for (let i = 0; i < 3; i++) {
      w.gc?.();
      await new Promise((r) => setTimeout(r, 100));
    }
    return (w.performance.memory?.usedJSHeapSize ?? 0) / 1024 / 1024;
  });
}

async function visitStudio(page: Page) {
  await page.getByRole("link", { name: /Sample head/ }).click();
  await expect(page.getByRole("img", { name: "3D sample head" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Loading model" })).toHaveCount(0, { timeout: 30_000 });
  const box = (await page.locator("[data-viewport]").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.3, { steps: 4 });
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4, { steps: 6 });
  await page.mouse.up();
  await page.getByRole("link", { name: "Back to portraits" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("repeated studio visits with interaction do not leak memory or log errors", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/dashboard");
  await visitStudio(page);
  await visitStudio(page); // warm-up: caches and lazily loaded code are now resident
  const baseline = await heapMB(page);
  for (let i = 0; i < 6; i++) await visitStudio(page);
  const after = await heapMB(page);

  console.log(`JS heap after warm-up ${baseline.toFixed(1)} MB, after 6 more visits ${after.toFixed(1)} MB`);
  expect(after - baseline).toBeLessThan(12);
  expect(errors).toEqual([]);
});
