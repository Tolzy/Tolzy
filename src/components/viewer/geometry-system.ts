import {
  Box3,
  type BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  type InterleavedBufferAttribute,
  type Material,
  Mesh,
  type MeshStandardMaterial,
  type Object3D,
  Sphere,
  Vector3,
} from "three";
import { hiddenRegions, type RegionId, type ShowPreset } from "@/lib/segmentation/regions";
import {
  segmentModel,
  type MeshInput,
  type MeshRole,
  type RegionReport,
  type Segmentation,
} from "@/lib/segmentation/segment";
import { setHiddenBy } from "./visibility";

/** Mesh role from its name and material — works for any provider's naming. */
export function meshRole(mesh: Mesh): MeshRole {
  const name = mesh.name.toLowerCase();
  const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshStandardMaterial;
  if (/hair/.test(name) || (material?.alphaTest ?? 0) > 0) return "hair";
  if (/brow/.test(name)) return "brows";
  if (/lash/.test(name)) return "lashes";
  if (/eye/.test(name)) return "eyes";
  if (/(^|[^a-z])base([^a-z]|$)|pedestal|stand/.test(name)) return "base";
  return "body";
}

/**
 * Attribute values as a tightly packed float array. glTF files may store
 * attributes interleaved (one buffer holding position, normal and uv), or
 * quantised/normalised; reading `.array` directly would then be wrong.
 */
export function plainArray(
  attr: BufferAttribute | InterleavedBufferAttribute | undefined,
  size: number,
): Float32Array | null {
  if (!attr) return null;
  const packed =
    !(attr as InterleavedBufferAttribute).isInterleavedBufferAttribute &&
    !attr.normalized &&
    attr.array instanceof Float32Array &&
    attr.itemSize === size &&
    attr.array.length === attr.count * size;
  if (packed) return attr.array as Float32Array;
  const out = new Float32Array(attr.count * size);
  for (let i = 0; i < attr.count; i++) for (let c = 0; c < size; c++) out[i * size + c] = attr.getComponent(i, c);
  return out;
}

/** Matrix from mesh space to the model root's parent (the normalised model space). */
function modelMatrix(mesh: Object3D, root: Object3D): Matrix4 {
  const chain: Object3D[] = [];
  for (let o: Object3D | null = mesh; o && o !== root; o = o.parent) chain.push(o);
  const m = new Matrix4();
  root.updateMatrix();
  m.copy(root.matrix);
  for (let i = chain.length - 1; i >= 0; i--) {
    chain[i].updateMatrix();
    m.multiply(chain[i].matrix);
  }
  return m;
}

interface PartMesh {
  mesh: Mesh;
  region: RegionId;
  cap: "head" | "shoulder" | null;
  /** Bounds in model space (for framing). */
  box: Box3;
}

/**
 * Splits a loaded model into region meshes (lib/segmentation) and controls
 * their visibility. Each source mesh's vertices live in one shared buffer
 * (original + cut vertices); every part is just an index list into it, so
 * the GPU holds each vertex once. Originals are detached, not modified, and
 * restored on dispose.
 */
export class GeometrySystem {
  readonly segmentation: Segmentation;
  private parts: PartMesh[] = [];
  private detached: { mesh: Mesh; parent: Object3D }[] = [];
  private created: BufferGeometry[] = [];
  private hidden = new Set<RegionId>();

