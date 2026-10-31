/**
 * Material presets — pure data shared by the renderer, the inspector and tests.
 *
 * Every preset (except Original) is a physically based Three.js
 * MeshPhysicalMaterial configuration. The renderer applies it to whatever
 * model is loaded (sample or generated portrait); nothing here is specific to
 * the sample head. Colours are sRGB hex strings.
 */

export type MaterialPreset = "original" | "chrome" | "obsidian" | "ceramic" | "glass" | "gold";

/** User-adjustable parameters stored in portrait settings. */
export interface MaterialParams {
  /** Base colour / tint (Glass: absorption tint). */
  tint: string;
  /** 0–1. */
  roughness: number;
  /** 0–1. */
  metalness: number;
  /** 0–1: lacquer / glaze layer strength. */
  clearcoat: number;
  /** Glass only: optical thickness in model units (model height = 1). */
  thickness: number;
  /** 0–1: surface opacity. Not offered for Glass (transmission is its transparency). */
  opacity: number;
}

export type AdjustControl = keyof MaterialParams;

/** Fixed (non-adjustable) physical properties of a preset. */
export interface PresetPhysics {
  clearcoatRoughness: number;
  transmission: number;
  ior: number;
  /** Rainbow fringing of transmitted light (Glass). */
  dispersion: number;
  /** How far light travels in Glass before taking on the tint (model units). */
  attenuationDistance: number;
  specularIntensity: number;
  sheen: number;
  sheenRoughness: number;
  envMapIntensity: number;
  /** Strength of the model's own normal map on this material (0 = smooth). */
  normalScale: number;
}

export interface MaterialPresetDef {
  id: MaterialPreset;
  label: string;
  description: string;
  /** Default adjustable values ("Reset to preset" restores these). */
  defaults: MaterialParams;
  physics: PresetPhysics;
  /** Adjust controls shown for this preset, in order. */
  controls: AdjustControl[];
  /** Ranges for adjustable values where they differ from 0–1. */
  ranges?: Partial<Record<AdjustControl, [number, number]>>;
}

const BASE_PHYSICS: PresetPhysics = {
  clearcoatRoughness: 0.08,
  transmission: 0,
  ior: 1.5,
  dispersion: 0,
  attenuationDistance: Infinity,
  specularIntensity: 1,
  sheen: 0,
  sheenRoughness: 0.5,
  envMapIntensity: 1,
  normalScale: 0.3,
};

const NO_PARAMS: MaterialParams = {
  tint: "#ffffff",
  roughness: 0.5,
  metalness: 0,
  clearcoat: 0,
  thickness: 0,
  opacity: 1,
};

export const MATERIAL_PRESET_DEFS: Record<MaterialPreset, MaterialPresetDef> = {
  original: {
    id: "original",
    label: "Original",
    description: "The model’s own skin and hair textures.",
    defaults: NO_PARAMS,
    physics: BASE_PHYSICS,
    // The model's own textures stay untouched; only opacity applies.
    controls: ["opacity"],
  },
  chrome: {
    id: "chrome",
    label: "Chrome",
    description: "Polished mirror metal that reflects the studio.",
    defaults: { tint: "#f4f6f8", roughness: 0.07, metalness: 1, clearcoat: 0, thickness: 0, opacity: 1 },
    physics: { ...BASE_PHYSICS, envMapIntensity: 1.35, normalScale: 0.25 },
    controls: ["tint", "roughness", "metalness", "opacity"],
  },
  obsidian: {
    id: "obsidian",
    label: "Obsidian",
    description: "Black volcanic glass under a deep lacquer.",
    defaults: { tint: "#0d0d0f", roughness: 0.16, metalness: 0, clearcoat: 1, thickness: 0, opacity: 1 },
    physics: {
      ...BASE_PHYSICS,
      clearcoatRoughness: 0.04,
      specularIntensity: 1,
      envMapIntensity: 1.1,
      normalScale: 0.2,
    },
    controls: ["tint", "roughness", "metalness", "clearcoat", "opacity"],
  },
  ceramic: {
    id: "ceramic",
    label: "Ceramic",
    description: "Glazed porcelain — soft body, glossy glaze.",
    defaults: { tint: "#f2eee7", roughness: 0.45, metalness: 0, clearcoat: 0.65, thickness: 0, opacity: 1 },
    physics: {
      ...BASE_PHYSICS,
      clearcoatRoughness: 0.1,
      sheen: 0.25,
      sheenRoughness: 0.6,
      envMapIntensity: 0.85,
      normalScale: 0.12,
    },
    controls: ["tint", "roughness", "metalness", "clearcoat", "opacity"],
  },
  glass: {
    id: "glass",
    label: "Glass",
    description: "Clear refractive glass with real transmission.",
    defaults: { tint: "#e8f1ff", roughness: 0.04, metalness: 0, clearcoat: 0, thickness: 0.45, opacity: 1 },
    physics: {
      ...BASE_PHYSICS,
      // A little diffuse body keeps the bust readable on dark backgrounds.
      transmission: 0.9,
      ior: 1.5,
      dispersion: 0.3,
      attenuationDistance: 0.9,
      specularIntensity: 1,
      envMapIntensity: 2.2,
      normalScale: 0.08,
    },
    controls: ["tint", "roughness", "thickness"],
    ranges: { roughness: [0, 0.6], thickness: [0.05, 1.5] },
  },
  gold: {
    id: "gold",
    label: "Gold",
    description: "Polished yellow gold.",
    // Gold's measured reflectance (linear 1.00, 0.77, 0.34) in sRGB.
    defaults: { tint: "#ffe29d", roughness: 0.16, metalness: 1, clearcoat: 0, thickness: 0, opacity: 1 },
    physics: { ...BASE_PHYSICS, envMapIntensity: 1.1, normalScale: 0.25 },
    controls: ["tint", "roughness", "metalness", "opacity"],
  },
};

export const MATERIAL_PRESET_ORDER: MaterialPreset[] = ["original", "chrome", "obsidian", "ceramic", "glass", "gold"];

export const CONTROL_LABELS: Record<AdjustControl, string> = {
  tint: "Tint",
  roughness: "Roughness",
  metalness: "Metalness",
  clearcoat: "Lacquer",
  thickness: "Thickness",
  opacity: "Opacity",
};

export function controlRange(preset: MaterialPreset, control: AdjustControl): [number, number] {
  return MATERIAL_PRESET_DEFS[preset].ranges?.[control] ?? [0, 1];
}
