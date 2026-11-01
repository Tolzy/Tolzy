import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/*
 * Milestone 6 — reconstruction, end to end in the browser.
 *
 * Runs against the local backend with the development fixture provider (see
 * playwright.config.ts): accounts, uploads, consent, the job pipeline, model
 * validation and normalisation are all real; only the provider is a fixture,
 * which returns bundled models after real waiting and status polling. No
 * external service is contacted.
 */

test.describe.configure({ timeout: 150_000 });

const PHOTOS = "tests/fixtures/photos";
const CONSENT = { accepted: true, version: "2026-10-31" };
const unique = (tag: string) => `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;

async function signIn(page: Page, tag = "user") {
  const res = await page.request.post("/api/auth/local", { data: { email: unique(tag), name: "Test" } });
  expect(res.ok()).toBe(true);
}

/** Uploads photos and starts a job through the same API the create flow uses. */
async function startJob(page: Page, scenario?: string): Promise<{ id: string; portraitId: string }> {
  const photoIds: string[] = [];
  for (const [slot, file] of [
    ["front", "front.jpg"],
    ["leftThreeQuarter", "three-quarter.jpg"],
  ] as const) {
    const res = await page.request.post("/api/uploads", {
      multipart: { slot, file: { name: file, mimeType: "image/jpeg", buffer: readFileSync(`${PHOTOS}/${file}`) } },
    });
    expect(res.status()).toBe(200);
    photoIds.push((await res.json()).photo.id);
  }
  const res = await page.request.post("/api/generations", { data: { photoIds, consent: CONSENT, scenario } });
  expect(res.status()).toBe(201);
  return (await res.json()).job;
}

const stage = (page: Page, id: string) => page.locator(`[data-stage=${id}]`);
const studioSurface = (page: Page) => page.locator("[data-viewport] [data-testid=viewer-surface]");

test("signed-out users can't upload, generate or read models", async ({ request }) => {
  expect((await request.post("/api/uploads", { multipart: { slot: "front" } })).status()).toBe(401);
  expect((await request.post("/api/generations", { data: { photoIds: [], consent: CONSENT } })).status()).toBe(401);
  expect((await request.get("/api/portraits/prt_anything/model")).status()).toBe(401);
});

test("full flow: photos → sign in → consent → real stages → portrait in the Studio and dashboard", async ({ page }) => {
  await page.goto("/create");
  await page.locator("[data-testid=main-drop-zone] input[type=file]").setInputFiles(`${PHOTOS}/front.jpg`);
  await page.locator("[data-slot=leftThreeQuarter] input[type=file]").setInputFiles(`${PHOTOS}/three-quarter.jpg`);
  await expect(page.locator("[data-photo-status]")).toHaveCount(2, { timeout: 60_000 });
  await page.getByRole("checkbox", { name: /I am the person/ }).check();
  await page.getByRole("button", { name: /Continue/ }).click();

  // Authentication before any upload.
  await expect(page.getByTestId("upload-unavailable")).toContainText("Sign in to upload");
  await page.getByRole("button", { name: "Sign in" }).last().click();
  await page.getByLabel("Email").fill(unique("flow"));
  await page.getByRole("dialog").getByRole("button", { name: "Sign in" }).click();

  // The provider is disclosed before consent to processing.
  await expect(page.getByTestId("provider-name")).toContainText("Development fixture");
  await page.getByRole("button", { name: "Upload and generate" }).click();
  await page.waitForURL(/\/generate\/job_/, { timeout: 30_000 });

  await expect(page.getByTestId("fixture-notice")).toBeVisible();
  await expect(page.getByText(/2 photos \(front \+ 1 angle\)/)).toBeVisible();
  // Real stages, in order; the provider's own percentage while reconstructing.
  await expect(stage(page, "reconstruct")).toHaveAttribute("data-state", "active", { timeout: 30_000 });
  await expect(stage(page, "prepare")).toHaveAttribute("data-state", "done");
  await expect(stage(page, "send")).toHaveAttribute("data-state", "done");
  await expect(page.getByTestId("provider-progress")).toContainText("reported by the provider");
  await expect(page.getByRole("heading", { name: /ready/i })).toBeVisible({ timeout: 60_000 });
  for (const id of ["prepare", "send", "reconstruct", "receive", "check", "finish"])
    await expect(stage(page, id)).toHaveAttribute("data-state", "done");

  // The thumbnail is rendered from the real model and stored.
  await expect(page.getByTestId("result-preview")).toHaveAttribute("data-thumbnail-saved", "true", { timeout: 60_000 });

  await page.getByRole("link", { name: "Open in Studio" }).click();
  await expect(studioSurface(page)).toHaveAttribute("data-segmented", "true", { timeout: 60_000 });

  await page.goto("/dashboard");
  const cards = page.getByRole("region", { name: "Your portraits" });
  await expect(cards.getByText("Fixture", { exact: true })).toBeVisible();
  // The sample stays, and stays distinguishable.
  await expect(cards.getByText("Sample", { exact: true })).toBeVisible();
});

test("a provider-like fused model in another orientation and scale is normalised and segmented", async ({ page }) => {
  await signIn(page, "fused");
  const job = await startJob(page, "fused");
  await page.goto(`/generate/${job.id}`);
  await expect(page.getByRole("heading", { name: /ready/i })).toBeVisible({ timeout: 60_000 });
  await page.goto(`/studio/${job.portraitId}`);
  const surface = studioSurface(page);
  await expect(surface).toHaveAttribute("data-segmented", "true", { timeout: 60_000 });
  const regions = (await surface.getAttribute("data-regions"))!.split(",");
  expect(regions).toEqual(expect.arrayContaining(["head", "face", "neck", "bust"]));
  // One fused surface: hair and eyes aren't separate parts, and say so.
  expect(regions).not.toContain("hair");
  await page.getByRole("navigation", { name: "Properties" }).getByRole("button", { name: "Model" }).click();
  const hair = page.getByRole("list", { name: "Model parts" }).locator("[data-region=hair]");
  await expect(hair).toContainText("Not separable");
  // Upright after normalisation: taller than wide.
  const box = await page.request.get(`/api/portraits/${job.portraitId}`).then((r) => r.json());
  expect(box.portrait.manifest.orientation[0]).toBeCloseTo(-Math.PI / 2, 2);
});

test("a failed reconstruction can be retried and then succeeds", async ({ page }) => {
  await signIn(page, "retry");
  const job = await startJob(page, "fail-once");
  await page.goto(`/generate/${job.id}`);
  await expect(page.getByRole("alert").filter({ hasText: "simulated" })).toBeVisible({ timeout: 60_000 });
  await expect(stage(page, "reconstruct")).toHaveAttribute("data-state", "failed");
  await expect(page.getByText("attempt 1 of 3")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: /ready/i })).toBeVisible({ timeout: 60_000 });
});

test("an invalid returned model is rejected instead of shown", async ({ page }) => {
  await signIn(page, "invalid");
  const job = await startJob(page, "invalid-glb");
  await page.goto(`/generate/${job.id}`);
  await expect(page.getByRole("alert").filter({ hasText: "can’t be used" })).toBeVisible({ timeout: 60_000 });
  await expect(stage(page, "check")).toHaveAttribute("data-state", "failed");
  await expect(page.getByRole("link", { name: "Open in Studio" })).toHaveCount(0);
  // No portrait is listed for a failed job.
  await page.goto("/dashboard");
  await expect(page.getByRole("region", { name: "Your portraits" }).getByText("Fixture", { exact: true })).toHaveCount(
    0,
  );
});

test("a running generation can be cancelled", async ({ page }) => {
  await signIn(page, "cancel");
  const job = await startJob(page, "slow");
  await page.goto(`/generate/${job.id}`);
  await expect(stage(page, "reconstruct")).toHaveAttribute("data-state", "active", { timeout: 30_000 });
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: /cancel/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Use different photos" })).toBeVisible();
});

test("portraits and models are private to their owner", async ({ browser }) => {
  const owner = await browser.newPage();
  await signIn(owner, "owner");
  const job = await startJob(owner, "default");
  await owner.goto(`/generate/${job.id}`);
  await expect(owner.getByRole("heading", { name: /ready/i })).toBeVisible({ timeout: 60_000 });
  const model = await owner.request.get(`/api/portraits/${job.portraitId}/model`);
  expect(model.status()).toBe(200);
  expect(model.headers()["cache-control"]).toContain("no-store");

  const other = await browser.newPage();
  await signIn(other, "other");
  expect((await other.request.get(`/api/portraits/${job.portraitId}/model`)).status()).toBe(404);
  expect((await other.request.get(`/api/generations/${job.id}`)).status()).toBe(404);
  await other.goto(`/studio/${job.portraitId}`);
  await expect(other.getByText(/not found|doesn’t exist|could not be found/i).first()).toBeVisible();
  await owner.close();
  await other.close();
});

test("no provider secrets reach the browser", async ({ page }) => {
  const status = await (await page.request.get("/api/status")).json();
  expect(JSON.stringify(status)).not.toMatch(/key|secret|token/i);
  await page.goto("/create");
  const html = await page.content();
  expect(html).not.toMatch(/RECONSTRUCTION_API_KEY|msy_/);
});

test("Storage settings show the user's files and delete photographs on request", async ({ page }) => {
  await signIn(page, "storage");
  const job = await startJob(page, "default");
  await page.goto(`/generate/${job.id}`);
  await expect(page.getByRole("heading", { name: /ready/i })).toBeVisible({ timeout: 60_000 });

  await page.goto("/settings/storage");
  await expect(page.getByText(/^2 files ·/)).toBeVisible();
  await expect(page.getByText(/^1 file ·/)).toBeVisible(); // the model
  await expect(page.getByText(/Deleted automatically — next on/)).toBeVisible();

  await page.getByRole("switch", { name: "Keep my photographs" }).click();
  await expect(page.getByTestId("storage-message")).toHaveText("Your photographs will be kept.");
  await expect(page.getByText("Kept until you delete them.").first()).toBeVisible();

  await page.getByRole("button", { name: "Delete photographs" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("storage-message")).toHaveText("2 photographs deleted.");
  await expect(page.getByText(/^0 files ·/)).toBeVisible();
  // The portrait itself is unaffected.
  expect((await page.request.get(`/api/portraits/${job.portraitId}/model`)).status()).toBe(200);
});
