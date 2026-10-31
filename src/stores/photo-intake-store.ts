import { create } from "zustand";
import { ANGLE_SLOTS, type PhotoResult, type SlotId } from "@/lib/photos/types";

export interface SlotState {
  file: File;
  /** Object URL for the preview (revoked on replace/remove/reset). */
  url: string;
  checking: boolean;
  result: PhotoResult | null;
  /** Increments on every selection so late results for replaced files are ignored. */
  version: number;
}

type Analyze = (file: File, slot: SlotId) => Promise<PhotoResult>;

interface PhotoIntake {
  slots: Partial<Record<SlotId, SlotState>>;
  consent: boolean;
  step: "photos" | "review";
  select: (slot: SlotId, file: File, analyze: Analyze) => Promise<void>;
  remove: (slot: SlotId) => void;
  setConsent: (consent: boolean) => void;
  setStep: (step: "photos" | "review") => void;
  reset: () => void;
}

let version = 0;

/**
 * Photos chosen on the New Portrait page. They stay in this browser tab:
 * nothing here uploads (uploading needs an account — docs/roadmap.md M5).
 */
export const usePhotoIntake = create<PhotoIntake>()((set, get) => ({
  slots: {},
  consent: false,
  step: "photos",

  select: async (slot, file, analyze) => {
    const previous = get().slots[slot];
    if (previous) URL.revokeObjectURL(previous.url);
    const v = ++version;
    set((s) => ({
      slots: { ...s.slots, [slot]: { file, url: URL.createObjectURL(file), checking: true, result: null, version: v } },
      step: "photos",
    }));
    let result: PhotoResult;
    try {
      result = await analyze(file, slot);
    } catch {
      result = {
        checks: [
          {
            id: "decode",
            label: "Readable image",
            status: "fail",
            message: "Something went wrong while checking this photo. Try again or choose another.",
          },
        ],
        info: null,
        status: "fail",
        faceChecksRan: false,
      };
    }
    const current = get().slots[slot];
    if (current?.version !== v) return; // replaced or removed meanwhile
    set((s) => ({ slots: { ...s.slots, [slot]: { ...current, checking: false, result } } }));
  },

  remove: (slot) => {
    const current = get().slots[slot];
    if (!current) return;
    URL.revokeObjectURL(current.url);
    set((s) => {
      const slots = { ...s.slots };
      delete slots[slot];
      return { slots, step: "photos" };
    });
  },

  setConsent: (consent) => set({ consent }),
  setStep: (step) => set({ step }),
  reset: () => {
    for (const s of Object.values(get().slots)) if (s) URL.revokeObjectURL(s.url);
    set({ slots: {}, consent: false, step: "photos" });
  },
}));

export interface Readiness {
  ready: boolean;
  /** What still blocks progression, in plain language. */
  blockers: string[];
}

/** Everything required before the user can continue (pure; unit-tested). */
export function readiness(state: Pick<PhotoIntake, "slots" | "consent">): Readiness {
  const blockers: string[] = [];
  const front = state.slots.front;
  if (!front) blockers.push("Add a front-facing photo.");
  else if (front.checking) blockers.push("Wait for the photo check to finish.");
  else if (front.result?.status === "fail") blockers.push("Replace the front photo — it didn’t pass the checks.");
  for (const a of ANGLE_SLOTS) {
    const s = state.slots[a.id];
    if (s?.checking) blockers.push(`Wait for the ${a.label.toLowerCase()} check to finish.`);
    else if (s?.result?.status === "fail") blockers.push(`Replace or remove the ${a.label.toLowerCase()} photo.`);
  }
  if (!state.consent) blockers.push("Confirm you have permission to use this photo.");
  return { ready: blockers.length === 0, blockers: [...new Set(blockers)] };
}
