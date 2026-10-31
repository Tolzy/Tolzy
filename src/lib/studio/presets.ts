import { LIGHTING_PRESET_ORDER, LIGHTING_RIGS, type LightingPreset } from "./lighting";
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

/** Curated viewport backgrounds. Dark tones first: the studio is dark by default. */
export const BACKGROUND_SWATCHES = [
  { label: "Graphite", color: "#161618" },
  { label: "Ink", color: "#0c0e13" },
  { label: "Slate", color: "#232831" },
  { label: "Umber", color: "#2a2420" },
  { label: "Fog", color: "#d9d8d4" },
  { label: "Paper", color: "#f4f3ef" },
] as const;
