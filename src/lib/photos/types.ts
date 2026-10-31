/** Photo slots on the New Portrait page. Only "front" is required. */
export type SlotId = "front" | "leftThreeQuarter" | "rightThreeQuarter" | "leftProfile" | "rightProfile";

export const ANGLE_SLOTS: { id: Exclude<SlotId, "front">; label: string; short: string; hint: string }[] = [
  {
    id: "leftThreeQuarter",
    label: "Left three-quarter",
    short: "Left ¾",
    hint: "Turn your head about 45° to your right, so your left cheek faces the camera.",
  },
  {
    id: "rightThreeQuarter",
    label: "Right three-quarter",
    short: "Right ¾",
    hint: "Turn your head about 45° to your left, so your right cheek faces the camera.",
  },
  { id: "leftProfile", label: "Left profile", short: "Left profile", hint: "Side view showing your left ear." },
  { id: "rightProfile", label: "Right profile", short: "Right profile", hint: "Side view showing your right ear." },
];

export type CheckStatus = "pass" | "warn" | "fail";

export type CheckId =
  | "format"
  | "size"
  | "decode"
  | "resolution"
  | "face"
  | "single"
  | "faceSize"
  | "pose"
  | "visible"
  | "eyes"
  | "headwear"
  | "expression"
  | "sharpness"
  | "lighting";

export interface PhotoCheck {
  id: CheckId;
  /** Short name shown in the checklist ("Sharp focus"). */
  label: string;
  status: CheckStatus;
  /** One line: what we found and, if needed, what to do. */
  message: string;
}

export interface PhotoInfo {
  format: ImageFormat;
  bytes: number;
  width: number;
  height: number;
}

export type ImageFormat = "jpeg" | "png" | "webp" | "heic";

export interface PhotoResult {
  checks: PhotoCheck[];
  info: PhotoInfo | null;
  /** Worst status across checks: "fail" blocks progression, "warn" allows it. */
  status: CheckStatus;
  /** True only when the face checks actually ran (model loaded and executed). */
  faceChecksRan: boolean;
  /** Raw measurements behind the checks (for diagnostics and tests). */
  metrics?: Partial<
    Record<
      | "sharpness"
      | "p5"
      | "p95"
      | "mean"
      | "sideRatio"
      | "yaw"
      | "pitch"
      | "faceHeight"
      | "crownColourfulness"
      | "crownSpread"
      | "crownSkinDistance"
      | "skinColourfulness",
      number
    >
  >;
}

export function worstStatus(checks: PhotoCheck[]): CheckStatus {
  if (checks.some((c) => c.status === "fail")) return "fail";
  if (checks.some((c) => c.status === "warn")) return "warn";
  return "pass";
}
