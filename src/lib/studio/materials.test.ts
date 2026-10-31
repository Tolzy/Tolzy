import { describe, expect, it } from "vitest";
import { controlRange, MATERIAL_PRESET_DEFS, MATERIAL_PRESET_ORDER } from "./materials";
import { LIGHTING_PRESET_ORDER, LIGHTING_RIGS } from "./lighting";

describe("material presets", () => {
  it("offers the six presets in order", () => {
    expect(MATERIAL_PRESET_ORDER).toEqual(["original", "chrome", "obsidian", "ceramic", "glass", "gold"]);
  });

  it("keeps defaults inside each control's range", () => {
    for (const id of MATERIAL_PRESET_ORDER) {
      const def = MATERIAL_PRESET_DEFS[id];
      for (const c of def.controls) {
        if (c === "tint") continue;
        const [min, max] = controlRange(id, c);
        expect(def.defaults[c]).toBeGreaterThanOrEqual(min);
        expect(def.defaults[c]).toBeLessThanOrEqual(max);
      }
    }
  });

  it("describes physically distinct materials", () => {
    const d = MATERIAL_PRESET_DEFS;
    expect(d.original.controls).toEqual([]);
    expect(d.chrome.defaults.metalness).toBe(1);
    expect(d.gold.defaults.metalness).toBe(1);
    expect(d.obsidian.defaults.metalness).toBe(0);
    expect(d.obsidian.defaults.clearcoat).toBeGreaterThan(0);
    expect(d.glass.physics.transmission).toBeGreaterThan(0.5);
    expect(d.glass.controls).toContain("thickness");
    for (const id of ["chrome", "obsidian", "ceramic", "gold"] as const) expect(d[id].physics.transmission).toBe(0);
  });
});

describe("lighting rigs", () => {
  it("offers five rigs, each with exactly one shadow-casting light", () => {
    expect(LIGHTING_PRESET_ORDER).toEqual(["studio", "dramatic", "soft", "rim", "neutral"]);
    for (const id of LIGHTING_PRESET_ORDER) {
      const rig = LIGHTING_RIGS[id];
      expect(rig.id).toBe(id);
      expect(rig.lights.filter((l) => l.castShadow)).toHaveLength(1);
      expect(rig.environment.panels.length).toBeGreaterThan(0);
    }
  });

  it("gives every rig a different light arrangement", () => {
    const keys = LIGHTING_PRESET_ORDER.map((id) => JSON.stringify(LIGHTING_RIGS[id].lights));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
