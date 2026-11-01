import { expect, test, type Page } from "@playwright/test";

/*
 * Milestone 7 — model parts. Checked on the real renderer through the
 * viewer's data attributes, which are read back from the three.js scene
 * (visible part meshes, triangle counts, per-part materials).
 */

test.describe.configure({ timeout: 120_000 });

const SETTLE = { timeout: 20_000 };
const surface = (page: Page) => page.locator("[data-viewport] [data-testid=viewer-surface]");
const attr = (page: Page, key: string) => surface(page).getAttribute(`data-${key}`);
const parts = (page: Page) => page.getByRole("list", { name: "Model parts" });

async function openModelPanel(page: Page) {
  await page.goto("/studio/sample");
  await expect(surface(page)).toHaveAttribute("data-segmented", "true", { timeout: 60_000 });
  await page.getByRole("navigation", { name: "Properties" }).getByRole("button", { name: "Model" }).click();
  await expect(parts(page)).toBeVisible();
}
async function show(page: Page, label: string) {
  await page.getByRole("radiogroup", { name: "Show" }).getByRole("radio", { name: label, exact: true }).click();
}

test.beforeEach(async ({ page }) => openModelPanel(page));

test("the sample is split into every region as real geometry", async ({ page }) => {
  const regions = (await attr(page, "regions"))!.split(",");
  for (const id of ["head", "face", "hair", "ear-left", "ear-right", "neck", "shoulders", "bust"])
    expect(regions).toContain(id);
});

test("head only, head & neck and full bust change the visible geometry, and back again losslessly", async ({
  page,
  isMobile,
}) => {
  const full = Number(await attr(page, "visible-triangles"));
  await show(page, "Head");
  await expect(surface(page)).toHaveAttribute("data-hidden-regions", /neck/, SETTLE);
  const head = Number(await attr(page, "visible-triangles"));
  expect(await attr(page, "hidden-regions")).toContain("bust");
  expect(head).toBeLessThan(full);

  await show(page, "Head & neck");
  await expect(surface(page)).toHaveAttribute("data-hidden-regions", "bust,shoulders", SETTLE);
  const headNeck = Number(await attr(page, "visible-triangles"));
  expect(headNeck).toBeGreaterThan(head);
  expect(headNeck).toBeLessThan(full);

  await show(page, "Bust");
  await expect(surface(page)).toHaveAttribute("data-hidden-regions", "", SETTLE);
  expect(Number(await attr(page, "visible-triangles"))).toBe(full);

  // Undo returns to the previous preset (keyboard shortcut on phones, where the top bar has no undo button).
  if (isMobile) await page.keyboard.press("Control+z");
  else await page.getByRole("button", { name: "Undo" }).click();
  await expect(surface(page)).toHaveAttribute("data-hidden-regions", "bust,shoulders", SETTLE);
});

test("hair can be hidden; parts of the continuous skin explain why they can't", async ({ page }) => {
  await parts(page).getByRole("button", { name: "Hide hair" }).click();
  await expect(surface(page)).toHaveAttribute("data-hidden-regions", /hair/, SETTLE);
  await parts(page).getByRole("button", { name: "Show hair" }).click();
  await expect(surface(page)).not.toHaveAttribute("data-hidden-regions", /hair/, SETTLE);

  await expect(parts(page).locator("[data-region=face]").getByRole("button", { name: /Hide/ })).toHaveCount(0);
  await expect(page.getByText(/can be styled on their own but not hidden/)).toBeVisible();
});

test("a part is selected from the list, highlighted, and deselected", async ({ page }) => {
  await parts(page).getByRole("button", { name: "Face", exact: true }).click();
  await expect(surface(page)).toHaveAttribute("data-selected-region", "face", SETTLE);
  await expect(parts(page).getByRole("button", { name: "Face", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Deselect" }).click();
  await expect(surface(page)).toHaveAttribute("data-selected-region", "", SETTLE);
});

test("clicking the model selects the part under the pointer; empty space deselects", async ({ page }) => {
  // Hold the head still so the click lands where we aim.
  await page.getByRole("toolbar", { name: "Viewport" }).getByRole("button", { name: "Cursor tracking" }).click();
  const box = (await surface(page).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.42);
  await expect(surface(page)).toHaveAttribute("data-selected-region", /^(face|head|hair)$/, SETTLE);
  await page.mouse.click(box.x + 8, box.y + 8);
  await expect(surface(page)).toHaveAttribute("data-selected-region", "", SETTLE);
});

test("a part's own material changes only that part, on the same geometry", async ({ page }) => {
  const geometryBefore = await attr(page, "geometry-key");
  await parts(page).getByRole("button", { name: "Hair", exact: true }).click();
  await page.getByRole("button", { name: "Edit material" }).click();
  await expect(page.getByTestId("material-scope")).toContainText("Editing: Hair");
  await page.getByRole("radiogroup", { name: "Material preset" }).getByRole("radio", { name: "Chrome" }).click();

  await expect
    .poll(async () => JSON.parse((await attr(page, "region-materials")) ?? "{}").hair?.preset, SETTLE)
    .toBe("chrome");
  const summary = JSON.parse((await attr(page, "region-materials"))!);
  expect(summary.face.preset).toBe("original");
  expect(summary.head.preset).toBe("original");
  // The whole-model material is untouched and no geometry was duplicated.
  expect(await attr(page, "material")).toBe("original");
  expect(await attr(page, "geometry-key")).toBe(geometryBefore);

  // Back to following the whole model.
  await page.getByRole("button", { name: /Use the whole-model material again/ }).click();
  await expect
    .poll(async () => JSON.parse((await attr(page, "region-materials")) ?? "{}").hair?.preset, SETTLE)
    .toBe("original");
});

test("the camera frames what is visible", async ({ page }) => {
  await show(page, "Head");
  await expect(surface(page)).toHaveAttribute("data-hidden-regions", /bust/, SETTLE);
  await page.getByRole("toolbar", { name: "Viewport" }).getByRole("button", { name: /Reset/ }).click();
  // Still rendering and interactive after the preset change.
  await surface(page).focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => Number(await attr(page, "manual-yaw")), SETTLE).not.toBe(0);
});