  constructor(private root: Object3D) {
    const meshes: Mesh[] = [];
    root.traverse((o) => {
      if ((o as Mesh).isMesh && !o.userData.helper) meshes.push(o as Mesh);
    });
    const inputs: MeshInput[] = meshes.map((mesh, i) => {
      const g = mesh.geometry;
      const pos = g.getAttribute("position");
      const index = g.getIndex();
      return {
        key: String(i),
        role: meshRole(mesh),
        positions: plainArray(pos, 3)!,
        normals: plainArray(g.getAttribute("normal"), 3),
        uvs: plainArray(g.getAttribute("uv"), 2),
        indices: index ? index.array : Uint32Array.from({ length: pos.count }, (_, k) => k),
        matrixWorld: modelMatrix(mesh, root).elements,
      };
    });
    this.segmentation = segmentModel(inputs);
    if (!this.segmentation.ok) return;

    meshes.forEach((source, i) => {
      const key = String(i);
      const store = this.segmentation.stores.get(key)!;
      const shared = {
        position: new Float32BufferAttribute(store.positions, 3),
        normal: store.normals ? new Float32BufferAttribute(store.normals, 3) : null,
        uv: store.uvs ? new Float32BufferAttribute(store.uvs, 2) : null,
      };
      const toModel = modelMatrix(source, root);
      const build = (indices: number[], region: RegionId, cap: PartMesh["cap"]) => {
        const g = new BufferGeometry();
        g.setAttribute("position", shared.position);
        if (shared.normal) g.setAttribute("normal", shared.normal);
        if (shared.uv) g.setAttribute("uv", shared.uv);
        g.setIndex(indices);
        // Bounds of this part only (computeBoundingBox would cover the whole shared buffer).
        const box = new Box3();
        const v = new Vector3();
        for (const i of indices) box.expandByPoint(v.fromArray(store.positions, i * 3));
        g.boundingBox = box.clone();
        g.boundingSphere = box.getBoundingSphere(new Sphere());
        this.created.push(g);
        const mesh = new Mesh(g, source.material as Material);
        mesh.name = `${source.name || "mesh"}:${cap ? `cap-${cap}` : region}`;
        mesh.position.copy(source.position);
        mesh.quaternion.copy(source.quaternion);
        mesh.scale.copy(source.scale);
        mesh.castShadow = !cap;
        mesh.receiveShadow = true;
        mesh.userData.region = region;
        mesh.userData.cap = cap;
        mesh.userData.originalMaterial = source.userData.originalMaterial ?? source.material;
        source.parent!.add(mesh);
        this.parts.push({ mesh, region, cap, box: box.applyMatrix4(toModel) });
      };
      for (const part of this.segmentation.parts.filter((p) => p.meshKey === key))
        build(part.indices, part.region, null);
      for (const cap of this.segmentation.caps.filter((c) => c.meshKey === key))
        build(cap.indices, cap.cut === "head" ? "head" : "neck", cap.cut);
      this.detached.push({ mesh: source, parent: source.parent! });
      source.removeFromParent();
    });
    this.setHidden(new Set());
  }

  regions(): RegionReport[] {
    return this.segmentation.regions;
  }

  /** Applies a show preset plus individually hidden regions; returns what is hidden. */
  show(preset: ShowPreset, extra: RegionId[]): Set<RegionId> {
    const hidden = hiddenRegions(preset, extra);
    // Regions the model doesn't have can't be hidden or shown.
    for (const r of [...hidden]) if (!this.segmentation.regions.find((x) => x.id === r)?.available) hidden.delete(r);
    this.setHidden(hidden);
    return hidden;
  }

  private setHidden(hidden: Set<RegionId>) {
    this.hidden = hidden;
    for (const p of this.parts) {
      let hide = hidden.has(p.region);
      // Caps close a cut only when the part below it is hidden.
      if (p.cap === "head") hide = !hidden.has("neck");
      if (p.cap === "shoulder") hide = hidden.has("neck") || !hidden.has("bust");
      setHiddenBy(p.mesh, "geometry", hide);
    }
  }

  /** Bounds of the visible geometry in model space, or null without segmentation. */
  visibleBounds(): Box3 | null {
    if (!this.parts.length) return null;
    const box = new Box3();
    for (const p of this.parts) if (!p.mesh.userData.hiddenBy?.has("geometry")) box.union(p.box);
    return box;
  }

  isHidden(region: RegionId) {
    return this.hidden.has(region);
  }

  /** Visible triangles (for diagnostics and tests). */
  visibleTriangles(): number {
    return this.parts.reduce((n, p) => (p.mesh.visible ? n + (p.mesh.geometry.index?.count ?? 0) / 3 : n), 0);
  }

  partMeshes(): Mesh[] {
    return this.parts.map((p) => p.mesh);
  }

  dispose() {
    for (const p of this.parts) p.mesh.removeFromParent();
    for (const d of this.detached) d.parent.add(d.mesh);
    for (const g of this.created) g.dispose();
    this.parts = [];
    this.detached = [];
    this.created = [];
  }
}
