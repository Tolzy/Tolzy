import { expect, test, type Page } from "@playwright/test";

const MODEL = "**/models/sample-head/sample-head.glb";

async function waitForModel(page: Page) {
  await expect(page.getByRole("img", { name: "3D sample head" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Loading model" })).toHaveCount(0, { timeout: 30_000 });
}

/** Standard deviation of luminance in a screenshot, computed in the browser. */
async function detail(page: Page, png: Buffer): Promise<number> {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let sum = 0;
    let sq = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      sum += l;
      sq += l * l;
    }
    const mean = sum / n;
    return Math.sqrt(sq / n - mean * mean);
  }, png.toString("base64"));
}

test("renders the sample head as 3D geometry", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/studio/sample");
  await waitForModel(page);
  await page.waitForTimeout(500);

  const viewport = page.getByRole("region", { name: "3D viewport" });
  const box = (await viewport.boundingBox())!;
  // The head occupies the centre; a corner is plain background.
  const centre = await page.screenshot({
    clip: { x: box.x + box.width * 0.4, y: box.y + box.height * 0.3, width: box.width * 0.2, height: box.height * 0.3 },
  });
  const corner = await page.screenshot({ clip: { x: box.x + 8, y: box.y + 48, width: 80, height: 80 } });
  expect(await detail(page, centre)).toBeGreaterThan(20);
  expect(await detail(page, corner)).toBeLessThan(6);
  expect(errors).toEqual([]);
});

test("shows an error for an invalid model and recovers on retry", async ({ page }) => {
  let broken = true;
  await page.route(MODEL, (route) =>
    broken ? route.fulfill({ status: 200, contentType: "model/gltf-binary", body: "not a glb" }) : route.continue(),
  );
  await page.goto("/studio/sample");
  const alert = page.getByRole("alert").filter({ hasText: "The model couldn’t be loaded" });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  // The rest of the studio keeps working.
  await expect(page.getByRole("radiogroup", { name: "Material preset" })).toBeVisible();

  broken = false;
  await alert.getByRole("button", { name: "Try again" }).click();
  await waitForModel(page);
  await expect(alert).toHaveCount(0);
});

test("zoom changes the framing", async ({ page }) => {
  await page.goto("/studio/sample");
  await waitForModel(page);
  const viewport = page.getByRole("region", { name: "3D viewport" });
  const before = await viewport.screenshot();
  await page.getByRole("toolbar", { name: "Viewport" }).getByRole("button", { name: "Zoom in" }).click();
  await page.waitForTimeout(300);
  const after = await viewport.screenshot();
  expect(before.equals(after)).toBe(false);
});

test("survives repeated studio visits without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  for (let i = 0; i < 4; i++) {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: /Sample head/ }).click();
    await waitForModel(page);
    await page.getByRole("link", { name: "Back to portraits" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  }
  expect(errors).toEqual([]);
});
