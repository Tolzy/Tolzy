// Renders "photos" of the CC0 sample head for the photo-check tests (no real
// person's photo is used). Usage: npm run dev, then
//   node scripts/fixtures/render-photo-fixtures.mjs [baseUrl]
// then: python3 scripts/fixtures/derive-photo-fixtures.py
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3000";
const out = "tests/fixtures/photos/source";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto(`${base}/studio/sample`, { waitUntil: "networkidle" });
const surface = page.getByTestId("viewer-surface");
await page.waitForFunction(() => document.querySelector("[data-testid=viewer-surface]")?.dataset.material, null, {
  timeout: 60000,
});
// Clean stage: hide the inspector, stop tracking, a neutral solid background.
await page.keyboard.press("\\");
await page.getByRole("toolbar", { name: "Viewport" }).getByRole("button", { name: "Cursor tracking" }).click();
await page.mouse.move(5, 5);
await page.waitForTimeout(1500);
const box = await page.locator("[data-viewport]").boundingBox();
const clip = { x: box.x + box.width / 2 - 330, y: box.y + 30, width: 660, height: 800 };

const shoot = async (name, presses, key) => {
  await surface.focus();
  for (let i = 0; i < presses; i++) await page.keyboard.press(key);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/${name}.png`, clip });
  console.log("rendered", name, await surface.getAttribute("data-manual-yaw"));
};
await shoot("front", 0, "ArrowLeft");
await shoot("three-quarter", 4, "ArrowLeft"); // 40°
await shoot("profile", 5, "ArrowLeft"); // 90°
await browser.close();
