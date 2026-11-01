"use client";

import Link from "next/link";
import { Check, CircleX, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { DEFAULT_SETTINGS } from "@/lib/studio/settings";
import type { ModelFraming } from "@/lib/studio/sample-model";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/display";
import { ThemeMenu } from "@/components/theme/theme-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { LazyViewer } from "@/components/viewer/lazy-viewer";

type StageId = "prepare" | "send" | "reconstruct" | "receive" | "check" | "finish";
const STAGES: { id: StageId; label: string; detail: string }[] = [
  { id: "prepare", label: "Preparing photographs", detail: "Checking and orienting your photos, front view first." },
  {
    id: "send",
    label: "Sending to reconstruction",
    detail: "Securely handing the photos to the reconstruction service.",
  },
  {
    id: "reconstruct",
    label: "Reconstructing geometry and textures",
    detail: "Building the head’s shape and skin from your photos.",
  },
  { id: "receive", label: "Receiving the 3D model", detail: "Downloading the finished model." },
  {
    id: "check",
    label: "Checking and preparing the model",
    detail: "Validating the file, finding orientation, scale and the neck.",
  },
  { id: "finish", label: "Finalising portrait", detail: "Saving it to your portraits." },
];

interface Job {
  id: string;
  portraitId: string;
  status:
    | "queued"
    | "preparing"
    | "submitted"
    | "processing"
    | "downloading"
    | "validating"
    | "completed"
    | "failed"
    | "cancelled";
  stage: StageId;
  progress: number | null;
  error: { code: string; message: string; retryable: boolean } | null;
  attempts: number;
  canRetry: boolean;
  canCancel: boolean;
  provider: { id: string; name: string; external: boolean };
  views: string[];
  createdAt: string;
  submittedAt: string | null;
  failedAt: StageId | null;
}

const POLL_MS = 1500;

function elapsed(from: string) {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(from)) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function GenerationScreen({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch(`/api/generations/${jobId}`, { cache: "no-store" });
    const body = (await res.json().catch(() => ({}))) as { job?: Job; error?: string };
    if (!res.ok || !body.job) return setError(body.error ?? "This generation couldn’t be loaded.");
    setJob(body.job);
  }, [jobId]);

  const active = job && !["completed", "failed", "cancelled"].includes(job.status);
  // First load, then poll while the job is active.
  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      void load();
      tick((n) => n + 1);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [active, load]);

  const act = async (action: "retry" | "cancel") => {
    setBusy(true);
    const res = await fetch(`/api/generations/${jobId}/${action}`, { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as { job?: Job; error?: string };
    setBusy(false);
    if (body.job) setJob(body.job);
    else setError(body.error ?? "That didn’t work.");
  };

  const title =
    job?.status === "completed"
      ? "Your portrait is ready"
      : job?.status === "failed"
        ? "Generation didn’t finish"
        : job?.status === "cancelled"
          ? "Generation cancelled"
          : "Building your portrait";

  return (
    <div className="bg-surface min-h-dvh">
      <header className="border-line bg-surface/95 sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-3 backdrop-blur-sm sm:px-5">
        <Tooltip content="Close">
          <Button variant="ghost" iconOnly asChild>
            <Link href="/dashboard" aria-label="Close and return to portraits">
              <X />
            </Link>
          </Button>
        </Tooltip>
        <h1 className="text-sm font-medium">New portrait</h1>
        <div className="ml-auto">
          <ThemeMenu />
        </div>
      </header>

      <main className="mx-auto grid max-w-[1080px] gap-10 px-5 pt-10 pb-20 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:pt-14">
        <section aria-labelledby="gen-title" aria-busy={!!active}>
          <h2 id="gen-title" className="text-xl font-semibold tracking-[-0.015em]">
            {title}
          </h2>
          {error && (
            <p role="alert" className="text-danger mt-3 text-sm">
              {error}
            </p>
          )}
          {job && (
            <>
              <p className="text-muted mt-2 text-sm">
                Processed by <span className="text-fg">{job.provider.name}</span>
                {job.views.length > 1
                  ? ` · ${job.views.length} photos (front + ${job.views.length - 1} angle${job.views.length > 2 ? "s" : ""})`
                  : " · front photo"}
                {active ? ` · running for ${elapsed(job.submittedAt ?? job.createdAt)}` : ""}
              </p>
              {job.provider.id === "fixture" && (
                <p
                  className="bg-warning-soft text-warning mt-4 rounded-lg px-3 py-2 text-xs"
                  data-testid="fixture-notice"
                >
                  Development fixture: this runs the real pipeline but returns the sample head — it is not a
                  reconstruction of your photo.
                </p>
              )}
              <ol className="mt-8 space-y-4" aria-label="Generation stages" data-testid="stages">
                {STAGES.map((s, i) => {
                  const current = STAGES.findIndex(
                    (x) => x.id === (job.status === "failed" ? job.failedAt : job.stage),
                  );
                  const state =
                    job.status === "completed"
                      ? "done"
                      : job.status === "failed" && i === current
                        ? "failed"
                        : job.status === "cancelled"
                          ? i < current
                            ? "done"
                            : "pending"
                          : i < current
                            ? "done"
                            : i === current
                              ? "active"
                              : "pending";
                  return (
                    <li key={s.id} data-stage={s.id} data-state={state} className="flex gap-3">
                      <span
                        className={cn(
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full [&_svg]:size-3.5",
                          state === "done" && "bg-success text-white",
                          state === "active" && "ring-fg text-fg ring-2 ring-inset",
                          state === "failed" && "bg-danger text-white",
                          state === "pending" && "ring-line-strong ring-1 ring-inset",
                        )}
                        aria-hidden="true"
                      >
                        {state === "done" ? (
                          <Check />
                        ) : state === "failed" ? (
                          <X />
                        ) : state === "active" ? (
                          <LoaderCircle className="animate-spin motion-reduce:animate-none" />
                        ) : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm", state === "pending" ? "text-muted" : "text-fg font-medium")}>
                          {s.label}
                          <span className="sr-only"> — {state}</span>
                        </p>
                        {(state === "active" || state === "failed") && <p className="text-muted text-xs">{s.detail}</p>}
                        {state === "active" &&
                          s.id === "reconstruct" &&
                          (job.progress !== null ? (
                            <div className="mt-2" data-testid="provider-progress">
                              <div className="bg-active h-1 overflow-hidden rounded-full">
                                <div
                                  className="bg-fg h-full transition-[width] duration-500"
                                  style={{ width: `${job.progress}%` }}
                                />
                              </div>
                              <p className="tabular text-muted text-2xs mt-1">
                                {job.progress}% — reported by the provider
                              </p>
                            </div>
                          ) : (
                            <p className="text-muted text-2xs mt-1">
                              In progress — the provider doesn’t report a percentage.
                            </p>
                          ))}
                      </div>
                    </li>
                  );
                })}
              </ol>

              {job.status === "failed" && job.error && (
                <div role="alert" className="border-danger/30 bg-danger-soft mt-8 flex gap-3 rounded-xl border p-4">
                  <CircleX className="text-danger mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <div className="text-sm">
                    <p className="text-fg font-medium">{job.error.message}</p>
                    <p className="text-muted mt-1">
                      {job.canRetry
                        ? `Your photos and consent are kept, so you can try again (attempt ${job.attempts} of 3).`
                        : "Try again with different photos."}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-8 flex flex-wrap gap-2">
                {job.status === "completed" && (
                  <Button variant="primary" asChild>
                    <Link href={`/studio/${job.portraitId}`}>Open in Studio</Link>
                  </Button>
                )}
                {job.canRetry && (
                  <Button variant="primary" disabled={busy} onClick={() => act("retry")}>
                    <RotateCcw />
                    Try again
                  </Button>
                )}
                {job.canCancel && (
                  <Button variant="secondary" disabled={busy} onClick={() => act("cancel")}>
                    Cancel
                  </Button>
                )}
                {(job.status === "failed" || job.status === "cancelled") && (
                  <Button variant="ghost" asChild>
                    <Link href="/create">Use different photos</Link>
                  </Button>
                )}
              </div>
              {active && (
                <p className="text-muted mt-4 text-xs">
                  You can leave this page — generation continues, and the portrait appears on your dashboard.
                </p>
              )}
            </>
          )}
        </section>

        <section aria-label="Preview">
          {job?.status === "completed" ? (
            <ResultPreview portraitId={job.portraitId} fixture={job.provider.id === "fixture"} />
          ) : (
            <PreviewPlaceholder active={!!active} />
          )}
        </section>
      </main>
    </div>
  );
}

function PreviewPlaceholder({ active }: { active: boolean }) {
  return (
    <div className="bg-vp relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl">
      <p className="text-vp-muted text-sm">{active ? "Your model appears here when it’s ready." : "No model."}</p>
    </div>
  );
}

/** The real generated model, plus a thumbnail rendered from it for the dashboard. */
function ResultPreview({ portraitId, fixture }: { portraitId: string; fixture: boolean }) {
  const [framing, setFraming] = useState<ModelFraming | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    void fetch(`/api/portraits/${portraitId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(
        (b: {
          portrait?: {
            manifest?: { orientation: [number, number, number]; framing: { pivot: number; focus: number } };
          };
        }) => {
          const m = b.portrait?.manifest;
          setFraming(
            m
              ? { orientation: m.orientation, pivot: m.framing.pivot, focus: m.framing.focus }
              : { orientation: [0, 0, 0], pivot: 0.62, focus: 0.6 },
          );
        },
      );
  }, [portraitId]);

  const onCapture = useCallback(
    async (blob: Blob) => {
      const res = await fetch(`/api/portraits/${portraitId}/thumbnail`, { method: "PUT", body: blob });
      setSaved(res.ok);
    },
    [portraitId],
  );

  return (
    <div>
      <div
        className="relative aspect-[4/5] overflow-hidden rounded-xl"
        style={{ background: "radial-gradient(120% 90% at 50% 38%, #1f1f23 0%, #0b0b0c 100%)" }}
        data-testid="result-preview"
        data-thumbnail-saved={saved || undefined}
      >
        {framing && (
          <LazyViewer
            url={`/api/portraits/${portraitId}/model`}
            framing={framing}
            material={DEFAULT_SETTINGS.material}
            background={DEFAULT_SETTINGS.background}
            lighting={DEFAULT_SETTINGS.lighting}
            motion={{ ...DEFAULT_SETTINGS.motion, tracking: false }}
            reducedMotion
            zoom={100}
            resetKey={0}
            label="Generated portrait"
            geometry={DEFAULT_SETTINGS.geometry}
            regionMaterials={{}}
            selectedRegion={null}
            onCapture={onCapture}
          />
        )}
        {fixture && (
          <Badge tone="onImage" className="absolute top-3 left-3">
            Fixture — sample head
          </Badge>
        )}
      </div>
    </div>
  );
}
