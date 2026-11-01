"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Info, LoaderCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ANGLE_SLOTS, type SlotId } from "@/lib/photos/types";
import { usePhotoIntake } from "@/stores/photo-intake-store";
import { useAppStatus } from "@/components/account/use-account";
import { SignInDialog } from "@/components/account/sign-in-dialog";
import { Button } from "@/components/ui/button";

const LABEL: Record<SlotId, string> = {
  front: "Front",
  ...Object.fromEntries(ANGLE_SLOTS.map((a) => [a.id, a.short])),
} as Record<SlotId, string>;

/** Uploads one photo with real progress events (fetch has no upload progress). */
function upload(slot: SlotId, file: File, onProgress: (f: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      const body = (() => {
        try {
          return JSON.parse(xhr.responseText) as { photo?: { id: string }; error?: string };
        } catch {
          return {};
        }
      })();
      if (xhr.status >= 200 && xhr.status < 300 && body.photo) resolve(body.photo.id);
      else reject(new Error(body.error ?? "Upload failed."));
    };
    xhr.onerror = () => reject(new Error("Network error — check your connection and try again."));
    const form = new FormData();
    form.append("slot", slot);
    form.append("file", file);
    xhr.send(form);
  });
}

type Phase =
  | { kind: "idle" }
  | { kind: "uploading"; progress: Partial<Record<SlotId, number>> }
  | { kind: "starting" }
  | { kind: "error"; message: string };

/**
 * The review step's action: secure upload, then generation. Shown only when
 * the backend, a signed-in user and an enabled provider all exist; otherwise
 * it says exactly what is missing. Nothing is uploaded before the click.
 */
export function GenerateAction() {
  const status = useAppStatus();
  const slots = usePhotoIntake((s) => s.slots);
  const consent = usePhotoIntake((s) => s.consent);
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  if (!status) return <Note title="Checking what this build supports…" />;
  if (status.backend === "none")
    return (
      <Note title="Uploading isn’t available yet">
        Uploads need an account, and sign-in isn’t enabled in this preview build. Nothing has been uploaded — your
        photos are still only on this device.
      </Note>
    );
  if (!status.user)
    return (
      <Note title="Sign in to upload">
        Photos are uploaded privately to your account. Nothing has been uploaded yet.
        <div className="mt-3">
          <SignInDialog trigger={<Button variant="primary">Sign in</Button>} />
        </div>
      </Note>
    );
  if (!status.provider?.enabled)
    return (
      <Note title="Generation isn’t switched on yet">
        {status.provider
          ? `${status.provider.name}: ${status.provider.reason ?? "not available."}`
          : "No reconstruction provider is configured."}{" "}
        No photos are sent to a provider without the product owner’s approval. Nothing has been uploaded.
      </Note>
    );

  const chosen = (["front", ...ANGLE_SLOTS.map((a) => a.id)] as SlotId[]).filter((s) => slots[s]);
  const go = async () => {
    try {
      setPhase({ kind: "uploading", progress: {} });
      const ids: string[] = [];
      for (const slot of chosen) {
        ids.push(
          await upload(slot, slots[slot]!.file, (f) =>
            setPhase((p) =>
              p.kind === "uploading" ? { kind: "uploading", progress: { ...p.progress, [slot]: f } } : p,
            ),
          ),
        );
      }
      setPhase({ kind: "starting" });
      const scenario = new URLSearchParams(window.location.search).get("scenario"); // fixture provider only (tests)
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoIds: ids,
          consent: { accepted: consent, version: status.consentVersion },
          scenario,
        }),
      });
      const body = (await res.json()) as { job?: { id: string }; error?: string };
      if (!res.ok || !body.job) throw new Error(body.error ?? "Generation couldn’t start.");
      router.push(`/generate/${body.job.id}`);
    } catch (e) {
      setPhase({ kind: "error", message: (e as Error).message });
    }
  };

  const busy = phase.kind === "uploading" || phase.kind === "starting";
  return (
    <div className="border-line mt-8 rounded-xl border p-4" data-testid="generate-action">
      <p className="text-fg flex items-center gap-2 text-sm font-medium">
        <ShieldCheck className="text-success size-4" aria-hidden="true" />
        Who processes your photos
      </p>
      <dl className="text-muted mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt>Provider</dt>
        <dd className="text-fg" data-testid="provider-name">
          {status.provider.name}
        </dd>
        <dt>Processing</dt>
        <dd>{status.provider.processing}</dd>
        <dt>Retention</dt>
        <dd>Photos are deleted 30 days after your portrait is generated unless you choose to keep them.</dd>
        <dt>Training</dt>
        <dd>Never used to train AI.</dd>
      </dl>

      {phase.kind === "uploading" && (
        <ul className="mt-4 space-y-2" aria-label="Upload progress">
          {chosen.map((slot) => {
            const f = phase.progress[slot] ?? 0;
            return (
              <li key={slot} className="text-xs">
                <div className="flex justify-between">
                  <span className="text-fg">{LABEL[slot]}</span>
                  <span className="tabular text-muted">{Math.round(f * 100)}%</span>
                </div>
                <div className="bg-active mt-1 h-1 overflow-hidden rounded-full">
                  <div className="bg-fg h-full transition-[width] duration-150" style={{ width: `${f * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {phase.kind === "error" && (
        <p role="alert" className="text-danger mt-4 text-sm">
          {phase.message}
        </p>
      )}
      <Button variant="primary" size="lg" className="mt-5 w-full" disabled={busy || !consent} onClick={go}>
        {busy ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : null}
        {phase.kind === "uploading"
          ? "Uploading securely…"
          : phase.kind === "starting"
            ? "Starting…"
            : "Upload and generate"}
        {!busy && <ArrowRight />}
      </Button>
    </div>
  );
}

function Note({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div
      role="status"
      data-testid="upload-unavailable"
      className="border-line bg-sunken mt-8 flex gap-3 rounded-xl border p-4"
    >
      <Info className="text-muted mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="text-sm">
        <p className="text-fg font-medium">{title}</p>
        {children && <div className="text-muted mt-1">{children}</div>}
      </div>
    </div>
  );
}
