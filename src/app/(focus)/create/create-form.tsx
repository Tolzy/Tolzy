"use client";

import { Check, Lock, Plus, ScanFace } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";

const GUIDELINES = [
  "Face the camera with a relaxed, neutral expression",
  "Soft, even light — no harsh shadows across the face",
  "Hair, ears and jawline visible; no hat or sunglasses",
  "Only one person in the frame",
  "Sharp focus, at least 1024 px on the short edge",
];

const ANGLES = ["Left ¾", "Right ¾", "Left profile", "Right profile"];

/**
 * Step 1 of portrait creation. Upload, face checks and generation are wired
 * up in Milestones 5–6; until then the drop zone is visibly unavailable.
 */
export function CreatePortraitForm() {
  const [consent, setConsent] = useState(false);

  return (
    <>
      <h2 className="text-xl font-semibold tracking-[-0.015em]">Start with a photo</h2>
      <p className="text-muted mt-2 max-w-[52ch] text-sm">
        One clear, front-facing photo is enough. Extra angles help us reconstruct the sides of the head more accurately.
      </p>
      <div className="mt-8 grid gap-12 md:grid-cols-[minmax(0,1fr)_340px] md:gap-14">
        <div>
          <div className="border-line-strong bg-bg flex aspect-[16/10] w-full flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center">
            <span className="bg-surface text-muted ring-line flex size-14 items-center justify-center rounded-full shadow-[0_1px_2px_rgb(16_16_18/0.06)] ring-1">
              <ScanFace className="size-6" strokeWidth={1.5} />
            </span>
            <p className="text-md text-fg mt-5 font-medium">Drop a photo here</p>
            <p className="text-muted mt-1 text-sm">or</p>
            <Button className="mt-3" aria-disabled="true">
              Choose a file
            </Button>
            <p className="text-muted mt-5 text-xs">JPG, PNG, WebP or HEIC · up to 20 MB</p>
          </div>

          <section aria-labelledby="angles-heading" className="mt-10">
            <div className="flex items-baseline gap-2">
              <h3 id="angles-heading" className="text-sm font-medium">
                More angles
              </h3>
              <span className="text-muted text-xs">Optional</span>
            </div>
            <p className="text-muted mt-1 text-xs">
              Photos from the side improve the ears, jaw and the shape of the head.
            </p>
            <ul className="mt-4 grid max-w-[460px] grid-cols-4 gap-3">
              {ANGLES.map((angle) => (
                <li key={angle}>
                  <div className="border-line-strong bg-bg text-subtle flex aspect-[4/5] items-center justify-center rounded-lg border border-dashed">
                    <Plus className="size-4" aria-hidden="true" />
                  </div>
                  <p className="text-muted mt-2 text-center text-xs">{angle}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside>
          <section aria-labelledby="guidelines-heading">
            <h3 id="guidelines-heading" className="text-sm font-medium">
              What makes a good photo
            </h3>
            <ul className="mt-4 space-y-3">
              {GUIDELINES.map((g) => (
                <li key={g} className="text-muted flex gap-2.5 text-sm">
                  <Check className="text-success mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {g}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="privacy-heading" className="border-line mt-10 border-t pt-8">
            <h3 id="privacy-heading" className="flex items-center gap-2 text-sm font-medium">
              <Lock className="text-muted size-3.5" aria-hidden="true" />
              How your photo is used
            </h3>
            <p className="text-muted mt-3 text-sm">
              Your photo is sent securely to our 3D reconstruction partner to build your model. It is never used to
              train AI. We delete it 30 days after generation unless you choose to keep it, and you can delete it at any
              time.
            </p>
            <div className="mt-5">
              <Checkbox checked={consent} onChange={setConsent}>
                I am the person in this photo, or I have their permission to create a 3D portrait of them.
              </Checkbox>
            </div>
          </section>

          <Button variant="primary" size="lg" className="mt-8 w-full" aria-disabled="true">
            Generate portrait
          </Button>
          <p className="text-muted mt-2.5 text-center text-xs">Sign in to upload and generate.</p>
        </aside>
      </div>
    </>
  );
}
