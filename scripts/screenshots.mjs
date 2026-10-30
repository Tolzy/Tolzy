// Captures the main screens at several widths for visual review.
// Usage: node scripts/screenshots.mjs [baseUrl] [outDir]
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "screenshots";
const pages = ["/dashboard", "/projects", "/settings/storage", "/create", "/studio/sample"];
const widths = [
  { w: 1440, h: 900 },
  { w: 1024, h: 768 },
  { w: 390, h: 844 },
];

const browser = await chromium.launch();
for (const { w, h } of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  for (const path of pages) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${out}/${path.slice(1).replaceAll("/", "-")}-${w}.png` });
  }
  await page.close();
}
await browser.close();
