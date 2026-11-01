// @vitest-environment node
/**
 * Integration tests: the real upload → generation → asset pipeline against the
 * local backend in a temporary data directory, with the development fixture
 * provider (no network, no spending).
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "ps-data-"));
Object.assign(process.env, {
  LOCAL_BACKEND: "1",
  DATA_DIR: dir,
  RECONSTRUCTION_PROVIDER: "fixture",
  FIXTURE_DURATION_MS: "400",
  RECONSTRUCTION_POLL_MS: "0",
});

const { signInLocal, userForToken } = await import("../auth");
const { storePhoto, UploadError, purgeExpiredPhotos, setKeepPhotos } = await import("../photos");
const gen = await import("../generation");
const portraits = await import("../portraits");
const { readDb } = await import("../store");
const { CONSENT_VERSION, publicStatus } = await import("../config");

const photo = (name: string) => readFileSync(`tests/fixtures/photos/${name}`);
const consent = { accepted: true, version: CONSENT_VERSION };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until(ownerId: string, jobId: string, done: (s: string) => boolean, ms = 8000) {
  const end = Date.now() + ms;
  for (;;) {
    const job = await gen.getJob(ownerId, jobId);
    if (done(job.status)) return job;
    if (Date.now() > end) throw new Error(`timeout in ${job.status}`);
    await sleep(60);
  }
}

let alice: { id: string };
let bob: { id: string };
beforeAll(async () => {
  alice = (await signInLocal("alice@example.com", "Alice")).user;
  bob = (await signInLocal("bob@example.com", "Bob")).user;
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));
beforeEach(() => {
  process.env.RECONSTRUCTION_PROVIDER = "fixture";
});

describe("auth (local backend)", () => {
  it("issues sessions and resolves them; unknown tokens resolve to nobody", async () => {
    const { token, user } = await signInLocal("carol@example.com", "Carol");
    expect((await userForToken(token))?.id).toBe(user.id);
    expect(await userForToken("forged")).toBeNull();
  });
});

describe("uploads", () => {
  it("re-encodes valid photos and strips metadata", async () => {
    const row = await storePhoto(alice.id, "front", photo("front.png"));
    expect(row.path).toMatch(/\.jpg$/);
    const stored = readFileSync(join(dir, row.path));
    expect(stored.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    // No EXIF (APP1 "Exif") segment in the stored file.
    expect(stored.includes(Buffer.from("Exif"))).toBe(false);
  });

  it.each([
    ["not-an-image.jpg", /supported image/],
    ["low-res.jpg", /at least 1024 px/],
    ["photo.heic", /HEIC/],
  ])("rejects %s server-side", async (file, message) => {
    await expect(storePhoto(alice.id, "front", photo(file))).rejects.toThrow(message);
  });

  it("rejects files over 20 MB without decoding them", async () => {
    const big = Buffer.alloc(21 * 1024 * 1024);
    big.set([0xff, 0xd8, 0xff]);
    await expect(storePhoto(alice.id, "front", big)).rejects.toBeInstanceOf(UploadError);
  });
});

describe("generation pipeline (fixture provider)", () => {
  it("runs upload → reconstruction → validated asset → portrait, using the extra angles", async () => {
    const front = await storePhoto(alice.id, "front", photo("front.jpg"));
    const side = await storePhoto(alice.id, "leftThreeQuarter", photo("three-quarter.jpg"));
    const started = await gen.startGeneration(alice.id, { photoIds: [side.id, front.id], consent });
    expect(started.status).toBe("queued");
    expect(started.provider).toMatchObject({ id: "fixture", external: false });

    const seen = new Set<string>();
    const end = Date.now() + 8000;
    let job = started;
    while (job.status !== "completed" && Date.now() < end) {
      job = await gen.getJob(alice.id, started.id);
      seen.add(job.status);
      await sleep(40);
    }
    expect(job.status).toBe("completed");
    expect(seen.has("processing")).toBe(true);
    // Front first, then the three-quarter view, as sent to the provider.
    expect(job.views).toEqual(["front", "leftThreeQuarter"]);

    const list = await portraits.listPortraits(alice.id);
    expect(list.find((p) => p.id === job.portraitId)?.status).toBe("ready");
    const model = await portraits.portraitModel(alice.id, job.portraitId);
    expect(model?.data.subarray(0, 4).toString()).toBe("glTF");
    const detail = await portraits.getPortrait(alice.id, job.portraitId);
    expect(detail?.manifest).toMatchObject({ profile: { ok: true } });

    // Retention clock started for the photos used.
    const db = await readDb();
    expect(db.photos.find((p) => p.id === front.id)?.deleteAfter).toBeTruthy();
    expect(db.consents.find((c) => c.id === db.jobs.find((j) => j.id === job.id)!.consentId)?.version).toBe(
      CONSENT_VERSION,
    );
  });

  it("normalises a fused, Z-up, centimetre model and still finds the head and neck", async () => {
    const front = await storePhoto(alice.id, "front", photo("front.jpg"));
    const s = await gen.startGeneration(alice.id, { photoIds: [front.id], consent, scenario: "fused" });
    const job = await until(alice.id, s.id, (x) => x === "completed" || x === "failed");
    expect(job.status).toBe("completed");
    const detail = await portraits.getPortrait(alice.id, job.portraitId);
    expect((detail?.manifest as { meshes: number }).meshes).toBe(1);
    expect((detail?.manifest as { profile: { ok: boolean } }).profile.ok).toBe(true);
  });

  it("requires consent and a front photo", async () => {
    const side = await storePhoto(alice.id, "leftProfile", photo("profile.jpg"));
    await expect(gen.startGeneration(alice.id, { photoIds: [side.id], consent })).rejects.toThrow(/front-facing/);
    const front = await storePhoto(alice.id, "front", photo("front.jpg"));
    await expect(
      gen.startGeneration(alice.id, { photoIds: [front.id], consent: { accepted: false, version: CONSENT_VERSION } }),
    ).rejects.toThrow(/consent/);
    await expect(
      gen.startGeneration(alice.id, { photoIds: [front.id], consent: { accepted: true, version: "old" } }),
    ).rejects.toThrow(/consent/);
  });

  it("fails cleanly on provider errors and succeeds on retry", async () => {
    const front = await storePhoto(alice.id, "front", photo("front.jpg"));
    const s = await gen.startGeneration(alice.id, { photoIds: [front.id], consent, scenario: "fail-once" });
    const failed = await until(alice.id, s.id, (x) => x === "failed" || x === "completed");
    expect(failed.status).toBe("failed");
    expect(failed.error).toMatchObject({ code: "reconstruction_failed", retryable: true });
    expect(failed.canRetry).toBe(true);
    expect((await portraits.listPortraits(alice.id)).some((p) => p.id === s.portraitId)).toBe(false);

    // Photos of an unfinished generation are scheduled for deletion (7 days)…
    const photoRow = async () => (await readDb()).photos.find((p) => p.id === front.id)!;
    const in7 = Date.now() + 7 * 86_400_000;
    expect(Math.abs(Date.parse((await photoRow()).deleteAfter!) - in7)).toBeLessThan(60_000);

    const retried = await gen.retryJob(alice.id, s.id);
    expect(retried.attempts).toBe(2);
    // …and the schedule is cleared while it runs again.
    expect((await photoRow()).deleteAfter).toBeNull();
    const done = await until(alice.id, s.id, (x) => x === "completed" || x === "failed");
    expect(done.status).toBe("completed");
  });

  it("rejects an invalid model returned by the provider", async () => {
    const front = await storePhoto(alice.id, "front", photo("front.jpg"));
    const s = await gen.startGeneration(alice.id, { photoIds: [front.id], consent, scenario: "invalid-glb" });
    const job = await until(alice.id, s.id, (x) => x === "failed" || x === "completed");
    expect(job.status).toBe("failed");
    expect(job.error?.code).toBe("model_not_glb");
    expect(await portraits.portraitModel(alice.id, s.portraitId)).toBeNull();
  });

  it("stops retrying after the attempt limit", async () => {
    const front = await storePhoto(alice.id, "front", photo("front.jpg"));
    const s = await gen.startGeneration(alice.id, { photoIds: [front.id], consent, scenario: "fail" });
    for (let i = 1; i < gen.MAX_ATTEMPTS; i++) {
      await until(alice.id, s.id, (x) => x === "failed");
      await gen.retryJob(alice.id, s.id);
    }
    const last = await until(alice.id, s.id, (x) => x === "failed");
    expect(last.canRetry).toBe(false);
    await expect(gen.retryJob(alice.id, s.id)).rejects.toThrow(/too many/);
  });

  it("cancels a running job", async () => {
    const front = await storePhoto(alice.id, "front", photo("front.jpg"));
    const s = await gen.startGeneration(alice.id, { photoIds: [front.id], consent, scenario: "slow" });
    await until(alice.id, s.id, (x) => x === "submitted" || x === "processing");
    const cancelled = await gen.cancelJob(alice.id, s.id);
    expect(cancelled.status).toBe("cancelled");
    expect((await readDb()).photos.find((p) => p.id === front.id)!.deleteAfter).not.toBeNull();
  });
});

describe("privacy and access control", () => {
  it("never shows one user's jobs, portraits, models or photos to another", async () => {
    const front = await storePhoto(alice.id, "front", photo("front.jpg"));
    const s = await gen.startGeneration(alice.id, { photoIds: [front.id], consent });
    const done = await until(alice.id, s.id, (x) => x === "completed");
    await expect(gen.getJob(bob.id, s.id)).rejects.toThrow(/not found/);
    expect(await portraits.getPortrait(bob.id, done.portraitId)).toBeNull();
    expect(await portraits.portraitModel(bob.id, done.portraitId)).toBeNull();
    expect((await portraits.listPortraits(bob.id)).length).toBe(0);
    // Bob can't generate from Alice's photos.
    await expect(gen.startGeneration(bob.id, { photoIds: [front.id], consent })).rejects.toThrow(/not found/);
  });

  it("keeping photos stops deletion; turning it off schedules used photos again", async () => {
    const carol = (await signInLocal("carol@example.com", "Carol")).user;
    const front = await storePhoto(carol.id, "front", photo("front.jpg"));
    const s = await gen.startGeneration(carol.id, { photoIds: [front.id], consent });
    await until(carol.id, s.id, (x) => x === "completed");
    const row = async () => (await readDb()).photos.find((p) => p.id === front.id)!;
    expect((await row()).deleteAfter).not.toBeNull();
    await setKeepPhotos(carol.id, true);
    expect(await row()).toMatchObject({ keep: true, deleteAfter: null });
    await setKeepPhotos(carol.id, false);
    expect((await row()).keep).toBe(false);
    expect((await row()).deleteAfter).not.toBeNull();
    // An unused photo (no generation yet) gets no deletion date.
    const unused = await storePhoto(carol.id, "front", photo("front.jpg"));
    await setKeepPhotos(carol.id, false);
    expect((await readDb()).photos.find((p) => p.id === unused.id)!.deleteAfter).toBeNull();
    // …but it is removed after a day if no generation uses it.
    await purgeExpiredPhotos(new Date(Date.now() + 12 * 3_600_000));
    expect((await readDb()).photos.some((p) => p.id === unused.id)).toBe(true);
    await purgeExpiredPhotos(new Date(Date.now() + 25 * 3_600_000));
    expect((await readDb()).photos.some((p) => p.id === unused.id)).toBe(false);
  });

  it("deletes photos after the retention period unless kept", async () => {
    const before = (await readDb()).photos.filter((p) => p.deleteAfter).length;
    expect(before).toBeGreaterThan(0);
    const removed = await purgeExpiredPhotos(new Date(Date.now() + 31 * 86_400_000));
    expect(removed).toBeGreaterThanOrEqual(before); // plus any uploads no generation used
    expect((await readDb()).photos.filter((p) => p.deleteAfter).length).toBe(0);
  });

  it("deletes a portrait's model and thumbnail", async () => {
    const front = await storePhoto(alice.id, "front", photo("front.jpg"));
    const s = await gen.startGeneration(alice.id, { photoIds: [front.id], consent });
    const done = await until(alice.id, s.id, (x) => x === "completed");
    expect(await portraits.deletePortrait(bob.id, done.portraitId)).toBe(false);
    expect(await portraits.deletePortrait(alice.id, done.portraitId)).toBe(true);
    expect(await portraits.portraitModel(alice.id, done.portraitId)).toBeNull();
  });

  it("exposes no provider key and keeps external providers off without approval", () => {
    process.env.RECONSTRUCTION_PROVIDER = "meshy";
    process.env.RECONSTRUCTION_API_KEY = "sk-secret-test-key";
    const status = publicStatus();
    expect(JSON.stringify(status)).not.toContain("sk-secret");
    expect(status.provider).toMatchObject({ id: "meshy", enabled: false, reason: "Awaiting product-owner approval." });
    delete process.env.RECONSTRUCTION_API_KEY;
  });
});
