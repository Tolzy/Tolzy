import { describe, expect, it } from "vitest";
import { parseSettings } from "./schema";
import { DEFAULT_SETTINGS, lightingSettings, materialSettings } from "./settings";

describe("settings schema", () => {
  it("round-trips a valid document", () => {
    const doc = {
      ...DEFAULT_SETTINGS,
      material: { ...materialSettings("gold"), opacity: 0.4, tint: "#ffcc00" },
      lighting: { ...lightingSettings("rim"), color: "#ffd2a1", ambient: 0.5, shadowIntensity: 0.3 },
      background: { type: "solid" as const, color: "#11223380" },
    };
    expect(parseSettings(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });

  it("falls back per section, keeping the valid ones", () => {
    const parsed = parseSettings({
      material: { preset: "unobtainium" },
      lighting: { ...lightingSettings("soft") },
      background: { type: "solid", color: "red" },
    });
    expect(parsed.material).toEqual(DEFAULT_SETTINGS.material);
    expect(parsed.lighting.preset).toBe("soft");
    expect(parsed.background).toEqual(DEFAULT_SETTINGS.background);
    expect(parsed.motion).toEqual(DEFAULT_SETTINGS.motion);
  });

  it("upgrades older documents missing newer fields", () => {
    const parsed = parseSettings({
      material: { preset: "chrome", tint: "#ffffff", roughness: 0.2, metalness: 1, clearcoat: 0, thickness: 0 },
      lighting: { preset: "dramatic", intensity: 2, rotation: 30, shadows: false },
    });
    expect(parsed.material).toMatchObject({ preset: "chrome", roughness: 0.2, opacity: 1 });
    expect(parsed.lighting).toMatchObject({
      preset: "dramatic",
      intensity: 2,
      color: "#ffffff",
      ambient: 1,
      shadows: false,
    });
  });

  it("rejects garbage", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("nope")).toEqual(DEFAULT_SETTINGS);
  });
});
