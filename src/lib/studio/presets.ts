import type { LightingPreset, MaterialPreset } from "./settings";

/*
 * Preview swatches for the inspector. These are CSS illustrations that
 * communicate each preset's character; they are replaced by real renders of
 * the sample head once the material system lands (Milestone 4).
 */

export interface MaterialPresetInfo {
  id: MaterialPreset;
  label: string;
  description: string;
  swatch: string;
}

export const MATERIAL_PRESETS: MaterialPresetInfo[] = [
  {
    id: "original",
    label: "Original",
    description: "Reconstructed skin and hair textures.",
    swatch: "radial-gradient(circle at 34% 28%, #f6dccb 0%, #d9a588 22%, #a8705a 48%, #5b3a2e 74%, #2a1b16 100%)",
  },
  {
    id: "chrome",
    label: "Chrome",
    description: "Mirror metal that reflects the studio.",
    swatch:
      "radial-gradient(circle at 34% 26%, #ffffff 0%, #ffffff 6%, transparent 14%), linear-gradient(176deg, #f4f5f7 0%, #b9bec7 30%, #3d4149 47%, #0e0f12 52%, #6d727c 68%, #d8dbe0 86%, #8e939b 100%)",
  },
  {
    id: "obsidian",
    label: "Obsidian",
    description: "Black volcanic glass with a lacquer finish.",
    swatch:
      "radial-gradient(circle at 33% 26%, #9a9aa2 0%, #3a3a3f 7%, transparent 16%), radial-gradient(circle at 50% 55%, #1a1a1d 0%, #0a0a0b 62%, #000 100%)",
  },
  {
    id: "ceramic",
    label: "Ceramic",
    description: "Glazed porcelain, soft and bright.",
    swatch: "radial-gradient(circle at 34% 28%, #ffffff 0%, #fbfaf7 18%, #e9e6df 46%, #bdb9b0 78%, #8f8b83 100%)",
  },
  {
    id: "glass",
    label: "Glass",
    description: "Clear refractive glass.",
    swatch:
      "radial-gradient(circle at 33% 27%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.35) 6%, transparent 14%), radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.06) 58%, rgba(255,255,255,0.32) 84%, rgba(255,255,255,0.08) 100%)",
  },
  {
    id: "gold",
    label: "Gold",
    description: "Polished yellow gold.",
    swatch:
      "radial-gradient(circle at 34% 26%, #fff6d8 0%, #fff6d8 5%, transparent 13%), linear-gradient(172deg, #fbe3a2 0%, #e2ad4d 30%, #8a5a17 50%, #3b2608 56%, #a7782b 74%, #f0c56c 92%, #b58934 100%)",
  },
];

export interface LightingPresetInfo {
  id: LightingPreset;
  label: string;
  description: string;
  /** Background of the swatch sphere. */
  swatch: string;
}

export const LIGHTING_PRESETS: LightingPresetInfo[] = [
  {
    id: "studio",
    label: "Studio",
    description: "Balanced key and fill with a soft rim.",
    swatch: "radial-gradient(circle at 36% 30%, #f2f2f0 0%, #b9b9b6 30%, #5d5d5c 70%, #2b2b2c 100%)",
  },
  {
    id: "softbox",
    label: "Softbox",
    description: "Large, wrapping light with gentle shadows.",
    swatch: "radial-gradient(circle at 42% 34%, #f4f4f2 0%, #d5d5d2 40%, #9a9a98 80%, #6f6f6e 100%)",
  },
  {
    id: "rim",
    label: "Rim",
    description: "Dark front, bright contour from behind.",
    swatch: "radial-gradient(circle at 50% 50%, #18181a 0%, #18181a 60%, #6a6a6c 82%, #f0f0ee 94%, #3a3a3c 100%)",
  },
  {
    id: "dramatic",
    label: "Dramatic",
    description: "Hard side light, deep shadows.",
    swatch: "linear-gradient(90deg, #f2f2f0 0%, #a8a8a6 30%, #2a2a2b 52%, #0e0e0f 100%)",
  },
  {
    id: "daylight",
    label: "Daylight",
    description: "Warm sun with a cool sky fill.",
    swatch: "radial-gradient(circle at 34% 28%, #fff4e2 0%, #e2cfb3 30%, #7d8794 72%, #3c4652 100%)",
  },
];

/** Curated viewport backgrounds. Dark tones first: the studio is dark by default. */
export const BACKGROUND_SWATCHES = [
  { label: "Graphite", color: "#161618" },
  { label: "Ink", color: "#0c0e13" },
  { label: "Slate", color: "#232831" },
  { label: "Umber", color: "#2a2420" },
  { label: "Fog", color: "#d9d8d4" },
  { label: "Paper", color: "#f4f3ef" },
] as const;
