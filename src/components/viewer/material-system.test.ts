import { describe, expect, it } from "vitest";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  type BufferGeometry,
} from "three";
import { MATERIAL_PRESET_DEFS, MATERIAL_PRESET_ORDER, type MaterialPreset } from "@/lib/studio/materials";
import { classifyMaterial, MaterialSystem } from "./material-system";

function model() {
  const root = new Group();
  const skin = new Mesh(new SphereGeometry(1, 32, 16), new MeshStandardMaterial({ name: "skin" }));
  skin.name = "skin";
  const hair = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name: "hair", alphaTest: 0.5 }));
  hair.name = "hair";
  // Transparent without a texture to inspect: treated as a surface (e.g. eyes).
  const eyes = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name: "eyes", transparent: true }));
  eyes.name = "eyes";
  root.add(skin, hair, eyes);
  return { root, skin, hair, eyes };
}

const params = (p: MaterialPreset) => MATERIAL_PRESET_DEFS[p].defaults;

function snapshot(g: BufferGeometry) {
  return Array.from(g.getAttribute("position").array).slice(0, 30).join(",");
}

describe("MaterialSystem", () => {
  it("classifies meshes from their source materials", () => {
    expect(classifyMaterial(new MeshStandardMaterial())).toBe("surface");
    expect(classifyMaterial(new MeshStandardMaterial({ alphaTest: 0.4 }))).toBe("cutout");
    const { root } = model();
    expect(new MaterialSystem(root).roles()).toEqual({ skin: "surface", hair: "cutout", eyes: "surface" });
  });

  it("applies each preset's physical properties to the real materials", () => {
    const { root, skin } = model();
    const system = new MaterialSystem(root);
    for (const p of MATERIAL_PRESET_ORDER.filter((x) => x !== "original")) {
      const summary = system.apply(p, params(p));
      const m = skin.material as MeshPhysicalMaterial;
      expect(m).toBeInstanceOf(MeshPhysicalMaterial);
      expect(m.metalness).toBeCloseTo(params(p).metalness);
      expect(m.roughness).toBeCloseTo(params(p).roughness);
      expect(m.transmission).toBe(MATERIAL_PRESET_DEFS[p].physics.transmission);
      expect(summary.preset).toBe(p);
      expect(summary.type).toBe("MeshPhysicalMaterial");
    }
    system.apply("glass", params("glass"));
    const glass = skin.material as MeshPhysicalMaterial;
    expect(glass.transmission).toBeGreaterThan(0);
    expect(glass.thickness).toBeCloseTo(params("glass").thickness);
    expect(skin.castShadow).toBe(false);
  });

  it("restores the exact original materials", () => {
    const { root, skin, hair } = model();
    const skinOriginal = skin.material;
    const hairOriginal = hair.material;
    const system = new MaterialSystem(root);
    system.apply("gold", params("gold"));
    expect(skin.material).not.toBe(skinOriginal);
    system.apply("original", params("original"));
    expect(skin.material).toBe(skinOriginal);
    expect(hair.material).toBe(hairOriginal);
  });

  it("updates adjustments in place and reuses materials across repeated switching", () => {
    const { root, skin } = model();
    const system = new MaterialSystem(root);
    system.apply("chrome", params("chrome"));
    const chrome = skin.material;
    system.apply("chrome", { ...params("chrome"), roughness: 0.5, tint: "#ff0000" });
    expect(skin.material).toBe(chrome);
    expect((skin.material as MeshPhysicalMaterial).roughness).toBe(0.5);
    expect((skin.material as MeshPhysicalMaterial).color.getHexString()).toBe("ff0000");

    const cycle = () => MATERIAL_PRESET_ORDER.forEach((p) => system.apply(p, params(p)));
    cycle();
    const created = system.summary().created;
    for (let i = 0; i < 5; i++) cycle();
    expect(system.summary().created).toBe(created);
    system.apply("chrome", params("chrome"));
    expect(skin.material).toBe(chrome);
  });

  it("never touches geometry", () => {
    const { root, skin, hair } = model();
    const before = [skin.geometry, hair.geometry].map(snapshot);
    const geometries = [skin.geometry, hair.geometry];
    const system = new MaterialSystem(root);
    const key = system.summary().geometryKey;
    for (const p of MATERIAL_PRESET_ORDER) system.apply(p, params(p));
    expect([skin.geometry, hair.geometry]).toEqual(geometries);
    expect([skin.geometry, hair.geometry].map(snapshot)).toEqual(before);
    expect(system.summary().geometryKey).toBe(key);
  });

  it("disposes what it created and puts the originals back", () => {
    const { root, skin } = model();
    const original = skin.material;
    const system = new MaterialSystem(root);
    system.apply("glass", params("glass"));
    const glass = skin.material as MeshPhysicalMaterial;
    let disposed = 0;
    glass.addEventListener("dispose", () => disposed++);
    system.dispose();
    expect(disposed).toBe(1);
    expect(skin.material).toBe(original);
    expect(system.summary().created).toBe(0);
  });
});
