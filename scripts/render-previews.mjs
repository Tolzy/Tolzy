// Renders the inspector's preset previews with the studio's own viewer,
// material system and light rigs (development route /dev/preview-renders).
// Usage: npm run dev, then: node scripts/render-previews.mjs [baseUrl]
// Writes public/previews/{material,lighting}-<preset>.webp.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const base = process.argv[2] ?? "http://localhost:3000";
const out = "public/previews";
const SIZE = 192; // 2x the largest tile size

const jobs = [
  ...["chrome", "obsidian", "ceramic", "glass", "gold"].map((id) => ({
    name: `material-${id}`,
    query: `material=${id}`,
  })),
  ...["studio", "dramatic", "soft", "rim", "neutral"].map((id) => ({
    name: `lighting-${id}`,
    query: `lighting=${id}`,
  })),
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
for (const job of jobs) {
  await page.goto(`${base}/dev/preview-renders?${job.query}`, { waitUntil: "networkidle" });
  const surface = page.getByTestId("viewer-surface");
  await surface.waitFor();
  await page.getByRole("status").filter({ hasText: "Loading model" }).waitFor({ state: "detached", timeout: 60_000 });
  await page.waitForTimeout(2500); // environment, shadows and transmission settle
  const png = `${out}/${job.name}.png`;
  await page.locator("[data-preview]").screenshot({ path: png });
  // Resize and encode with ffmpeg (already used for recordings); keeps deps unchanged.
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    png,
    "-vf",
    `scale=${SIZE}:${SIZE}:flags=lanczos`,
    "-c:v",
    "libwebp",
    "-quality",
    "86",
    `${out}/${job.name}.webp`,
  ]);
  execFileSync("rm", [png]);
  console.log("rendered", job.name);
}
await browser.close();
