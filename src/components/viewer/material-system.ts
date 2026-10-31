/**
 * Applies material presets to any loaded model without touching its geometry.
 *
 * - Every mesh keeps its source material in `userData.originalMaterial`;
 *   "Original" simply puts those back.
 * - Preset materials are MeshPhysicalMaterials created once per (preset,
 *   source material) and updated in place when adjustments change, so
 *   switching back and forth never re-creates GPU resources.
 * - Meshes are classified generically from their source material, so the
 *   same code works for generated portraits:
 *     surface — opaque (or mostly opaque) surfaces: skin, eyes, base;
 *     cutout  — alpha-tested cards such as hair: keep their silhouette;
 *     detail  — thin, mostly transparent cards (eyebrows, lashes): hidden
 *               under sculptural materials, where they would read as noise.
 */

import {
  CanvasTexture,
  Color,
  DoubleSide,
  type Mesh,
  MeshPhysicalMaterial,
  type MeshStandardMaterial,
  NoColorSpace,
  type Object3D,
  type Texture,
} from "three";
import { MATERIAL_PRESET_DEFS, type MaterialParams, type MaterialPreset } from "@/lib/studio/materials";

export type MeshRole = "surface" | "cutout" | "detail";

export interface MaterialSummary {
  preset: MaterialPreset;
  /** Material on the largest mesh (the skin of a portrait). */
  type: string;
  color: string;
  metalness: number;
  roughness: number;
  transmission: number;
  clearcoat: number;
  thickness: number;
  envMapIntensity: number;
  /** Meshes hidden because they are fine details (brows, lashes). */
  hidden: number;
  /** Changes if geometry is ever replaced or modified. */
  geometryKey: string;
  /** Preset materials created so far (should stop growing after one cycle). */
  created: number;
}

interface Entry {
  mesh: Mesh;
  original: MeshStandardMaterial;
  role: MeshRole;
  vertexCount: number;
}

/** Share of texels with alpha > 0.5 (1 when there is no texture to inspect). */
function alphaCoverage(texture: Texture | null): number {
  const image = texture?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!image?.width) return 1;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 1;
  ctx.drawImage(image, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 127) opaque++;
  return opaque / (size * size);
}

export function classifyMaterial(m: MeshStandardMaterial): MeshRole {
  if (m.alphaTest > 0) return "cutout";
  if (!m.transparent) return "surface";
  // Transparent: eyes (with a clear cornea) are mostly opaque; brows/lashes are not.
  return alphaCoverage(m.map) > 0.5 ? "surface" : "detail";
}

export class MaterialSystem {
  private entries: Entry[] = [];
  private cache = new Map<string, MeshPhysicalMaterial>();
  private alphaMaps = new Map<Texture, Texture>();
  private current: MaterialPreset = "original";
  private readonly geometryKey: string;

