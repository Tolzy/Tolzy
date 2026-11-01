/**
 * Model regions — stable identifiers shared by segmentation, the Studio's
 * Model panel, per-region materials and (later) eye effects and the Effects
 * Studio. Nothing here depends on a particular mesh or provider.
 */

export type RegionId =
  | "head"
  | "face"
  | "hair"
  | "ear-left"
  | "ear-right"
  | "eye-left"
  | "eye-right"
  | "brows"
  | "lashes"
  | "neck"
  | "bust"
  | "shoulders";

/** Effects a region can host in later milestones (M8 eye glow, M9 Effects Studio). */
export type RegionEffect = "eye-glow" | "hair-effects" | "face-lighting" | "surface-effects";

export interface RegionDef {
  id: RegionId;
  name: string;
  parent: RegionId | null;
  effects: RegionEffect[];
}

export const REGION_DEFS: Record<RegionId, RegionDef> = {
  head: { id: "head", name: "Head", parent: null, effects: ["surface-effects"] },
  face: { id: "face", name: "Face", parent: "head", effects: ["face-lighting", "surface-effects"] },
  hair: { id: "hair", name: "Hair", parent: "head", effects: ["hair-effects"] },
  "ear-left": { id: "ear-left", name: "Left ear", parent: "head", effects: [] },
  "ear-right": { id: "ear-right", name: "Right ear", parent: "head", effects: [] },
  "eye-left": { id: "eye-left", name: "Left eye", parent: "face", effects: ["eye-glow"] },
  "eye-right": { id: "eye-right", name: "Right eye", parent: "face", effects: ["eye-glow"] },
  brows: { id: "brows", name: "Eyebrows", parent: "face", effects: [] },
  lashes: { id: "lashes", name: "Eyelashes", parent: "face", effects: [] },
  neck: { id: "neck", name: "Neck", parent: null, effects: ["surface-effects"] },
  bust: { id: "bust", name: "Upper bust", parent: null, effects: ["surface-effects"] },
  shoulders: { id: "shoulders", name: "Shoulders", parent: "bust", effects: [] },
};

/** Display order in the Model panel. */
export const REGION_ORDER: RegionId[] = [
  "head",
  "face",
  "eye-left",
  "eye-right",
  "brows",
  "lashes",
  "ear-left",
  "ear-right",
  "hair",
  "neck",
  "bust",
  "shoulders",
];

/** Region and its ancestors, nearest first (for inherited material overrides). */
export function lineage(id: RegionId): RegionId[] {
  const out: RegionId[] = [];
  for (let r: RegionId | null = id; r; r = REGION_DEFS[r].parent) out.push(r);
  return out;
}

export type ShowPreset = "head" | "headNeck" | "bust";

export const SHOW_PRESETS: { id: ShowPreset; label: string; hides: RegionId[] }[] = [
  { id: "head", label: "Head", hides: ["neck", "bust", "shoulders"] },
  { id: "headNeck", label: "Head & neck", hides: ["bust", "shoulders"] },
  { id: "bust", label: "Bust", hides: [] },
];

/**
 * Regions that can be hidden on their own without leaving an open hole:
 * separate meshes (hair) and the structural parts below a clean, capped cut.
 * Face, ears and shoulders are labelled surface areas of a continuous skin —
 * hiding them would open the surface, so they support selection and
 * materials only.
 */
export const HIDEABLE: RegionId[] = ["hair", "neck", "bust"];

/** Effective hidden set: the show preset plus individually hidden regions. */
export function hiddenRegions(preset: ShowPreset, extra: RegionId[]): Set<RegionId> {
  const set = new Set<RegionId>(SHOW_PRESETS.find((p) => p.id === preset)?.hides ?? []);
  for (const r of extra) if (HIDEABLE.includes(r)) set.add(r);
  // A neck with nothing below it would float; it is hidden together with the bust only.
  if (set.has("neck")) set.add("bust").add("shoulders");
  if (set.has("bust")) set.add("shoulders");
  return set;
}
