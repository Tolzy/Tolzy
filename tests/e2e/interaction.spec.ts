import { expect, test, type Page } from "@playwright/test";

/*
 * Cursor tracking and manual rotation, verified on the real renderer.
 * The viewer mirrors its rotation onto data attributes of the interaction
 * surface (data-yaw, data-pitch, data-track-yaw, data-manual-yaw, ...), in degrees.
 */

const surface = (page: Page) => page.getByTestId("viewer-surface");
const num = async (page: Page, key: string) => Number((await surface(page).getAttribute(`data-${key}`)) ?? 0);

async function openStudio(page: Page) {
  await page.goto("/studio/sample");
  await expect(page.getByRole("img", { name: "3D sample head" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("status").filter({ hasText: "Loading model" })).toHaveCount(0, { timeout: 30_000 });
  return (await page.locator("[data-viewport]").boundingBox())!;
}

/** Moves the mouse to a fraction of the viewport. */
async function hover(page: Page, box: { x: number; y: number; width: number; height: number }, fx: number, fy: number) {
  await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy, { steps: 6 });
}

// Generous ceiling: with software WebGL and parallel workers, frames can be
// seconds apart on CI. Polls resolve as soon as the value arrives.
const SETTLE_TIMEOUT = 20_000;
// Multi-step drags wait on real frames; give each test room on slow machines.
test.describe.configure({ timeout: 90_000 });
const settlesTo = (page: Page, key: string, value: number, tolerance = 2) =>
  expect
    .poll(() => num(page, key), { timeout: SETTLE_TIMEOUT })
    .toBeGreaterThan(value - tolerance)
    .then(() => expect.poll(() => num(page, key), { timeout: SETTLE_TIMEOUT }).toBeLessThan(value + tolerance));

/** Waits (on the real renderer) until the manual yaw is within tolerance of a value. */
const expectAngle = (page: Page, expected: number, tolerance: number) =>
  expect
    .poll(async () => Math.abs((await num(page, "manual-yaw")) - expected), { timeout: SETTLE_TIMEOUT })
    .toBeLessThan(tolerance);

test.describe("cursor tracking (desktop)", () => {
  test.skip(({ isMobile }) => isMobile, "mouse hover is a desktop interaction");

  test("follows the cursor in all four directions and diagonally, within limits", async ({ page }) => {
    const box = await openStudio(page);
    const cases: [string, number, number, number, number][] = [
      ["right", 0.99, 0.5, 25, 0],
      ["left", 0.01, 0.5, -25, 0],
      ["up", 0.5, 0.01, 0, 12],
      ["down", 0.5, 0.99, 0, -12],
      ["diagonal", 0.99, 0.01, 25, 12],
    ];
    for (const [, fx, fy, yaw, pitch] of cases) {
      await hover(page, box, fx, fy);
      await settlesTo(page, "yaw", yaw, 2.5);
      await settlesTo(page, "pitch", pitch, 2.5);
    }
  });

  test("returns to neutral after the pointer leaves the viewport", async ({ page }) => {
    const box = await openStudio(page);
    await hover(page, box, 0.95, 0.1);
    await expect.poll(() => num(page, "yaw")).toBeGreaterThan(20);
    await page.mouse.move(box.x + box.width + 150, box.y + 40); // onto the inspector
    await settlesTo(page, "yaw", 0, 0.5);
    await settlesTo(page, "pitch", 0, 0.5);
  });

  test("respects a lower rotation limit from the Motion panel", async ({ page }) => {
    const box = await openStudio(page);
    await page.getByRole("navigation", { name: "Properties" }).getByRole("button", { name: "Motion" }).click();
    const horizontal = page.getByRole("slider", { name: "Horizontal" }).first();
    await horizontal.focus();
    for (let i = 0; i < 15; i++) await page.keyboard.press("ArrowLeft"); // 25° → 10°
    await expect(horizontal).toHaveAttribute("aria-valuetext", "±10°");
    await hover(page, box, 0.99, 0.5);
    await settlesTo(page, "yaw", 10, 1.5);
  });

  test("the toolbar can switch cursor tracking off", async ({ page }) => {
    const box = await openStudio(page);
    await page.getByRole("toolbar", { name: "Viewport" }).getByRole("button", { name: "Cursor tracking" }).click();
    // Clicking the button tracked the cursor near the toolbar; let the head ease back first.
    await expect(surface(page)).toHaveAttribute("data-settled", "true", { timeout: SETTLE_TIMEOUT });
    await hover(page, box, 0.99, 0.01);
    await page.waitForTimeout(800);
    expect(Math.abs(await num(page, "yaw"))).toBeLessThan(0.5);
    expect(Math.abs(await num(page, "pitch"))).toBeLessThan(0.5);
  });
});

test.describe("manual rotation", () => {
  test("drags horizontally and vertically", async ({ page, isMobile }) => {
    test.skip(isMobile, "touch drag is covered below");
    const box = await openStudio(page);
    await page.getByRole("toolbar", { name: "Viewport" }).getByRole("button", { name: "Cursor tracking" }).click();

    await hover(page, box, 0.5, 0.45);
    await page.mouse.down();
    await hover(page, box, 0.75, 0.45); // quarter width right
    await expect.poll(() => num(page, "manual-yaw"), { timeout: SETTLE_TIMEOUT }).toBeGreaterThan(40);
    await hover(page, box, 0.75, 0.3); // up
    await expect.poll(() => num(page, "manual-pitch"), { timeout: SETTLE_TIMEOUT }).toBeGreaterThan(8);
    await page.mouse.up();
    // "Return" mode: eases back to neutral after the idle delay — no snapping.
    const right = await num(page, "manual-yaw");
    await page.waitForTimeout(100);
    expect(Math.abs((await num(page, "manual-yaw")) - right)).toBeLessThan(15);
    await settlesTo(page, "manual-yaw", 0, 0.5);
  });

  test("tracking and dragging combine without fighting", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop pointer");
    const box = await openStudio(page);
    await page.getByRole("navigation", { name: "Properties" }).getByRole("button", { name: "Motion" }).click();
    await page.getByRole("radio", { name: "Hold" }).click();

    await hover(page, box, 0.9, 0.45);
    await expect(surface(page)).toHaveAttribute("data-settled", "true", { timeout: SETTLE_TIMEOUT });
    const trackBefore = await num(page, "track-yaw");
    expect(trackBefore).toBeGreaterThan(15);

    await page.mouse.down();
    await hover(page, box, 0.6, 0.45); // dragging left also moves the cursor left…
    await expect.poll(() => num(page, "manual-yaw"), { timeout: SETTLE_TIMEOUT }).toBeLessThan(-30);
    // …but tracking is frozen during the drag; only the manual offset changes.
    expect(Math.abs((await num(page, "track-yaw")) - trackBefore)).toBeLessThan(1.5);
    await page.mouse.up();

    // Tracking resumes towards the cursor; the held manual offset is kept.
    await expect.poll(() => num(page, "track-yaw"), { timeout: SETTLE_TIMEOUT }).toBeLessThan(trackBefore - 3);
    // Read all three values from the same frame.
    const frame = await surface(page).evaluate((el) => ({
      yaw: Number(el.dataset.yaw),
      track: Number(el.dataset.trackYaw),
      manual: Number(el.dataset.manualYaw),
    }));
    expect(frame.manual).toBeLessThan(-30);
    expect(Math.abs(frame.yaw - (frame.track + frame.manual))).toBeLessThan(0.05);
  });

  test("reset view returns the head to neutral", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop pointer");
    const box = await openStudio(page);
    await page.getByRole("navigation", { name: "Properties" }).getByRole("button", { name: "Motion" }).click();
    await page.getByRole("radio", { name: "Hold" }).click();
    await page.getByRole("toolbar", { name: "Viewport" }).getByRole("button", { name: "Cursor tracking" }).click();
    await hover(page, box, 0.4, 0.45);
    await page.mouse.down();
    await hover(page, box, 0.7, 0.45);
    await page.mouse.up();
    await expect.poll(() => num(page, "yaw")).toBeGreaterThan(40);
    await page.waitForTimeout(1200);
    expect(await num(page, "yaw")).toBeGreaterThan(40); // held

    await page.getByRole("toolbar", { name: "Viewport" }).getByRole("button", { name: "Reset view" }).click();
    await settlesTo(page, "yaw", 0, 0.5);
  });

  test("can be disabled from the Motion panel", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop pointer");
    const box = await openStudio(page);
    await page.getByRole("navigation", { name: "Properties" }).getByRole("button", { name: "Motion" }).click();
    await page.getByRole("switch", { name: "Drag to rotate" }).click();
    await hover(page, box, 0.4, 0.45);
    await page.mouse.down();
    await hover(page, box, 0.8, 0.45);
    await page.mouse.up();
    expect(await num(page, "manual-yaw")).toBe(0);
  });

  test("rotates with the arrow keys", async ({ page }) => {
    await openStudio(page);
    await surface(page).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await settlesTo(page, "manual-yaw", 20, 0.5); // held, not returned
    await page.keyboard.press("0"); // reset view
    await settlesTo(page, "manual-yaw", 0, 0.5);
  });
});

