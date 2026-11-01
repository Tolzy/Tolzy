"use client";

import { lineage, REGION_DEFS, type RegionId } from "@/lib/segmentation/regions";
import type { PortraitSettings } from "@/lib/studio/settings";
import { useStudioStore } from "@/stores/studio-store";

type MaterialSettings = PortraitSettings["material"];

/** The material a region shows: its own override, an ancestor's, or the whole model's. */
export function effectiveMaterial(s: PortraitSettings, region: RegionId): MaterialSettings {
  for (const r of lineage(region)) if (s.regionMaterials[r]) return s.regionMaterials[r]!;
  return s.material;
}

/**
 * Binds the Material panel to the whole model or, when a region is selected,
 * to that region only (Milestone 7). Same undo/redo behaviour either way.
 */
export function useMaterialScope() {
  const selected = useStudioStore((s) => s.selectedRegion);
  const report = useStudioStore((s) => s.geometryReport);
  const settings = useStudioStore((s) => s.settings);
  const apply = useStudioStore((s) => s.apply);
  const preview = useStudioStore((s) => s.preview);
  const commit = useStudioStore((s) => s.commit);
  const selectRegion = useStudioStore((s) => s.selectRegion);

  const region = selected && report?.regions.find((r) => r.id === selected)?.available ? selected : null;
  const value = region ? effectiveMaterial(settings, region) : settings.material;
  const own = region ? Boolean(settings.regionMaterials[region]) : true;
  const inheritedFrom = region
    ? (lineage(region)
        .slice(1)
        .find((r) => settings.regionMaterials[r]) ?? null)
    : null;

  const merge =
    (patch: Partial<MaterialSettings>) =>
    (s: PortraitSettings): PortraitSettings =>
      region
        ? { ...s, regionMaterials: { ...s.regionMaterials, [region]: { ...effectiveMaterial(s, region), ...patch } } }
        : { ...s, material: { ...s.material, ...patch } };

  return {
    region,
    regionName: region ? REGION_DEFS[region].name : null,
    /** True when the region has its own material (not inherited). */
    own,
    inheritedFrom,
    value,
    set: (patch: Partial<MaterialSettings>) => apply(merge(patch)),
    drag: (patch: Partial<MaterialSettings>) => preview(merge(patch)),
    commit,
    /** Removes the region's own material so it follows the whole model (or its parent) again. */
    clearOverride: () =>
      region &&
      apply((s) => {
        const rest = { ...s.regionMaterials };
        delete rest[region];
        return { ...s, regionMaterials: rest };
      }),
    deselect: () => selectRegion(null),
  };
}
