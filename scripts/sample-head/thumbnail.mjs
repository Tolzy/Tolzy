// Renders the dashboard thumbnail for the sample head from the real studio renderer.
// Usage: node scripts/sample-head/thumbnail.mjs [baseUrl]   (app must be running)
import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3000";
const out = "public/models/sample-head/thumbnail.webp";

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(`${base}/studio/sample`, { waitUntil: "networkidle" });
await page.getByRole("img", { name: "3D sample head" }).waitFor();
await page.waitForFunction(() => !document.querySelector('[role="status"]'));
await page.keyboard.press("\\"); // hide the properties panel
await page.addStyleTag({
  content: '[role="toolbar"], section[aria-label="3D viewport"] > div.absolute.top-3 { display: none !important; }',
});
await page.waitForTimeout(800);

const box = await page.getByRole("region", { name: "3D viewport" }).boundingBox();
const height = box.height;
const width = Math.round(height * 0.8); // 4:5 tile
const png = await page.screenshot({ clip: { x: box.x + (box.width - width) / 2, y: box.y, width, height } });

const webp = await page.evaluate(async (b64) => {
  const img = new Image();
  img.src = `data:image/png;base64,${b64}`;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 800;
  c.getContext("2d").drawImage(img, 0, 0, 640, 800);
  return c.toDataURL("image/webp", 0.86).split(",")[1];
}, png.toString("base64"));

await writeFile(out, Buffer.from(webp, "base64"));
console.log(`wrote ${out} (${Math.round(Buffer.from(webp, "base64").length / 1024)} KB)`);
await browser.close();