test.describe("touch", () => {
  test.skip(({ isMobile }) => !isMobile, "touch runs on the mobile project");

  test("swiping rotates the head and lets go cleanly", async ({ page }) => {
    const box = await openStudio(page);
    const cdp = await page.context().newCDPSession(page);
    const y = box.y + box.height * 0.45;
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }],
      });
    await touch("touchStart", box.x + box.width * 0.3);
    for (let i = 1; i <= 10; i++) await touch("touchMove", box.x + box.width * (0.3 + i * 0.04));
    await expect.poll(() => num(page, "manual-yaw")).toBeGreaterThan(40);
    await touch("touchEnd", 0);
    await settlesTo(page, "manual-yaw", 0, 0.5); // returns after release
  });
});

test.describe("touch sensitivity", () => {
  test.skip(({ isMobile }) => !isMobile, "touch runs on the mobile project");

  /**
   * Swipes horizontally by a fraction of the viewport width and holds the
   * finger still until the head reaches `expected` degrees (± tolerance).
   * Motion is time-based, so the angle converges even on slow software frames;
   * polling waits for that instead of guessing a fixed delay.
   */
  async function swipe(page: Page, fraction: number, expected: number, tolerance: number) {
    const box = (await page.locator("[data-viewport]").boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const y = box.y + box.height * 0.45;
    const x0 = box.x + box.width * 0.3;
    const send = (type: "touchStart" | "touchMove" | "touchEnd", x: number) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
    await send("touchStart", x0);
    for (let i = 1; i <= 8; i++) await send("touchMove", x0 + box.width * fraction * (i / 8));
    await expectAngle(page, expected, tolerance);
    await send("touchEnd", 0);
  }

  test("short, medium and long swipes rotate about 45 % less than a mouse drag", async ({ page }) => {
    test.setTimeout(90_000); // three swipes with holds and returns on software WebGL
    await openStudio(page);
    // Mouse: 220° per viewport width. Touch default: 55 % of that.
    for (const [fraction, expected] of [
      [0.1, 12.1],
      [0.25, 30.3],
      [0.4, 48.4],
    ]) {
      await swipe(page, fraction, expected, 3);
      // Smooth, natural return after lifting the finger.
      await settlesTo(page, "manual-yaw", 0, 0.5);
    }
  });

  test("touch speed is configurable from the Motion panel", async ({ page }) => {
    await openStudio(page);
    await page.getByRole("navigation", { name: "Properties" }).getByRole("button", { name: "Motion" }).click();
    const speed = page.getByRole("slider", { name: "Touch speed" });
    await expect(speed).toHaveAttribute("aria-valuetext", "55%");
    await speed.focus();
    for (let i = 0; i < 9; i++) await page.keyboard.press("ArrowRight"); // 55 % → 100 %
    await expect(speed).toHaveAttribute("aria-valuetext", "100%");
    await swipe(page, 0.25, 55, 4);
  });
});

test("mouse drag rate is unchanged by the touch setting", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop pointer");
  const box = await openStudio(page);
  await page.getByRole("toolbar", { name: "Viewport" }).getByRole("button", { name: "Cursor tracking" }).click();
  await hover(page, box, 0.4, 0.45);
  await page.mouse.down();
  await hover(page, box, 0.65, 0.45); // a quarter of the width
  await expectAngle(page, 55, 3); // 0.25 × 220°, while holding still
  await page.mouse.up();
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("tracking starts off but dragging still works", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop pointer");
    const box = await openStudio(page);
    await hover(page, box, 0.99, 0.01);
    await page.waitForTimeout(800);
    expect(Math.abs(await num(page, "yaw"))).toBeLessThan(0.5);

    await hover(page, box, 0.4, 0.45);
    await page.mouse.down();
    await hover(page, box, 0.6, 0.45);
    await page.mouse.up();
    await expect.poll(() => num(page, "manual-yaw")).toBeGreaterThan(20);
  });
});
