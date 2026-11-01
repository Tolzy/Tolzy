import "server-only";

import { activeProvider, providerById } from "@/lib/reconstruction/registry";
import { ProviderError, type ProviderErrorInfo, type ReconstructionView } from "@/lib/reconstruction/types";
import type { SlotId } from "@/lib/photos/types";
import { CONSENT_VERSION, FAILED_PHOTO_RETENTION_DAYS, PHOTO_RETENTION_DAYS, providerConfig } from "./config";
import { inspectModel, ModelError } from "./model-pipeline";
import { ownedPhotos } from "./photos";
import { mutate, newId, now, readDb, readFileRel, writeFileRel, type JobRow, type JobStatus } from "./store";

export const MAX_ATTEMPTS = 3;
/** Provider jobs not finished within this window are marked failed. */
const TIMEOUT_MS = 30 * 60_000;
/** Minimum gap between provider status calls for one job (configurable for tests). */
const pollMs = () => Number(process.env.RECONSTRUCTION_POLL_MS || 2_000);

export class GenerationError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/* ───────────────────────── Public view ───────────────────────── */

export type StageId = "prepare" | "send" | "reconstruct" | "receive" | "check" | "finish";
export const STAGES: { id: StageId; label: string }[] = [
  { id: "prepare", label: "Preparing photographs" },
  { id: "send", label: "Sending to reconstruction" },
  { id: "reconstruct", label: "Reconstructing geometry and textures" },
  { id: "receive", label: "Receiving the 3D model" },
  { id: "check", label: "Checking and preparing the model" },
  { id: "finish", label: "Finalising portrait" },
];
const STAGE_OF: Record<JobStatus, StageId> = {
  queued: "prepare",
  preparing: "prepare",
  submitted: "send",
  processing: "reconstruct",
  downloading: "receive",
  validating: "check",
  completed: "finish",
  failed: "prepare",
  cancelled: "prepare",
};

export interface JobView {
  id: string;
  portraitId: string;
  status: JobStatus;
  stage: StageId;
  /** Provider-reported percentage for the reconstruct stage, or null. */
  progress: number | null;
  error: ProviderErrorInfo | null;
  attempts: number;
  canRetry: boolean;
  canCancel: boolean;
  provider: { id: string; name: string; external: boolean };
  views: SlotId[];
  createdAt: string;
  submittedAt: string | null;
  finishedAt: string | null;
  /** The stage reached before failing (for showing where it stopped). */
  failedAt: StageId | null;
}

function view(job: JobRow, photos: { id: string; slot: SlotId }[]): JobView {
  const provider = providerById(job.providerId);
  const cfg = providerConfig();
  const active = !["completed", "failed", "cancelled"].includes(job.status);
  const caps = provider?.capabilities;
  return {
    id: job.id,
    portraitId: job.portraitId,
    status: job.status,
    stage: STAGE_OF[job.status],
    progress: job.status === "processing" ? job.progress : job.status === "completed" ? 100 : null,
    error: job.error,
    attempts: job.attempts,
    canRetry: job.status === "failed" && job.attempts < MAX_ATTEMPTS && !!provider,
    canCancel:
      active &&
      (job.status === "queued" ||
        job.status === "preparing" ||
        (job.status === "submitted" && !!caps?.cancelQueued) ||
        (job.status === "processing" && !!caps?.cancelProcessing)),
    provider: {
      id: job.providerId,
      name: cfg?.id === job.providerId ? cfg.name : job.providerId,
      external: cfg?.id === job.providerId ? cfg.external : true,
    },
    views: job.photoIds.map((id) => photos.find((p) => p.id === id)?.slot).filter((s): s is SlotId => !!s),
    createdAt: job.createdAt,
    submittedAt: job.submittedAt,
    finishedAt: job.finishedAt,
    failedAt:
      job.status === "failed"
        ? ((job.error?.code.startsWith("model_") ? "check" : job.submittedAt ? "reconstruct" : "send") as StageId)
        : null,
  };
}

