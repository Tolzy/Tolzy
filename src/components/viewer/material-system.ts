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
 * - Opacity below 100 % renders a "ghost" of the surface: each opaque mesh
 *   gets a depth-only twin drawn first (sharing its geometry), then the
 *   colour pass blends only the front-most surface. Without it a translucent
 *   head would show its own inner faces, ears and the back of the skull.
 *   Original keeps the source materials untouched: a translucent copy is
 *   made once and cached.
 */

import {
  CanvasTexture,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  type MeshStandardMaterial,
  NoColorSpace,
  type Object3D,
  type Texture,
} from "three";
import { lineage, type RegionId } from "@/lib/segmentation/regions";
import { MATERIAL_PRESET_DEFS, type MaterialParams, type MaterialPreset } from "@/lib/studio/materials";
import { setHiddenBy } from "./visibility";

export type RegionMaterial = { preset: MaterialPreset } & MaterialParams;

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
  /** Surface opacity actually applied (1 = opaque). */
  opacity: number;
  /** Depth pre-pass meshes currently drawn (translucent rendering). */
  depthPrepass: number;
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
  private cache = new Map<string, MeshPhysicalMaterial | MeshStandardMaterial>();
  private alphaMaps = new Map<Texture, Texture>();
  private prepass = new Map<Mesh, Mesh>();
  private current: MaterialPreset = "original";
  private readonly geometryKey: string;

  constructor(root: Object3D) {
    root.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh || mesh.userData.helper) return;
      mesh.userData.originalMaterial ??= mesh.material;
      const original = mesh.userData.originalMaterial as MeshStandardMaterial;
      this.entries.push({
        mesh,
        original,
        role: classifyMaterial(original),
        // Triangles drawn by this mesh (parts share one vertex buffer, so count the index).
        vertexCount: mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position")?.count ?? 0,
      });
    });
    this.entries.sort((a, b) => b.vertexCount - a.vertexCount);
    this.geometryKey = this.entries.map((e) => `${e.mesh.geometry.uuid}:${e.vertexCount}`).join("|");
  }

  /** Roles by mesh name — useful for tests and debugging. */
  roles(): Record<string, MeshRole> {
    return Object.fromEntries(this.entries.map((e) => [e.mesh.name || e.mesh.uuid, e.role]));
  }

  /**
   * Applies the whole-model material, plus optional per-region overrides
   * (Milestone 7). A mesh tagged with a region uses the nearest override in
   * its lineage (eye → face → head), otherwise the whole-model setting.
   */
  apply(
    preset: MaterialPreset,
    params: MaterialParams,
    overrides: Partial<Record<RegionId, RegionMaterial>> = {},
  ): MaterialSummary {
    this.current = preset;
    for (const e of this.entries) {
      const region = e.mesh.userData.region as RegionId | undefined;
      const scope = region ? lineage(region).find((r) => overrides[r]) : undefined;
      const s = scope ? overrides[scope]! : { preset, ...params };
      this.applyTo(e, s.preset, s, scope ?? "*");
    }
    return this.summary(preset);
  }

  private applyTo(e: Entry, preset: MaterialPreset, params: MaterialParams, scope: string) {
    const glass = MATERIAL_PRESET_DEFS[preset].physics.transmission > 0;
    // Glass has no opacity control: transmission is its transparency.
    const opacity = glass ? 1 : Math.min(1, Math.max(0, params.opacity));
    const translucent = opacity < 0.999;
    e.mesh.userData.appliedPreset = preset;
    e.mesh.userData.materialScope = scope;
    if (preset === "original") {
      e.mesh.material = translucent ? this.translucentOriginal(e, opacity, scope) : e.original;
      setHiddenBy(e.mesh, "material", false);
      e.mesh.castShadow = e.role !== "detail" && !e.mesh.userData.cap;
      // Already-transparent originals (eyes, brows) blend as before; a depth
      // twin would hide the eyeball behind its own cornea.
      this.setPrepass(e, translucent && !e.original.transparent);
      return;
    }
    if (e.role === "detail") {
      setHiddenBy(e.mesh, "material", true);
      this.setPrepass(e, false);
      return;
    }
    const mat = this.materialFor(preset, e, scope);
    this.update(mat, preset, params, e.original);
    this.setOpacity(mat, opacity);
    e.mesh.material = mat;
    setHiddenBy(e.mesh, "material", false);
    // Transmissive glass should not cast solid shadows.
    e.mesh.castShadow = !glass && !e.mesh.userData.cap;
    this.setPrepass(e, translucent);
  }

  /** What each region shows right now (for tests and diagnostics). */
  regionSummary(): Partial<Record<RegionId, { preset: string; type: string; color: string; opacity: number }>> {
    const out: Partial<Record<RegionId, { preset: string; type: string; color: string; opacity: number }>> = {};
    for (const e of this.entries) {
      const region = e.mesh.userData.region as RegionId | undefined;
      if (!region || e.mesh.userData.cap || out[region]) continue;
      const m = e.mesh.material as MeshPhysicalMaterial;
      out[region] = {
        preset: e.mesh.userData.appliedPreset,
        type: m.type,
        color: `#${m.color.getHexString()}`,
        opacity: m.transparent ? m.opacity : 1,
      };
    }
    return out;
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
      hidden: this.entries.filter((e) => e.mesh.userData.hiddenBy?.has("material")).length,
      geometryKey: this.geometryKey,
      created: this.cache.size,
      opacity: m?.transparent ? m.opacity : 1,
      depthPrepass: [...this.prepass.values()].filter((p) => p.visible).length,
    };
  }

  /** Restores originals and frees everything this system created. */
  dispose() {
    for (const e of this.entries) {
      e.mesh.material = e.original;
      setHiddenBy(e.mesh, "material", false);
    }
    for (const [mesh, twin] of this.prepass) {
      mesh.remove(twin);
      (twin.material as MeshBasicMaterial).dispose();
    }
    for (const m of this.cache.values()) m.dispose();
    for (const t of this.alphaMaps.values()) t.dispose();
    this.prepass.clear();
    this.cache.clear();
    this.alphaMaps.clear();
  }

  /** Transparent blending for preset materials; depth comes from the pre-pass. */
  private setOpacity(mat: MeshPhysicalMaterial | MeshStandardMaterial, opacity: number, base = 1) {
    const translucent = opacity < 0.999;
    if (mat.transparent !== translucent) {
      mat.transparent = translucent;
      mat.depthWrite = !translucent;
      mat.needsUpdate = true;
    }
    mat.opacity = base * opacity;
  }

  /** A cached translucent copy of a source material (textures shared, not copied). */
  private translucentOriginal(e: Entry, opacity: number, scope: string): MeshStandardMaterial {
    const key = `original|${e.original.uuid}|${scope}`;
    let mat = this.cache.get(key);
    if (!mat) {
      mat = e.original.clone();
      mat.name = `${e.original.name || "material"} · translucent`;
      mat.transparent = true;
      // Opaque sources rely on the depth pre-pass; transparent ones keep their own setting.
      mat.depthWrite = e.original.transparent ? e.original.depthWrite : false;
      this.cache.set(key, mat);
    }
    mat.opacity = e.original.opacity * opacity;
    return mat;
  }

  /** Shows or hides the depth-only twin of a mesh (created once, shares geometry). */
  private setPrepass(e: Entry, on: boolean) {
    let twin = this.prepass.get(e.mesh);
    if (!on) {
      if (twin) twin.visible = false;
      return;
    }
    if (!twin) {
      const depth = new MeshBasicMaterial({ colorWrite: false, side: e.original.side });
      depth.name = "depth-prepass";
      if (e.role === "cutout") {
        depth.alphaMap = this.alphaMapFor(e.original.map);
        depth.alphaTest = e.original.alphaTest || 0.5;
      }
      twin = new Mesh(e.mesh.geometry, depth);
      twin.name = `${e.mesh.name || "mesh"} · depth`;
      twin.renderOrder = -1; // before everything else in the opaque pass
      twin.castShadow = false;
      twin.receiveShadow = false;
      twin.raycast = () => {};
      twin.userData.helper = true; // not part of the model (skipped by traversals)
      e.mesh.add(twin);
      this.prepass.set(e.mesh, twin);
    }
    twin.visible = true;
  }

  private materialFor(preset: MaterialPreset, e: Entry, scope: string): MeshPhysicalMaterial {
    const key = `${preset}|${e.original.uuid}|${scope}`;
    const cached = this.cache.get(key);
    if (cached) return cached as MeshPhysicalMaterial;
    const mat = new MeshPhysicalMaterial({ name: `${preset} · ${e.original.name || "material"}` });
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
