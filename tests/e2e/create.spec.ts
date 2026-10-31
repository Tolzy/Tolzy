import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/*
 * Milestone 5 — photo selection and validation on /create. Fixtures are renders
 * of the CC0 sample head (tests/fixtures/photos/README.md), never real people.
 * Face checks run MediaPipe in the browser; the first check loads the model.
 */

test.describe.configure({ timeout: 90_000 });

const FIXTURES = "tests/fixtures/photos";
const CHECKED = { timeout: 45_000 };

const front = (page: Page) => page.getByTestId("front-photo");
const check = (page: Page, scope: string, id: string) => page.locator(`${scope} [data-check="${id}"]`);

async function chooseFront(page: Page, name: string) {
  const input = page.locator(
    "[data-testid=main-drop-zone] input[type=file], [data-testid=front-photo] input[type=file]",
  );
  await input.first().setInputFiles(`${FIXTURES}/${name}`);
  await expect(front(page).locator("[data-photo-status]")).toBeVisible(CHECKED);
}
const status = (page: Page) => front(page).locator("[data-photo-status]");

/** Every request the page makes, to prove photos never leave the browser. */
function trackRequests(page: Page) {
  const requests: { url: string; method: string; bytes: number }[] = [];
  page.on("request", (r) =>
    requests.push({ url: r.url(), method: r.method(), bytes: r.postDataBuffer()?.length ?? 0 }),
  );
  return requests;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/create");
  await expect(page.getByRole("heading", { name: "Start with a photo" })).toBeVisible();
});

test("starts empty: Continue is disabled and explains why", async ({ page }) => {
  await expect(page.getByTestId("main-drop-zone")).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue/ })).toBeDisabled();
  await expect(page.locator("#continue-blockers")).toContainText("Add a front-facing photo.");
  await expect(page.locator("#continue-blockers")).toContainText("Confirm you have permission");
  await expect(page.getByText("Optional · 0 of 4 added")).toBeVisible();
});

test("a good front photo passes every check, with a preview", async ({ page }) => {
  await chooseFront(page, "front.jpg");
  await expect(status(page)).toHaveAttribute("data-photo-status", "pass");
  await expect(status(page)).toHaveText("Looks good");
  for (const id of [
    "format",
    "size",
    "decode",
    "resolution",
    "face",
    "faceSize",
    "pose",
    "visible",
    "eyes",
    "headwear",
    "expression",
    "sharpness",
    "lighting",
  ])
    await expect(check(page, "[data-testid=front-photo]", id), id).toHaveAttribute("data-status", "pass");
  const img = front(page).locator("img");
  await expect(img).toBeVisible();
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1320);
  await expect(front(page)).toContainText("JPEG · 1320 × 1440");
});

test("drag and drop adds a photo", async ({ page }) => {
  const bytes = readFileSync(`${FIXTURES}/front.webp`).toString("base64");
  const dataTransfer = await page.evaluateHandle((b64) => {
    const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([data], "dropped.webp", { type: "image/webp" }));
    return dt;
  }, bytes);
  const zone = page.getByTestId("main-drop-zone");
  await zone.dispatchEvent("dragenter", { dataTransfer });
  await expect(zone).toHaveAttribute("data-dragging", "true");
  await zone.dispatchEvent("dragover", { dataTransfer });
  await zone.dispatchEvent("drop", { dataTransfer });
  await expect(front(page)).toContainText("dropped.webp");
  await expect(status(page)).toHaveAttribute("data-photo-status", "pass", CHECKED);
});

