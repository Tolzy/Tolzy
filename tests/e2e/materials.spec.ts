import { expect, test, type Page } from "@playwright/test";

/*
 * Materials and lighting, verified on the real renderer. The viewer mirrors
 * what is actually in the Three.js scene onto data attributes of the
 * interaction surface (read back from the materials and lights themselves),
 * and pixel checks measure the rendered viewport.
 */

const SETTLE = { timeout: 20_000 };
// Software WebGL (transmission, shadows, environment renders) is slow on CI
// and with parallel workers; these tests wait on real frames.
test.describe.configure({ timeout: 120_000 });
const surface = (page: Page) => page.getByTestId("viewer-surface");
const data = (page: Page, key: string) => surface(page).getAttribute(`data-${key}`);
const materials = (page: Page) => page.getByRole("radiogroup", { name: "Material preset" });
const lights = (page: Page) => page.getByRole("radiogroup", { name: "Lighting preset" });

async function openStudio(page: Page) {
  await page.goto("/studio/sample");
  await expect(page.getByRole("img", { name: "3D sample head" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("status").filter({ hasText: "Loading model" })).toHaveCount(0, { timeout: 30_000 });
  await expect(surface(page)).toHaveAttribute("data-material", "original", SETTLE);
}

async function chooseMaterial(page: Page, name: string) {
  await materials(page).getByRole("radio", { name }).click();
  await expect(surface(page)).toHaveAttribute("data-material", name.toLowerCase(), SETTLE);
}

async function chooseLighting(page: Page, name: string) {
  await lights(page).getByRole("radio", { name }).click();
  await expect(surface(page)).toHaveAttribute("data-light-rig", name.toLowerCase(), SETTLE);
}

/** Opens a panel from the rail (desktop) or the mobile tab bar. */
async function openPanel(page: Page, name: string) {
  await page.getByRole("navigation", { name: "Properties" }).getByRole("button", { name }).click();
}

interface Stats {
  luma: number;
  /** Mean of (R - B): positive for warm (gold), near zero for neutral. */
  warmth: number;
  /** Mean per-pixel spread between channels. */
  saturation: number;
}

/** Mean statistics of the centre of the viewport, where the face is. */
async function viewportStats(page: Page): Promise<Stats> {
  await page.waitForTimeout(800); // let the frame with the latest change land
  const box = (await page.locator("[data-viewport]").boundingBox())!;
  const clip = {
    x: box.x + box.width * 0.4,
    y: box.y + box.height * 0.3,
    width: box.width * 0.2,
    height: box.height * 0.3,
  };
  const png = (await page.screenshot({ clip })).toString("base64");
  return page.evaluate(async (src) => {
    const img = new Image();
    img.src = `data:image/png;base64,${src}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let luma = 0;
    let warmth = 0;
    let saturation = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
      luma += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      warmth += r - b;
      saturation += Math.max(r, g, b) - Math.min(r, g, b);
    }
    return { luma: luma / n, warmth: warmth / n, saturation: saturation / n };
  }, png);
}

test.describe("material presets", () => {
  test.beforeEach(async ({ page }) => openStudio(page));

  test("each preset puts a different physical material on the model", async ({ page }) => {
    const expected: Record<string, { type: string; metalness: string; transmission: (v: number) => boolean }> = {
      Chrome: { type: "MeshPhysicalMaterial", metalness: "1.000", transmission: (v) => v === 0 },
      Obsidian: { type: "MeshPhysicalMaterial", metalness: "0.000", transmission: (v) => v === 0 },
      Ceramic: { type: "MeshPhysicalMaterial", metalness: "0.000", transmission: (v) => v === 0 },
      Glass: { type: "MeshPhysicalMaterial", metalness: "0.000", transmission: (v) => v > 0.5 },
      Gold: { type: "MeshPhysicalMaterial", metalness: "1.000", transmission: (v) => v === 0 },
    };
    const geometry = await data(page, "geometry-key");
    const colours = new Set<string>();
    for (const [name, want] of Object.entries(expected)) {
      await chooseMaterial(page, name);
      await expect(surface(page)).toHaveAttribute("data-material-type", want.type);
      await expect(surface(page)).toHaveAttribute("data-metalness", want.metalness);
      expect(want.transmission(Number(await data(page, "transmission")))).toBe(true);
      colours.add(`${await data(page, "material-color")}|${await data(page, "roughness")}`);
      // Geometry is never replaced or modified.
      expect(await data(page, "geometry-key")).toBe(geometry);
    }
    expect(colours.size).toBe(5);
    await expect(surface(page)).toHaveAttribute("data-clearcoat", "0.000");
    await chooseMaterial(page, "Obsidian");
    expect(Number(await data(page, "clearcoat"))).toBeGreaterThan(0.5);
  });

  test("Original restores the model's own materials", async ({ page }) => {
    await chooseMaterial(page, "Gold");
    await expect(surface(page)).not.toHaveAttribute("data-hidden-meshes", "0");
    await chooseMaterial(page, "Original");
    await expect(surface(page)).toHaveAttribute("data-material-type", "MeshStandardMaterial");
    await expect(surface(page)).toHaveAttribute("data-hidden-meshes", "0");
  });

  test("repeated switching reuses materials and GPU resources", async ({ page }) => {
    const all = ["Chrome", "Obsidian", "Ceramic", "Glass", "Gold", "Original"];
    for (const name of all) await chooseMaterial(page, name);
    await page.waitForTimeout(1000);
    const created = await data(page, "materials-created");
    const programs = Number(await data(page, "gpu-programs"));
    const textures = Number(await data(page, "gpu-textures"));
    const geometries = Number(await data(page, "gpu-geometries"));
    for (let round = 0; round < 3; round++) for (const name of all) await chooseMaterial(page, name);
    await page.waitForTimeout(1000);
    expect(await data(page, "materials-created")).toBe(created);
    expect(Number(await data(page, "gpu-programs"))).toBe(programs);
    expect(Number(await data(page, "gpu-textures"))).toBe(textures);
    expect(Number(await data(page, "gpu-geometries"))).toBe(geometries);
  });

  test("adjustments update the renderer, reset, and clear on preset change", async ({ page }) => {
    await chooseMaterial(page, "Chrome");
    await page.getByRole("button", { name: "Adjust" }).click();
    const reset = page.getByRole("button", { name: "Reset to preset" });
    await expect(reset).toBeDisabled();

    const roughness = page.getByRole("slider", { name: "Roughness" });
    await roughness.focus();
    for (let i = 0; i < 20; i++) await page.keyboard.press("ArrowRight");
    await expect(surface(page)).toHaveAttribute("data-roughness", "0.270", SETTLE);

    const tint = page.getByLabel("Tint", { exact: true });
    await tint.fill("FF8800");
    await tint.press("Enter");
    await expect(surface(page)).toHaveAttribute("data-material-color", "#ff8800", SETTLE);

    await expect(reset).toBeEnabled();
    await reset.click();
    await expect(surface(page)).toHaveAttribute("data-roughness", "0.070", SETTLE);
    await expect(surface(page)).toHaveAttribute("data-material-color", "#f4f6f8");
    await expect(reset).toBeDisabled();

    // Adjust, then change preset: the new preset starts from its own defaults.
    await roughness.focus();
    await page.keyboard.press("PageUp");
    await expect(surface(page)).not.toHaveAttribute("data-roughness", "0.070", SETTLE);
    await chooseMaterial(page, "Gold");
    await expect(surface(page)).toHaveAttribute("data-roughness", "0.160");
    await expect(surface(page)).toHaveAttribute("data-material-color", "#ffe29d");

    // Glass exposes its own thickness control.
    await chooseMaterial(page, "Glass");
    const thickness = page.getByRole("slider", { name: "Thickness" });
    await thickness.focus();
    await page.keyboard.press("PageUp");
    await expect(surface(page)).not.toHaveAttribute("data-thickness", "0.450", SETTLE);
  });

  test("renders visibly different surfaces", async ({ page }) => {
    const original = await viewportStats(page);
    await chooseMaterial(page, "Chrome");
    const chrome = await viewportStats(page);
    await chooseMaterial(page, "Obsidian");
    const obsidian = await viewportStats(page);
    await chooseMaterial(page, "Ceramic");
    const ceramic = await viewportStats(page);
    await chooseMaterial(page, "Gold");
    const gold = await viewportStats(page);
    await chooseMaterial(page, "Glass");
    const glass = await viewportStats(page);

    // Ceramic is a bright glaze; obsidian a near-black lacquer.
    expect(ceramic.luma).toBeGreaterThan(obsidian.luma + 60);
    // Chrome reflects the studio's light panels: brighter than obsidian, and neutral.
    expect(chrome.luma).toBeGreaterThan(obsidian.luma + 5);
    expect(Math.abs(chrome.warmth)).toBeLessThan(15);
    // Gold reflections are strongly warm.
    expect(gold.warmth).toBeGreaterThan(40);
    expect(gold.warmth).toBeGreaterThan(chrome.warmth + 30);
    // Glass shows the background through it: different from both solids.
    expect(Math.abs(glass.luma - ceramic.luma)).toBeGreaterThan(30);
    expect(glass.saturation).toBeLessThan(original.saturation);
  });
});

test.describe("lighting presets", () => {
  test.beforeEach(async ({ page }) => {
    await openStudio(page);
    await openPanel(page, "Light");
  });

  test("each preset changes the lights and environment in the scene", async ({ page }) => {
    const seen = new Set<string>();
    const environments = new Set<string>();
    for (const name of ["Dramatic", "Soft", "Rim", "Neutral", "Studio"]) {
      await chooseLighting(page, name);
      await expect.poll(async () => environments.has((await data(page, "environment")) ?? ""), SETTLE).toBe(false);
      environments.add((await data(page, "environment"))!);
      seen.add((await data(page, "lights"))!);
    }
    expect(seen.size).toBe(5);
  });

  test("switching rigs re-renders the environment in place without leaking", async ({ page }) => {
    const rigs = ["Dramatic", "Soft", "Rim", "Neutral", "Studio"];
    for (const name of rigs) await chooseLighting(page, name);
    await page.waitForTimeout(1000);
    const textures = Number(await data(page, "gpu-textures"));
    const geometries = Number(await data(page, "gpu-geometries"));
    for (let round = 0; round < 2; round++) for (const name of rigs) await chooseLighting(page, name);
    await page.waitForTimeout(1000);
    // Ten more switches: a per-switch leak would add at least ten. A small
    // margin covers the active rig's shadow map being counted mid-frame.
    expect(Number(await data(page, "gpu-textures"))).toBeLessThanOrEqual(textures + 2);
    expect(Number(await data(page, "gpu-geometries"))).toBeLessThanOrEqual(geometries + 2);
  });

  test("intensity and rotation drive the active rig", async ({ page }) => {
    await chooseLighting(page, "Dramatic");
    const before = (await data(page, "lights"))!;
    const key = (s: string) => Number(s.split(";")[0].split("@")[1].replace("s", ""));
    await page.getByRole("button", { name: "Adjust" }).click();

    const intensity = page.getByRole("slider", { name: "Intensity" });
    await intensity.focus();
    await page.keyboard.press("PageUp");
    await expect.poll(async () => key((await data(page, "lights"))!), SETTLE).toBeGreaterThan(key(before));

    const rotation = page.getByRole("slider", { name: "Rotation" });
    await rotation.focus();
    await page.keyboard.press("PageUp");
    const position = (s: string) => s.split(";")[0].split("@")[0];
    await expect.poll(async () => position((await data(page, "lights"))!), SETTLE).not.toBe(position(before));
    // Still the same rig: presets and manual controls combine.
    await expect(surface(page)).toHaveAttribute("data-light-rig", "dramatic");
  });

  test("works with every material and changes the render", async ({ page }) => {
    for (const material of ["Chrome", "Glass", "Original"]) {
      await openPanel(page, "Material");
      await chooseMaterial(page, material);
      await openPanel(page, "Light");
      await chooseLighting(page, "Studio");
      const studio = await viewportStats(page);
      await chooseLighting(page, "Rim");
      const rim = await viewportStats(page);
      expect(Math.abs(studio.luma - rim.luma), material).toBeGreaterThan(3);
      await expect(surface(page)).toHaveAttribute("data-material", material.toLowerCase());
    }
  });
});