  constructor(root: Object3D) {
    root.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      mesh.userData.originalMaterial ??= mesh.material;
      const original = mesh.userData.originalMaterial as MeshStandardMaterial;
      this.entries.push({
        mesh,
        original,
        role: classifyMaterial(original),
        vertexCount: mesh.geometry.getAttribute("position")?.count ?? 0,
      });
    });
    this.entries.sort((a, b) => b.vertexCount - a.vertexCount);
    this.geometryKey = this.entries.map((e) => `${e.mesh.geometry.uuid}:${e.vertexCount}`).join("|");
  }

  /** Roles by mesh name — useful for tests and debugging. */
  roles(): Record<string, MeshRole> {
    return Object.fromEntries(this.entries.map((e) => [e.mesh.name || e.mesh.uuid, e.role]));
  }

  apply(preset: MaterialPreset, params: MaterialParams): MaterialSummary {
    this.current = preset;
    for (const e of this.entries) {
      if (preset === "original") {
        e.mesh.material = e.original;
        e.mesh.visible = true;
        e.mesh.castShadow = e.role !== "detail";
        continue;
      }
      if (e.role === "detail") {
        e.mesh.visible = false;
        continue;
      }
      const mat = this.materialFor(preset, e);
      this.update(mat, preset, params, e.original);
      e.mesh.material = mat;
      e.mesh.visible = true;
      // Transmissive glass should not cast solid shadows.
      e.mesh.castShadow = MATERIAL_PRESET_DEFS[preset].physics.transmission === 0;
    }
    return this.summary(preset);
  }

  summary(preset: MaterialPreset = this.current): MaterialSummary {
    const main = this.entries[0];
    const m = main?.mesh.material as MeshPhysicalMaterial | undefined;
    return {
      preset,
      type: m?.type ?? "none",
      color: m ? `#${m.color.getHexString()}` : "",
      metalness: m?.metalness ?? 0,
      roughness: m?.roughness ?? 0,
      transmission: m?.transmission ?? 0,
      clearcoat: m?.clearcoat ?? 0,
      thickness: m?.thickness ?? 0,
      envMapIntensity: m?.envMapIntensity ?? 1,
      hidden: this.entries.filter((e) => !e.mesh.visible).length,
      geometryKey: this.geometryKey,
      created: this.cache.size,
    };
  }

  /** Restores originals and frees everything this system created. */
  dispose() {
    for (const e of this.entries) {
      e.mesh.material = e.original;
      e.mesh.visible = true;
    }
    for (const m of this.cache.values()) m.dispose();
    for (const t of this.alphaMaps.values()) t.dispose();
    this.cache.clear();
    this.alphaMaps.clear();
  }

  private materialFor(preset: MaterialPreset, e: Entry): MeshPhysicalMaterial {
    const key = `${preset}|${e.original.uuid}`;
    let mat = this.cache.get(key);
    if (mat) return mat;
    mat = new MeshPhysicalMaterial({ name: `${preset} · ${e.original.name || "material"}` });
    // Glass shows its far side through the near one, like a solid glass bust.
    mat.side = MATERIAL_PRESET_DEFS[preset].physics.transmission > 0 ? DoubleSide : e.original.side;
    // Keep the model's surface detail (pores, folds) from its own normal map.
    if (e.original.normalMap) mat.normalMap = e.original.normalMap;
    if (e.role === "cutout") {
      mat.alphaMap = this.alphaMapFor(e.original.map);
      mat.alphaTest = e.original.alphaTest || 0.5;
    }
    this.cache.set(key, mat);
    return mat;
  }

  private update(mat: MeshPhysicalMaterial, preset: MaterialPreset, p: MaterialParams, original: MeshStandardMaterial) {
    const { physics } = MATERIAL_PRESET_DEFS[preset];
    const tint = new Color(p.tint);
    const glass = physics.transmission > 0;
    mat.color.copy(glass ? new Color("#ffffff") : tint);
    mat.metalness = p.metalness;
    mat.roughness = p.roughness;
    mat.clearcoat = p.clearcoat;
    mat.clearcoatRoughness = physics.clearcoatRoughness;
    mat.transmission = physics.transmission;
    mat.thickness = glass ? p.thickness : 0;
    mat.ior = physics.ior;
    mat.dispersion = physics.dispersion;
    mat.attenuationColor.copy(glass ? tint : new Color("#ffffff"));
    mat.attenuationDistance = physics.attenuationDistance;
    mat.specularIntensity = physics.specularIntensity;
    mat.sheen = physics.sheen;
    mat.sheenColor.copy(tint);
    mat.sheenRoughness = physics.sheenRoughness;
    mat.envMapIntensity = physics.envMapIntensity;
    if (mat.normalMap) {
      const s = original.normalScale;
      const k = physics.normalScale / Math.max(Math.abs(s.x), 1e-6);
      mat.normalScale.set(s.x * k, s.y * k);
    }
  }

  /** Builds (once) a greyscale alpha map from a texture's alpha channel. */
  private alphaMapFor(map: Texture | null): Texture | null {
    if (!map?.image) return null;
    const cached = this.alphaMaps.get(map);
    if (cached) return cached;
    const image = map.image as CanvasImageSource & { width: number; height: number };
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = d[i + 3];
    ctx.putImageData(img, 0, 0);
    const tex = new CanvasTexture(canvas);
    tex.flipY = map.flipY;
    tex.colorSpace = NoColorSpace;
    tex.wrapS = map.wrapS;
    tex.wrapT = map.wrapT;
    this.alphaMaps.set(map, tex);
    return tex;
  }
}