test.describe("formats and limits", () => {
  test("PNG and WebP are accepted", async ({ page }) => {
    await chooseFront(page, "front.png");
    await expect(check(page, "[data-testid=front-photo]", "format")).toContainText("PNG image");
    await expect(status(page)).toHaveAttribute("data-photo-status", "pass");
    await chooseFront(page, "front.webp");
    await expect(check(page, "[data-testid=front-photo]", "format")).toContainText("WebP image");
  });

  test("unsupported and disguised files are rejected with specific messages", async ({ page }) => {
    await chooseFront(page, "unsupported.gif");
    await expect(check(page, "[data-testid=front-photo]", "format")).toContainText("GIF files aren’t supported");
    await expect(status(page)).toHaveAttribute("data-photo-status", "fail");
    await chooseFront(page, "not-an-image.jpg");
    await expect(check(page, "[data-testid=front-photo]", "format")).toContainText("isn’t a supported image");
  });

  test("HEIC is recognised; browsers that can't decode it get guidance", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Chromium cannot decode HEIC");
    await chooseFront(page, "photo.heic");
    await expect(check(page, "[data-testid=front-photo]", "format")).toContainText("HEIC image");
    await expect(check(page, "[data-testid=front-photo]", "decode")).toContainText("can’t open HEIC");
  });

  test("files over 20 MB are rejected", async ({ page }) => {
    const big = Buffer.alloc(21 * 1024 * 1024);
    big.set([0xff, 0xd8, 0xff, 0xe0]);
    await page
      .getByTestId("main-drop-zone")
      .locator("input[type=file]")
      .setInputFiles({ name: "huge.jpg", mimeType: "image/jpeg", buffer: big });
    await expect(check(page, "[data-testid=front-photo]", "size")).toContainText("over the 20 MB limit", CHECKED);
    await expect(status(page)).toHaveAttribute("data-photo-status", "fail");
  });

  test("photos below the minimum resolution are rejected", async ({ page }) => {
    await chooseFront(page, "low-res.jpg");
    await expect(check(page, "[data-testid=front-photo]", "resolution")).toContainText("600 × 655 is too small");
    await expect(status(page)).toHaveAttribute("data-photo-status", "fail");
  });
});

test.describe("face checks", () => {
  test("blocks no face, several people, a tiny face and blur", async ({ page }) => {
    const cases: [string, string, RegExp][] = [
      ["no-face.jpg", "face", /couldn’t find a face/],
      ["two-people.jpg", "single", /found 2 faces/],
      ["small-face.jpg", "faceSize", /too small to reconstruct/],
      ["blurry.jpg", "sharpness", /too blurry/],
    ];
    for (const [file, id, message] of cases) {
      await chooseFront(page, file);
      const c = check(page, "[data-testid=front-photo]", id);
      await expect(c, file).toHaveAttribute("data-status", "fail");
      await expect(c, file).toContainText(message);
      await expect(page.getByRole("button", { name: /Continue/ })).toBeDisabled();
    }
  });

  test("suggests fixes without blocking: dark lighting, turned head, distant face, head covering", async ({ page }) => {
    const cases: [string, string, RegExp][] = [
      ["dark.jpg", "lighting", /too dark/],
      ["three-quarter.jpg", "pose", /head is turned away/],
      ["distant-face.jpg", "faceSize", /quite small/],
      ["headwear.jpg", "headwear", /top of the head looks covered/],
      ["headwear-dark.jpg", "headwear", /top of the head looks covered/],
    ];
    for (const [file, id, message] of cases) {
      await chooseFront(page, file);
      const c = check(page, "[data-testid=front-photo]", id);
      await expect(c, file).toHaveAttribute("data-status", "warn");
      await expect(c, file).toContainText(message);
      await expect(status(page), file).toHaveAttribute("data-photo-status", "warn");
    }
  });
});

test("replace and remove the front photo", async ({ page }) => {
  await chooseFront(page, "blurry.jpg");
  await expect(status(page)).toHaveAttribute("data-photo-status", "fail");
  await front(page).locator("input[type=file]").setInputFiles(`${FIXTURES}/front.jpg`);
  await expect(front(page)).toContainText("front.jpg");
  await expect(status(page)).toHaveAttribute("data-photo-status", "pass", CHECKED);
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByTestId("main-drop-zone")).toBeVisible();
});

