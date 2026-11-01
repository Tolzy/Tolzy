import { z } from "zod";
import { REGION_DEFS, type RegionId } from "@/lib/segmentation/regions";
import { LIGHTING_PRESET_ORDER } from "./lighting";
import { MATERIAL_PRESET_ORDER } from "./materials";
import { DEFAULT_SETTINGS, lightingSettings, materialSettings, type PortraitSettings } from "./settings";

/**
 * Versioned schema for the portrait settings document (docs/data-model.md §4).
 * Used for every persisted copy — this device today, `portrait_settings` once
 * accounts exist. Each section falls back to defaults on its own, so one bad
 * value never discards the rest of a user's work.
 */
export const SETTINGS_SCHEMA_VERSION = 1;

const Hex = z.string().regex(/^#([0-9a-f]{6}|[0-9a-f]{8})$/i);
const Unit = z.number().min(0).max(1);

const Material = z.object({
  preset: z.enum(MATERIAL_PRESET_ORDER as [string, ...string[]]),
  tint: Hex,
  roughness: Unit,
  metalness: Unit,
  clearcoat: Unit,
  thickness: z.number().min(0).max(1.5),
  opacity: Unit,
});

const Lighting = z.object({
  preset: z.enum(LIGHTING_PRESET_ORDER as [string, ...string[]]),
  intensity: z.number().min(0).max(3),
  rotation: z.number().min(-180).max(180),
  color: Hex,
  ambient: z.number().min(0).max(2),
  shadows: z.boolean(),
  shadowIntensity: Unit,
});

const Background = z.discriminatedUnion("type", [
  z.object({ type: z.literal("solid"), color: Hex }),
  z.object({ type: z.literal("gradient"), from: Hex, to: Hex }),
  z.object({ type: z.literal("transparent") }),
]);

const Motion = z.object({
  tracking: z.boolean(),
  yawLimit: z.number().min(0).max(60),
  pitchLimit: z.number().min(0).max(30),
  sensitivityX: Unit,
  sensitivityY: Unit,
  smoothness: Unit,
  idleReturnMs: z.number().min(0).max(5000),
  dragEnabled: z.boolean(),
  dragRelease: z.enum(["return", "hold"]),
  touchSensitivity: z.number().min(0.2).max(1),
});

const RegionIdSchema = z.enum(Object.keys(REGION_DEFS) as [RegionId, ...RegionId[]]);
const Geometry = z.object({
  preset: z.enum(["head", "headNeck", "bust"]),
  hidden: z.array(RegionIdSchema).max(20),
});

/** Parses a stored document; invalid or missing sections fall back to defaults. */
export function parseSettings(input: unknown, defaults: PortraitSettings = DEFAULT_SETTINGS): PortraitSettings {
  const doc = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const pick = <T>(schema: z.ZodType<T>, value: unknown, fallback: T): T => {
    const r = schema.safeParse(value);
    return r.success ? r.data : fallback;
  };
  // Older documents without newer fields: fill them from the preset's defaults first.
  const material = doc.material as Record<string, unknown> | undefined;
  const lighting = doc.lighting as Record<string, unknown> | undefined;
  const regionMaterials: PortraitSettings["regionMaterials"] = {};
  const rm = doc.regionMaterials;
  if (rm && typeof rm === "object") {
    for (const [id, value] of Object.entries(rm as Record<string, unknown>)) {
      if (!RegionIdSchema.safeParse(id).success) continue;
      const v = value as Record<string, unknown> | undefined;
      const parsed =
        v && MATERIAL_PRESET_ORDER.includes(v.preset as never)
          ? Material.safeParse({ ...materialSettings(v.preset as never), ...v })
          : null;
      if (parsed?.success) regionMaterials[id as RegionId] = parsed.data as PortraitSettings["material"];
    }
  }
  return {
    geometry: pick(Geometry, doc.geometry, defaults.geometry),
    regionMaterials,
    material: pick(
      Material,
      material && MATERIAL_PRESET_ORDER.includes(material.preset as never)
        ? { ...materialSettings(material.preset as never), ...material }
        : undefined,
      defaults.material,
    ) as PortraitSettings["material"],
    lighting: pick(
      Lighting,
      lighting && { ...lightingSettings((lighting.preset as never) ?? "studio"), ...lighting },
      defaults.lighting,
    ) as PortraitSettings["lighting"],
    background: pick(Background, doc.background, defaults.background),
    motion: pick(Motion, doc.motion && { ...defaults.motion, ...(doc.motion as object) }, defaults.motion),
  };
}

export interface StoredSettings {
  schemaVersion: number;
  settings: PortraitSettings;
}
