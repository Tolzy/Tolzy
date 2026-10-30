/**
 * Portrait customisation settings.
 *
 * This document is stored separately from the GLB (see docs/data-model.md §4).
 * A Zod schema mirroring these types is added when settings are persisted
 * server-side; until then the types below are the single source of truth.
 */

export type MaterialPreset = "original" | "chrome" | "obsidian" | "ceramic" | "glass" | "gold";
export type LightingPreset = "studio" | "softbox" | "rim" | "dramatic" | "daylight";
export type DragRelease = "return" | "hold";

export type Background =
  { type: "solid"; color: string } | { type: "gradient"; from: string; to: string } | { type: "transparent" };

export interface PortraitSettings {
  material: {
    preset: MaterialPreset;
    /** 0–1. Only applies to non-original presets. */
    roughness: number;
    tint: string;
  };
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

export const MATERIAL_DEFAULTS: Record<MaterialPreset, { roughness: number; tint: string }> = {
  original: { roughness: 0.5, tint: "#ffffff" },
  chrome: { roughness: 0.06, tint: "#ffffff" },
  obsidian: { roughness: 0.18, tint: "#0b0b0c" },
  ceramic: { roughness: 0.38, tint: "#f2efe9" },
  glass: { roughness: 0.05, tint: "#ffffff" },
  gold: { roughness: 0.22, tint: "#f5c66b" },
};

export const DEFAULT_SETTINGS: PortraitSettings = {
  material: { preset: "original", ...MATERIAL_DEFAULTS.original },
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