test("additional angles are optional and independent", async ({ page }) => {
  await page.locator("[data-slot=leftThreeQuarter] input[type=file]").setInputFiles(`${FIXTURES}/three-quarter.jpg`);
  await page.locator("[data-slot=rightProfile] input[type=file]").setInputFiles(`${FIXTURES}/profile.jpg`);
  await expect(page.getByText("Optional · 2 of 4 added")).toBeVisible();
  const left = page.locator("[data-angle-checks=leftThreeQuarter]");
  await expect(left).toContainText(/checks passed/, CHECKED);
  await expect(page.locator("[data-angle-checks=rightProfile]")).toContainText(/checks passed/, CHECKED);
  await expect(page.locator("[data-slot=leftProfile]")).toContainText("Empty");
  await expect(page.locator("[data-slot=rightProfile]")).toContainText("Added");

  // A failing optional photo blocks until replaced or removed.
  await page.locator("[data-slot=leftThreeQuarter] input[type=file]").first().setInputFiles(`${FIXTURES}/low-res.jpg`);
  await expect(left).toContainText("too small", CHECKED);
  await expect(page.locator("#continue-blockers")).toContainText("Replace or remove the left three-quarter photo.");
  await page.getByRole("button", { name: "Remove left three-quarter photo" }).click();
  await expect(left).toHaveCount(0);
  await expect(page.locator("[data-slot=rightProfile]")).toContainText("Added");
  await expect(page.getByText("Optional · 1 of 4 added")).toBeVisible();
});

test("consent is required; progression stops honestly before upload", async ({ page }) => {
  const requests = trackRequests(page);
  const cont = page.getByRole("button", { name: /Continue/ });
  await chooseFront(page, "front.jpg");
  await expect(cont).toBeDisabled();
  await expect(page.locator("#continue-blockers")).toHaveText(/Confirm you have permission/);
  await page.getByRole("checkbox", { name: /I am the person in this photo/ }).check();
  await expect(cont).toBeEnabled();
  await cont.click();

  await expect(page.getByRole("heading", { name: "Ready for secure upload" })).toBeVisible();
  await expect(page.getByTestId("upload-unavailable")).toContainText("Uploading isn’t available yet");
  await expect(page.getByTestId("upload-unavailable")).toContainText("Nothing has been uploaded");
  await expect(page.getByRole("button", { name: /upload/i })).toHaveCount(0); // no fake upload button

  // Photos never left the browser: no request carried a body, none went elsewhere.
  const origin = new URL(page.url()).origin;
  expect(requests.filter((r) => r.method !== "GET" && r.method !== "HEAD")).toEqual([]);
  expect(
    requests.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith("blob:") && !r.url.startsWith("data:")),
  ).toEqual([]);

  await page.getByRole("button", { name: "Back to photos" }).click();
  await expect(front(page)).toContainText("front.jpg");
});

test("the review step lists suggestions instead of claiming every check passed", async ({ page }) => {
  await chooseFront(page, "headwear.jpg");
  await expect(status(page)).toHaveAttribute("data-photo-status", "warn");
  // No contradiction: the framing check no longer claims the hairline is visible.
  await expect(check(page, "[data-testid=front-photo]", "visible")).toHaveText(/Face and jaw are in frame/);
  await page.getByRole("checkbox", { name: /I am the person in this photo/ }).check();
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByRole("heading", { name: "Usable, with suggestions" })).toBeVisible();
  await expect(page.getByText(/passed every check/)).toHaveCount(0);
  await expect(page.getByTestId("review-suggestions")).toContainText("Front · Head uncovered");
  await expect(page.getByTestId("upload-unavailable")).toContainText("Nothing has been uploaded");
});

for (const theme of ["dark", "light"] as const) {
  test(`has no serious accessibility violations with a photo (${theme})`, async ({ page }) => {
    await page.evaluate((t) => localStorage.setItem("ps-theme", t), theme);
    await page.reload();
    await chooseFront(page, "dark.jpg");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, JSON.stringify(serious.map((v) => [v.id, v.nodes.map((n) => n.target)]))).toEqual([]);
  });
}
