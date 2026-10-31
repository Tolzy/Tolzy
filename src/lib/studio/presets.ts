import { LIGHTING_PRESET_ORDER, LIGHTING_RIGS, type LightingPreset } from "./lighting";
import type { Background } from "./settings";
import { MATERIAL_PRESET_DEFS, MATERIAL_PRESET_ORDER, type MaterialPreset } from "./materials";

/*
 * Inspector metadata for presets. Previews are real renders produced by the
 * studio's own material and lighting code (`scripts/render-previews.mjs`,
 * via the development route /dev/preview-renders). "Original" has no generic
 * preview: the inspector shows the current model's own thumbnail instead.
 */

export interface PresetInfo<T extends string> {
  id: T;
  label: string;
  description: string;
  /** Rendered preview image (null for Original). */
  preview: string | null;
}

export const MATERIAL_PRESETS: PresetInfo<MaterialPreset>[] = MATERIAL_PRESET_ORDER.map((id) => ({
  id,
  label: MATERIAL_PRESET_DEFS[id].label,
  description: MATERIAL_PRESET_DEFS[id].description,
  preview: id === "original" ? null : `/previews/material-${id}.webp`,
}));

export const LIGHTING_PRESETS: PresetInfo<LightingPreset>[] = LIGHTING_PRESET_ORDER.map((id) => ({
  id,
  label: LIGHTING_RIGS[id].label,
  description: LIGHTING_RIGS[id].description,
  preview: `/previews/lighting-${id}.webp`,
}));

/** Curated complete backgrounds (Scene → Presets). The first is the default. */
export const BACKGROUND_PRESETS: { id: string; label: string; background: Background }[] = [
  { id: "studio", label: "Studio", background: { type: "gradient", from: "#1f1f23", to: "#0b0b0c" } },
  { id: "spotlight", label: "Spotlight", background: { type: "gradient", from: "#3a3a40", to: "#08080a" } },
  { id: "midnight", label: "Midnight", background: { type: "gradient", from: "#1d2433", to: "#06080c" } },
  { id: "ember", label: "Ember", background: { type: "gradient", from: "#33241c", to: "#0c0908" } },
  { id: "graphite", label: "Graphite", background: { type: "solid", color: "#161618" } },
  { id: "fog", label: "Fog", background: { type: "gradient", from: "#f1f0ec", to: "#c9c7c1" } },
  { id: "paper", label: "Paper", background: { type: "solid", color: "#f4f3ef" } },
  { id: "none", label: "Transparent", background: { type: "transparent" } },
];

/** Curated viewport colours. Dark tones first: the studio is dark by default. */
export const BACKGROUND_SWATCHES = [
  { label: "Graphite", color: "#161618" },
  { label: "Ink", color: "#0c0e13" },
  { label: "Slate", color: "#232831" },
  { label: "Umber", color: "#2a2420" },
  { label: "Fog", color: "#d9d8d4" },
  { label: "Paper", color: "#f4f3ef" },
] as const;