/* ───────────────────────── Start ───────────────────────── */

export interface StartInput {
  photoIds: string[];
  consent: { accepted: boolean; version: string };
  name?: string;
  scenario?: string | null;
}

/**
 * Starts a generation: checks ownership of every photo, requires a front
 * photo and the current consent, records the consent, and creates the
 * portrait (status "generating") and its job. Nothing is sent to a provider
 * until the job advances.
 */
export async function startGeneration(ownerId: string, input: StartInput): Promise<JobView> {
  const provider = activeProvider();
  const cfg = providerConfig();
  if (!provider || !cfg) throw new GenerationError(cfg?.reason ?? "No reconstruction provider is enabled.", 503);
  if (!input.consent?.accepted || input.consent.version !== CONSENT_VERSION)
    throw new GenerationError("Please confirm consent before generating.", 400);
  const ids = [...new Set(input.photoIds)];
  const photos = await ownedPhotos(ownerId, ids);
  if (photos.length !== ids.length) throw new GenerationError("One or more photos were not found.", 404);
  if (!photos.some((p) => p.slot === "front")) throw new GenerationError("A front-facing photo is required.", 400);
  if (new Set(photos.map((p) => p.slot)).size !== photos.length)
    throw new GenerationError("Each angle can have one photo.", 400);
  const scenario = provider.id === "fixture" ? (input.scenario ?? null) : null; // scenarios never reach real providers

  const at = now();
  const job = await mutate((db) => {
    const consent = {
      id: newId("con"),
      ownerId,
      version: CONSENT_VERSION,
      providerId: provider.id,
      photoIds: ids,
      acceptedAt: at,
    };
    const portraitId = newId("prt");
    const job: JobRow = {
      id: newId("job"),
      ownerId,
      portraitId,
      providerId: provider.id,
      providerJobId: null,
      status: "queued",
      progress: null,
      photoIds: ids,
      consentId: consent.id,
      attempts: 1,
      error: null,
      scenario,
      createdAt: at,
      updatedAt: at,
      submittedAt: null,
      finishedAt: null,
      nextPollAt: null,
    };
    db.consents.push(consent);
    db.portraits.push({
      id: portraitId,
      ownerId,
      name: input.name?.trim().slice(0, 80) || (provider.id === "fixture" ? "Fixture portrait" : "New portrait"),
      status: "generating",
      providerId: provider.id,
      jobId: job.id,
      assetId: null,
      thumbnailPath: null,
      createdAt: at,
    });
    db.jobs.push(job);
    return job;
  });
  return view(job, photos);
}

/* ───────────────────────── Advance ───────────────────────── */

const running = new Map<string, Promise<void>>();

/** Moves a job forward as far as it can right now (idempotent, one at a time per job). */
export function advanceJob(jobId: string): Promise<void> {
  const current = running.get(jobId);
  if (current) return current;
  const run = step(jobId).finally(() => running.delete(jobId));
  running.set(jobId, run);
  return run;
}

async function update(jobId: string, patch: Partial<JobRow>) {
  return mutate((db) => {
    const job = db.jobs.find((j) => j.id === jobId)!;
    Object.assign(job, patch, { updatedAt: now() });
    if (patch.status === "failed" || patch.status === "cancelled") {
      const portrait = db.portraits.find((p) => p.id === job.portraitId);
      if (portrait && portrait.status !== "ready") portrait.status = "failed";
      // Photos of a generation that didn't finish aren't kept indefinitely;
      // retrying within the window clears this again.
      const deleteAfter = new Date(Date.now() + FAILED_PHOTO_RETENTION_DAYS * 86_400_000).toISOString();
      for (const p of db.photos)
        if (job.photoIds.includes(p.id) && !p.keep && !p.deleteAfter) p.deleteAfter = deleteAfter;
    }
    return { ...job };
  });
}

