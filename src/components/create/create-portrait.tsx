"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ImageOff, Info, Lock, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { analyzePhoto } from "@/lib/photos/analyze";
import { formatBytes, formatName } from "@/lib/photos/file-checks";
import { ANGLE_SLOTS, type PhotoCheck, type SlotId } from "@/lib/photos/types";
import { UPLOADS } from "@/lib/uploads/availability";
import { readiness, usePhotoIntake, type SlotState } from "@/stores/photo-intake-store";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Tooltip } from "@/components/ui/tooltip";
import { ThemeMenu } from "@/components/theme/theme-menu";
import { CheckList, PhotoStatus } from "./check-list";
import { DropTarget, MainDropZone, SlotDropZone, useFilePicker } from "./drop-zone";
import { PhotoGuidelines } from "./guidelines";

const STEPS = ["Photos", "Upload", "Generate"] as const;

/**
 * New Portrait — step 1 (photos, checks, consent) and step 2 (review before a
 * secure upload). Photos are checked on this device; uploading needs an
 * account and an approved storage backend, so this build stops at review and
 * says so. Generation is Milestone 6.
 */
export function CreatePortrait() {
  const step = usePhotoIntake((s) => s.step);
  const reset = usePhotoIntake((s) => s.reset);
  // Leaving the page discards the selection and frees preview memory.
  useEffect(() => reset, [reset]);

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
        <ol
          aria-label="Steps"
          className="ml-auto hidden items-center gap-3 text-xs sm:absolute sm:left-1/2 sm:ml-0 sm:flex sm:-translate-x-1/2"
        >
          {STEPS.map((label, i) => {
            const current = (step === "photos" ? 0 : 1) === i;
            const done = step === "review" && i === 0;
            return (
              <li key={label} className="flex items-center gap-3">
                {i > 0 && <span aria-hidden="true" className="bg-line-strong h-px w-6" />}
                <span
                  aria-current={current ? "step" : undefined}
                  className={cn("flex items-center gap-2", current ? "text-fg font-medium" : "text-muted")}
                >
                  <span
                    className={cn(
                      "text-2xs flex size-5 items-center justify-center rounded-full",
                      current || done ? "bg-fg text-inverse" : "ring-line-strong ring-1 ring-inset",
                    )}
                  >
                    {i + 1}
                  </span>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="ml-auto sm:ml-auto">
          <ThemeMenu />
        </div>
      </header>

      <div className="border-line bg-sunken/70 border-b">
        <p className="text-muted mx-auto flex max-w-[1080px] items-center gap-2 px-5 py-2.5 text-xs sm:px-8">
          <Lock className="size-3.5 shrink-0" aria-hidden="true" />
          Photos are checked on this device and are not uploaded. Uploading needs an account, which isn’t enabled in
          this preview build.
        </p>
      </div>

      <main className="mx-auto max-w-[1080px] px-5 pt-10 pb-20 sm:px-8 md:pt-14">
        {step === "photos" ? <PhotoStep /> : <ReviewStep />}
      </main>
    </div>
  );
}

/* ───────────────────────── Step 1: photos ───────────────────────── */

function PhotoStep() {
  const slots = usePhotoIntake((s) => s.slots);
  const consent = usePhotoIntake((s) => s.consent);
  const select = usePhotoIntake((s) => s.select);
  const setConsent = usePhotoIntake((s) => s.setConsent);
  const setStep = usePhotoIntake((s) => s.setStep);
  const { ready, blockers } = readiness({ slots, consent });
  const choose = (slot: SlotId) => (file: File) => void select(slot, file, analyzePhoto);

  return (
    <>
      <h2 className="text-xl font-semibold tracking-[-0.015em]">Start with a photo</h2>
      <p className="text-muted mt-2 max-w-[56ch] text-sm">
        One clear, front-facing photo is required. Extra angles are optional and help reconstruct the sides of the head.
      </p>

      <div className="mt-8 grid gap-12 md:grid-cols-[minmax(0,1fr)_340px] md:gap-14">
        <div className="min-w-0">
          <section aria-labelledby="front-heading">
            <h3 id="front-heading" className="sr-only">
              Front photo (required)
            </h3>
            {slots.front ? (
              <MainPhoto slot={slots.front} onFile={choose("front")} />
            ) : (
              <MainDropZone onFile={choose("front")} />
            )}
          </section>

          <AngleSlots />
        </div>

        <aside className="min-w-0">
          <PhotoGuidelines />

          <section aria-labelledby="privacy-heading" className="border-line mt-10 border-t pt-8">
            <h3 id="privacy-heading" className="flex items-center gap-2 text-sm font-medium">
              <Lock className="text-muted size-3.5" aria-hidden="true" />
              How your photos are used
            </h3>
            <p className="text-muted mt-3 text-sm">
              Checks run in your browser. When uploads open, photos are sent securely to build your 3D model and are
              never used to train AI. They’re deleted 30 days after generation unless you choose to keep them, and you
              can delete them at any time.
            </p>
            <div className="mt-5">
              <Checkbox checked={consent} onChange={setConsent}>
                I am the person in this photo, or I have their permission to create a 3D portrait of them.
              </Checkbox>
            </div>
          </section>

          <Button
            variant="primary"
            size="lg"
            className="mt-8 w-full"
            disabled={!ready}
            aria-describedby={ready ? undefined : "continue-blockers"}
            onClick={() => setStep("review")}
          >
            Continue
            <ArrowRight />
          </Button>
          {!ready && (
            <ul id="continue-blockers" aria-live="polite" className="text-muted mt-3 space-y-1 text-xs">
              {blockers.map((b) => (
                <li key={b}>· {b}</li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </>
  );
}

function PhotoPreview({ slot, className }: { slot: SlotState; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === slot.url)
    return (
      <div className={cn("text-muted flex flex-col items-center justify-center gap-2 text-xs", className)}>
        <ImageOff className="size-5" aria-hidden="true" />
        Preview not available
      </div>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local object URL, never uploaded
    <img
      src={slot.url}
      alt=""
      onError={() => setFailed(slot.url)}
      className={cn("object-contain", className)}
      draggable={false}
    />
  );
}

function MainPhoto({ slot, onFile }: { slot: SlotState; onFile: (file: File) => void }) {
  const remove = usePhotoIntake((s) => s.remove);
  const { open, input } = useFilePicker(onFile);
  const info = slot.result?.info;

  return (
    <DropTarget onFile={onFile}>
      <div
        className="border-line overflow-hidden rounded-xl border"
        data-testid="front-photo"
        data-metrics={slot.result?.metrics ? JSON.stringify(slot.result.metrics) : undefined}
      >
        {input}
        <div className="bg-sunken relative flex aspect-[16/10] items-center justify-center">
          <PhotoPreview slot={slot} className="absolute inset-0 size-full" />
        </div>
        <div className="border-line flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-fg truncate text-sm font-medium" title={slot.file.name}>
              {slot.file.name}
            </p>
            <p className="text-muted text-xs">
              {info && info.width ? `${formatName(info.format)} · ${info.width} × ${info.height} · ` : ""}
              {formatBytes(slot.file.size)}
            </p>
          </div>
          <PhotoStatus checking={slot.checking} result={slot.result} />
          <div className="flex gap-1">
            <Button variant="secondary" size="sm" onClick={open}>
              <RefreshCw />
              Replace
            </Button>
            <Button variant="ghost" size="sm" onClick={() => remove("front")}>
              <Trash2 />
              Remove
            </Button>
          </div>
        </div>
        <div className="border-line border-t px-4 py-4" aria-live="polite" aria-busy={slot.checking}>
          {slot.checking || !slot.result ? (
            <p className="text-muted text-sm">Checking the file, then looking for a face… this stays on your device.</p>
          ) : (
            <CheckList checks={slot.result.checks} />
          )}
        </div>
      </div>
    </DropTarget>
  );
}

function AngleSlots() {
  const slots = usePhotoIntake((s) => s.slots);
  const select = usePhotoIntake((s) => s.select);
  const added = ANGLE_SLOTS.filter((a) => slots[a.id]).length;

  return (
    <section aria-labelledby="angles-heading" className="mt-10">
      <div className="flex items-baseline gap-2">
        <h3 id="angles-heading" className="text-sm font-medium">
          More angles
        </h3>
        <span className="text-muted text-xs">Optional · {added} of 4 added</span>
      </div>
      <p className="text-muted mt-1 text-xs">Photos from the side improve the ears, jaw and the shape of the head.</p>
      <ul className="mt-4 grid max-w-[560px] grid-cols-2 gap-3 sm:grid-cols-4">
        {ANGLE_SLOTS.map((a) => (
          <li key={a.id} data-slot={a.id}>
            {slots[a.id] ? (
              <AngleCard
                id={a.id}
                label={a.label}
                slot={slots[a.id]!}
                onFile={(f) => void select(a.id, f, analyzePhoto)}
              />
            ) : (
              <SlotDropZone label={a.label} onFile={(f) => void select(a.id, f, analyzePhoto)} />
            )}
            <p className="text-fg mt-2 text-center text-xs">{a.short}</p>
            <p className="text-muted text-center text-[11px]">{slots[a.id] ? "Added" : "Empty"}</p>
          </li>
        ))}
      </ul>

      {ANGLE_SLOTS.some((a) => slots[a.id]?.result) && (
        <div className="mt-6 space-y-5">
          {ANGLE_SLOTS.filter((a) => slots[a.id]).map((a) => (
            <div key={a.id} data-angle-checks={a.id}>
              <p className="text-fg mb-2 text-xs font-medium">
                {a.label} <span className="text-muted font-normal">· {slots[a.id]!.file.name}</span>
              </p>
              {slots[a.id]!.result ? (
                <AngleChecks checks={slots[a.id]!.result!.checks} />
              ) : (
                <PhotoStatus checking result={null} />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Problems and suggestions in full; passed checks summarised in one line. */
function AngleChecks({ checks }: { checks: PhotoCheck[] }) {
  const issues = checks.filter((c) => c.status !== "pass");
  const passed = checks.length - issues.length;
  return (
    <>
      {issues.length > 0 && <CheckList checks={issues} compact />}
      <p className="text-muted mt-1.5 text-xs">
        {issues.length === 0 ? `All ${passed} checks passed.` : `${passed} other checks passed.`}
      </p>
    </>
  );
}

function AngleCard({
  id,
  label,
  slot,
  onFile,
}: {
  id: SlotId;
  label: string;
  slot: SlotState;
  onFile: (f: File) => void;
}) {
  const remove = usePhotoIntake((s) => s.remove);
  const { open, input } = useFilePicker(onFile);
  return (
    <DropTarget onFile={onFile}>
      {input}
      <div className="border-line bg-sunken relative aspect-[4/5] overflow-hidden rounded-lg border">
        <PhotoPreview slot={slot} className="absolute inset-0 size-full" />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/55 px-1.5 py-1 backdrop-blur-sm">
          <span className="[&_*]:!text-white/90">
            <PhotoStatus checking={slot.checking} result={slot.result} />
          </span>
        </div>
        <div className="absolute top-1 right-1 flex gap-1">
          <button
            type="button"
            onClick={open}
            aria-label={`Replace ${label.toLowerCase()} photo`}
            className="flex size-6 items-center justify-center rounded-md bg-black/55 text-white/90 backdrop-blur-sm hover:bg-black/70 [&_svg]:size-3.5"
          >
            <RefreshCw />
          </button>
          <button
            type="button"
            onClick={() => remove(id)}
            aria-label={`Remove ${label.toLowerCase()} photo`}
            className="flex size-6 items-center justify-center rounded-md bg-black/55 text-white/90 backdrop-blur-sm hover:bg-black/70 [&_svg]:size-3.5"
          >
            <Trash2 />
          </button>
        </div>
      </div>
    </DropTarget>
  );
}

/* ───────────────────────── Step 2: review ───────────────────────── */

function ReviewStep() {
  const slots = usePhotoIntake((s) => s.slots);
  const setStep = usePhotoIntake((s) => s.setStep);
  const chosen = [
    { id: "front" as const, label: "Front" },
    ...ANGLE_SLOTS.map((a) => ({ id: a.id, label: a.short })),
  ].filter((s) => slots[s.id]);

  return (
    <div className="max-w-[720px]">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setStep("photos")}>
        <ArrowLeft />
        Back to photos
      </Button>
      <h2 className="mt-4 text-xl font-semibold tracking-[-0.015em]">Ready for secure upload</h2>
      <p className="text-muted mt-2 text-sm">
        Your photos passed the checks on this device and consent is confirmed. The next step uploads them privately to
        your account and starts the 3D reconstruction.
      </p>

      <ul className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-5" aria-label="Selected photos">
        {chosen.map((s) => (
          <li key={s.id}>
            <div className="border-line bg-sunken relative aspect-[4/5] overflow-hidden rounded-lg border">
              <PhotoPreview slot={slots[s.id]!} className="absolute inset-0 size-full object-cover" />
            </div>
            <p className="text-fg mt-1.5 text-xs">{s.label}</p>
            <PhotoStatus checking={false} result={slots[s.id]!.result} />
          </li>
        ))}
      </ul>

      <div
        role="status"
        data-testid="upload-unavailable"
        className="border-line bg-sunken mt-8 flex gap-3 rounded-xl border p-4"
      >
        <Info className="text-muted mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="text-sm">
          <p className="text-fg font-medium">Uploading isn’t available yet</p>
          <p className="text-muted mt-1">
            {UPLOADS.reason} Nothing has been uploaded — your photos are still only on this device.
          </p>
        </div>
      </div>
    </div>
  );
}
