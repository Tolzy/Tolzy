/**
 * Portrait customisation settings.
 *
 * This document is stored separately from the GLB (see docs/data-model.md §4).
 * A Zod schema mirroring these types is added when settings are persisted
 * server-side; until then the types below are the single source of truth.
 */

import type { LightingPreset } from "./lighting";
import { MATERIAL_PRESET_DEFS, type MaterialParams, type MaterialPreset } from "./materials";

export type { LightingPreset } from "./lighting";
export type { MaterialParams, MaterialPreset } from "./materials";
export type DragRelease = "return" | "hold";

export type Background =
  { type: "solid"; color: string } | { type: "gradient"; from: string; to: string } | { type: "transparent" };

export interface PortraitSettings {
  /** Preset plus its adjustable parameters (defaults come from the preset). */
  material: { preset: MaterialPreset } & MaterialParams;
  lighting: {
    preset: LightingPreset;
    /** Multiplier, 0–3. */
    intensity: number;
    /** Environment yaw in degrees, −180–180. */
    rotation: number;
    shadows: boolean;
  };
  background: Background;
  motion: {
    /** Head follows the pointer. */
    tracking: boolean;
    /** Max tracking rotation in degrees (±). */
    yawLimit: number;
    pitchLimit: number;
    /** 0–1: how little pointer travel reaches the limit. */
    sensitivityX: number;
    sensitivityY: number;
    /** 0–1: higher = softer, slower movement with more inertia. */
    smoothness: number;
    /** Delay before returning to neutral (pointer left / drag released), in ms. */
    idleReturnMs: number;
    /** Click-and-drag / touch rotation. */
    dragEnabled: boolean;
    dragRelease: DragRelease;
    /** Touch drag rate relative to the mouse (1 = same). Lower = gentler swipes. */
    touchSensitivity: number;
  };
}

/** Settings for a preset with its default adjustments ("Reset to preset"). */
export function materialSettings(preset: MaterialPreset): PortraitSettings["material"] {
  return { preset, ...MATERIAL_PRESET_DEFS[preset].defaults };
}

export const DEFAULT_SETTINGS: PortraitSettings = {
  material: materialSettings("original"),
  lighting: { preset: "studio", intensity: 1, rotation: 0, shadows: true },
  background: { type: "gradient", from: "#1f1f23", to: "#0b0b0c" },
  motion: {
    tracking: true,
    yawLimit: 25,
    pitchLimit: 12,
    sensitivityX: 0.65,
    sensitivityY: 0.65,
    smoothness: 0.6,
    idleReturnMs: 600,
    dragEnabled: true,
    dragRelease: "return",
    touchSensitivity: 0.55,
  },
};

/** CSS background for the viewport, derived from the background setting. */
export function backgroundToCss(bg: Background): string | undefined {
  switch (bg.type) {
    case "solid":
      return bg.color;
    case "gradient":
      return `radial-gradient(120% 90% at 50% 38%, ${bg.from} 0%, ${bg.to} 100%)`;
    case "transparent":
      return undefined;
  }
}