const fail = (jobId: string, error: ProviderErrorInfo) =>
  update(jobId, { status: "failed", error, finishedAt: now(), nextPollAt: null });

async function step(jobId: string): Promise<void> {
  let job = (await readDb()).jobs.find((j) => j.id === jobId);
  if (!job || ["completed", "failed", "cancelled"].includes(job.status)) return;
  const provider = providerById(job.providerId);
  if (!provider) {
    await fail(jobId, {
      code: "provider_unavailable",
      message: "The reconstruction provider is no longer available.",
      retryable: false,
    });
    return;
  }

  try {
    if (job.status === "queued") {
      job = await update(jobId, { status: "preparing" });
      // Front first, then the extra angles the provider can use (in its order).
      const photos = await ownedPhotos(job.ownerId, job.photoIds);
      const front = photos.find((p) => p.slot === "front");
      if (!front)
        return void (await fail(jobId, { code: "no_front", message: "The front photo is missing.", retryable: false }));
      const extras = provider.capabilities.viewPriority
        .map((slot) => photos.find((p) => p.slot === slot))
        .filter((p): p is NonNullable<typeof p> => !!p)
        .slice(0, provider.capabilities.maxViews - 1);
      const views: ReconstructionView[] = [];
      for (const p of [front, ...extras])
        views.push({ slot: p.slot, data: await readFileRel(p.path), mime: "image/jpeg" });
      const { providerJobId } = await provider.submit({ views, scenario: job.scenario, attempt: job.attempts });
      job = await update(jobId, {
        status: "submitted",
        providerJobId,
        submittedAt: now(),
        nextPollAt: new Date(Date.now() + pollMs()).toISOString(),
        // Record which photos were actually sent.
        photoIds: views.map((v) => [front, ...extras].find((p) => p.slot === v.slot)!.id),
      });
      return;
    }

    if ((job.status === "submitted" || job.status === "processing") && job.providerJobId) {
      if (job.nextPollAt && job.nextPollAt > now()) return;
      if (job.submittedAt && Date.now() - Date.parse(job.submittedAt) > TIMEOUT_MS)
        return void (await fail(jobId, {
          code: "timeout",
          message: "Reconstruction took too long and was stopped.",
          retryable: true,
        }));
      const s = await provider.status(job.providerJobId);
      const next = new Date(Date.now() + pollMs()).toISOString();
      if (s.state === "queued") return void (await update(jobId, { status: "submitted", nextPollAt: next }));
      if (s.state === "processing")
        return void (await update(jobId, { status: "processing", progress: s.progress, nextPollAt: next }));
      if (s.state === "failed")
        return void (await fail(
          jobId,
          s.error ?? { code: "reconstruction_failed", message: "The reconstruction failed.", retryable: true },
        ));
      if (s.state === "cancelled")
        return void (await update(jobId, { status: "cancelled", finishedAt: now(), nextPollAt: null }));

      // Succeeded: download, validate, store.
      job = await update(jobId, { status: "downloading", progress: 100, nextPollAt: null });
      const data = await provider.fetchResult(job.providerJobId!);
      job = await update(jobId, { status: "validating" });
      let manifest;
      try {
        manifest = await inspectModel(data);
      } catch (e) {
        const err = e as ModelError;
        return void (await fail(jobId, {
          code: `model_${err.code ?? "invalid"}`,
          message: `The returned model can’t be used: ${err.message}`,
          retryable: true,
        }));
      }
      const assetId = newId("ast");
      const path = `files/${job.ownerId}/models/${assetId}.glb`;
      await writeFileRel(path, data); // the original asset, unchanged
      const deleteAfter = new Date(Date.now() + PHOTO_RETENTION_DAYS * 86_400_000).toISOString();
      await mutate((db) => {
        const j = db.jobs.find((x) => x.id === jobId)!;
        db.assets.push({
          id: assetId,
          ownerId: j.ownerId,
          portraitId: j.portraitId,
          path,
          bytes: data.length,
          triangles: manifest.triangles,
          manifest: manifest as unknown as Record<string, unknown>,
          createdAt: now(),
        });
        const portrait = db.portraits.find((p) => p.id === j.portraitId)!;
        portrait.assetId = assetId;
        portrait.status = "ready";
        // Retention clock starts at generation (unless the owner keeps photos).
        for (const p of db.photos) if (j.photoIds.includes(p.id) && !p.keep) p.deleteAfter = deleteAfter;
        Object.assign(j, { status: "completed", finishedAt: now(), updatedAt: now(), error: null });
      });
      if (provider.capabilities.deletesRemoteData) {
        // Privacy: remove the provider's copy once we have the model. Best effort.
        await provider.deleteRemote?.(job.providerJobId!).catch(() => undefined);
      }
    }
  } catch (e) {
    const info: ProviderErrorInfo =
      e instanceof ProviderError
        ? e.info
        : { code: "internal", message: "Something went wrong while generating.", retryable: true };
    await fail(jobId, info);
  }
}

