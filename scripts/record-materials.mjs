// Records real-time material and lighting switching in the studio (WebM),
// with a visible cursor. Usage: node scripts/record-materials.mjs <outDir> [baseUrl]
// (app must be running). Convert with ffmpeg if an MP4 is needed.
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
await ctx.addInitScript(() => {
  addEventListener("DOMContentLoaded", () => {
    const d = document.createElement("div");
    d.style.cssText =
      "position:fixed;z-index:99999;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(255,255,255,.85);box-shadow:0 0 0 2px rgba(0,0,0,.35);pointer-events:none;transition:transform .08s;left:-50px;top:-50px";
    document.body.appendChild(d);
    addEventListener("pointermove", (e) => ((d.style.left = e.clientX + "px"), (d.style.top = e.clientY + "px")), true);
    addEventListener("pointerdown", () => (d.style.transform = "scale(.7)"), true);
    addEventListener("pointerup", () => (d.style.transform = ""), true);
  });
});
const p = await ctx.newPage();
await p.goto(`${base}/studio/sample`, { waitUntil: "networkidle" });
await p.waitForFunction(() => !document.querySelector('[role="status"]'));
await p.waitForTimeout(1500);

const started = Date.now();
const click = async (locator, pause = 1600) => {
  console.log(
    ((Date.now() - started) / 1000).toFixed(1),
    "s:",
    (await locator.getAttribute("aria-label")) ?? (await locator.textContent()),
  );
  const box = await locator.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
  await p.mouse.down();
  await p.mouse.up();
  await p.waitForTimeout(pause);
};
const material = (name) => p.getByRole("radiogroup", { name: "Material preset" }).getByRole("radio", { name });
const light = (name) => p.getByRole("radiogroup", { name: "Lighting preset" }).getByRole("radio", { name });
const rail = (name) => p.getByRole("navigation", { name: "Properties" }).getByRole("button", { name });

for (const name of ["Chrome", "Obsidian", "Ceramic", "Glass", "Gold"]) await click(material(name));

// Adjust: roughen the gold step by step (the head updates live), then reset.
await click(p.getByRole("button", { name: "Adjust" }), 600);
await click(p.getByRole("slider", { name: "Roughness" }), 300);
for (let i = 0; i < 40; i++) {
  await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(70);
}
await p.waitForTimeout(1200);
await click(p.getByRole("button", { name: "Reset to preset" }));

// Lighting rigs on chrome.
await click(material("Chrome"), 1000);
await click(rail("Light"), 600);
for (const name of ["Dramatic", "Soft", "Rim", "Neutral", "Studio"]) await click(light(name));

await click(rail("Material"), 600);
await click(material("Original"), 2500);
// Let the video encoder catch up (it lags behind on software rendering).
await p.waitForTimeout(15_000);
await p.close();
await ctx.close();
await b.close();
console.log("saved to", out);
