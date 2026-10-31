import { describe, expect, it } from "vitest";
import { backgroundToCss, DEFAULT_SETTINGS, materialSettings } from "./settings";
import { MATERIAL_PRESETS } from "./presets";

describe("settings", () => {
  it("uses the agreed interaction defaults", () => {
    expect(DEFAULT_SETTINGS.motion).toMatchObject({
      yawLimit: 25,
      pitchLimit: 12,
      sensitivityX: 0.65,
      sensitivityY: 0.65,
      idleReturnMs: 600,
    });
  });

  it("defaults the studio viewport to a dark background", () => {
    expect(DEFAULT_SETTINGS.background.type).toBe("gradient");
  });

  it("has defaults and a preview for every material preset", () => {
    for (const p of MATERIAL_PRESETS) {
      expect(materialSettings(p.id).preset).toBe(p.id);
      expect(p.preview === null).toBe(p.id === "original");
    }
    expect(MATERIAL_PRESETS.map((p) => p.id)).toEqual(["original", "chrome", "obsidian", "ceramic", "glass", "gold"]);
  });

  it("maps backgrounds to CSS", () => {
    expect(backgroundToCss({ type: "solid", color: "#111111" })).toBe("#111111");
    expect(backgroundToCss({ type: "gradient", from: "#222222", to: "#000000" })).toContain("radial-gradient");
    expect(backgroundToCss({ type: "transparent" })).toBeUndefined();
  });
});