/* ───────────────────────── Read / retry / cancel ───────────────────────── */

async function ownedJob(ownerId: string, jobId: string) {
  const db = await readDb();
  const job = db.jobs.find((j) => j.id === jobId && j.ownerId === ownerId);
  if (!job) throw new GenerationError("Generation not found.", 404);
  return { job, photos: db.photos.filter((p) => job.photoIds.includes(p.id)) };
}

/** Advances the job (if due) and returns its current state. */
export async function getJob(ownerId: string, jobId: string): Promise<JobView> {
  await ownedJob(ownerId, jobId);
  await advanceJob(jobId);
  const { job, photos } = await ownedJob(ownerId, jobId);
  return view(job, photos);
}

/** Retries a failed job from the start with the same photos and consent. */
export async function retryJob(ownerId: string, jobId: string): Promise<JobView> {
  const { job } = await ownedJob(ownerId, jobId);
  if (job.status !== "failed") throw new GenerationError("Only failed generations can be retried.", 409);
  if (job.attempts >= MAX_ATTEMPTS) throw new GenerationError("This generation has been retried too many times.", 409);
  const photos = await ownedPhotos(ownerId, job.photoIds);
  if (photos.length !== job.photoIds.length)
    throw new GenerationError("Some photos have been deleted. Start a new portrait.", 410);
  await mutate((db) => {
    const j = db.jobs.find((x) => x.id === jobId)!;
    Object.assign(j, {
      status: "queued",
      attempts: j.attempts + 1,
      error: null,
      providerJobId: null,
      progress: null,
      submittedAt: null,
      finishedAt: null,
      nextPollAt: null,
      updatedAt: now(),
    });
    const portrait = db.portraits.find((p) => p.id === j.portraitId);
    if (portrait) portrait.status = "generating";
    for (const p of db.photos) if (j.photoIds.includes(p.id)) p.deleteAfter = null;
  });
  return getJob(ownerId, jobId);
}

export async function cancelJob(ownerId: string, jobId: string): Promise<JobView> {
  const { job, photos } = await ownedJob(ownerId, jobId);
  const v = view(job, photos);
  if (!v.canCancel) throw new GenerationError("This generation can’t be cancelled at this stage.", 409);
  const provider = providerById(job.providerId);
  if (job.providerJobId) await provider?.cancel?.(job.providerJobId);
  await update(jobId, { status: "cancelled", finishedAt: now(), nextPollAt: null });
  return getJob(ownerId, jobId);
}

/** Cron: advance every active job (so jobs finish even if nobody is watching). */
export async function advanceAllJobs(): Promise<number> {
  const db = await readDb();
  const active = db.jobs.filter((j) => !["completed", "failed", "cancelled"].includes(j.status));
  for (const j of active) await advanceJob(j.id);
  return active.length;
}
