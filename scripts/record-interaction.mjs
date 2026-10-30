// Records a demo of cursor tracking and manual rotation (WebM) with a visible cursor.
// Usage: node scripts/record-interaction.mjs <outDir> [baseUrl]   (app must be running)
import { chromium } from "@playwright/test";
const out = process.argv[2] ?? "recordings";
const base = process.argv[3] ?? "http://localhost:3000";
const W = 1280,
  H = 800;
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await b.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: out, size: { width: W, height: H } },
});
// Visible cursor for the recording (headless video does not draw the pointer).
await ctx.addInitScript(() => {
  addEventListener("DOMContentLoaded", () => {
    const d = document.createElement("div");
    d.style.cssText =
      "position:fixed;z-index:99999;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(255,255,255,.85);box-shadow:0 0 0 2px rgba(0,0,0,.35);pointer-events:none;transition:transform .08s;left:-50px;top:-50px";
    document.body.appendChild(d);
    addEventListener(
      "pointermove",
      (e) => {
        d.style.left = e.clientX + "px";
        d.style.top = e.clientY + "px";
      },
      true,
    );
    addEventListener("pointerdown", () => (d.style.transform = "scale(.7)"), true);
    addEventListener("pointerup", () => (d.style.transform = ""), true);
  });
});
const p = await ctx.newPage();
await p.goto(`${base}/studio/sample`, { waitUntil: "networkidle" });
await p.waitForFunction(() => !document.querySelector('[role="status"]'));
await p.getByRole("navigation", { name: "Properties" }).getByRole("button", { name: "Motion" }).click();
const box = await p.locator("[data-viewport]").boundingBox();
const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
const glide = async (fx, fy, steps = 10, pause = 600) => {
  const [x, y] = at(fx, fy);
  await p.mouse.move(x, y, { steps });
  await p.waitForTimeout(pause);
};

await p.mouse.move(...at(0.5, 0.45));
await p.waitForTimeout(800);
// 1. Cursor tracking around the head
for (const [fx, fy] of [
  [0.92, 0.4],
  [0.85, 0.08],
  [0.15, 0.1],
  [0.08, 0.7],
  [0.5, 0.92],
  [0.55, 0.45],
])
  await glide(fx, fy, 10, 1100);
// 2. Leave the viewport -> returns to neutral
await glide(1.25, 0.3, 8, 2000);
// 3. Drag to rotate, release -> eases back
await glide(0.3, 0.45, 8, 400);
await p.mouse.down();
await glide(0.75, 0.4, 14, 300);
await p.mouse.up();
await p.waitForTimeout(2200);
// 4. Hold mode: drag to a three-quarter view, then tracking adds on top
await p.getByRole("radio", { name: "Hold" }).click();
await glide(0.35, 0.45, 8, 300);
await p.mouse.down();
await glide(0.62, 0.45, 10, 200);
await p.mouse.up();
await p.waitForTimeout(900);
for (const [fx, fy] of [
  [0.15, 0.3],
  [0.85, 0.35],
  [0.5, 0.5],
])
  await glide(fx, fy, 10, 1100);
// 5. Reset view
await p.getByRole("toolbar", { name: "Viewport" }).getByRole("button", { name: "Reset view" }).click();
await p.waitForTimeout(2200);
await p.close();
await ctx.close();
await b.close();
