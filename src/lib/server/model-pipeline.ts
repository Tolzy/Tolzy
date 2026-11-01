import "server-only";

import { NodeIO, type Node as GNode } from "@gltf-transform/core";
import { Euler, Matrix4 } from "three";
import { detectOrientation, orientationMatrix } from "@/lib/segmentation/orientation";
import { analyzeProfile } from "@/lib/segmentation/profile";

export const MAX_MODEL_BYTES = 150 * 1024 * 1024;
const MIN_TRIANGLES = 500;
const MAX_TRIANGLES = 2_000_000;

export class ModelError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface ModelManifest {
  /** Euler XYZ (radians) that makes the model Y-up and face +Z. */
  orientation: [number, number, number];
  orientationConfidence: { up: number; forward: number };
  framing: { pivot: number; focus: number };
  triangles: number;
  meshes: number;
  materials: number;
  textures: number;
  /** Whether the head/neck/bust profile was found (parts available in the Studio). */
  profile: { ok: boolean; reason: string | null };
}

/**
 * Validates a provider's GLB and works out how to present it. Rejects files
 * that are not well-formed binary glTF 2.0, reference external resources,
 * have no or degenerate geometry, or are unreasonably large or small. The
 * file itself is stored unchanged (the original asset is preserved).
 */
export async function inspectModel(data: Buffer): Promise<ModelManifest> {
  if (data.length > MAX_MODEL_BYTES) throw new ModelError("too_large", "The returned model is too large.");
  if (data.length < 20 || data.toString("ascii", 0, 4) !== "glTF")
    throw new ModelError("not_glb", "The returned file is not a GLB model.");
  if (data.readUInt32LE(4) !== 2) throw new ModelError("version", "Only glTF 2.0 models are supported.");
  if (data.readUInt32LE(8) !== data.length) throw new ModelError("truncated", "The returned model is incomplete.");

  // External URIs would make the model depend on files we don't control.
  const jsonLength = data.readUInt32LE(12);
  const json = JSON.parse(data.toString("utf8", 20, 20 + jsonLength)) as {
    buffers?: { uri?: string }[];
    images?: { uri?: string }[];
  };
  if ([...(json.buffers ?? []), ...(json.images ?? [])].some((x) => x.uri && !x.uri.startsWith("data:")))
    throw new ModelError("external", "The model references external files.");

  let doc;
  try {
    doc = await new NodeIO().readBinary(new Uint8Array(data));
  } catch {
    throw new ModelError("corrupt", "The returned model couldn’t be read.");
  }
  const root = doc.getRoot();

  const positions: number[] = [];
  let triangles = 0;
  const visit = (node: GNode, parent: Matrix4) => {
    const world = parent.clone().multiply(new Matrix4().fromArray(node.getMatrix()));
    for (const prim of node.getMesh()?.listPrimitives() ?? []) {
      if (prim.getMode() !== 4) continue; // triangles only
      const pos = prim.getAttribute("POSITION");
      if (!pos) continue;
      const count = pos.getCount();
      const idx = prim.getIndices();
      triangles += (idx ? idx.getCount() : count) / 3;
      // Shape analysis uses solid surfaces only: alpha-cut hair cards, lashes
      // and corneas would read as spikes and confuse the orientation.
      if ((prim.getMaterial()?.getAlphaMode() ?? "OPAQUE") !== "OPAQUE") continue;
      const e = world.elements;
      const v: number[] = [];
      // Sample at most ~120k vertices for analysis.
      const step = Math.max(1, Math.floor(count / 120_000));
      for (let i = 0; i < count; i += step) {
        pos.getElement(i, v);
        if (!v.every(Number.isFinite)) throw new ModelError("nan", "The model contains invalid vertex positions.");
        positions.push(
          e[0] * v[0] + e[4] * v[1] + e[8] * v[2] + e[12],
          e[1] * v[0] + e[5] * v[1] + e[9] * v[2] + e[13],
          e[2] * v[0] + e[6] * v[1] + e[10] * v[2] + e[14],
        );
      }
    }
    for (const c of node.listChildren()) visit(c, world);
  };
  for (const scene of root.listScenes()) for (const n of scene.listChildren()) visit(n, new Matrix4());

  if (triangles < MIN_TRIANGLES) throw new ModelError("empty", "The returned model has no usable geometry.");
  if (triangles > MAX_TRIANGLES) throw new ModelError("too_dense", "The returned model is too detailed to display.");
  const extent = [0, 1, 2].map((a) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = a; i < positions.length; i += 3) {
      lo = Math.min(lo, positions[i]);
      hi = Math.max(hi, positions[i]);
    }
    return hi - lo;
  });
  if (extent.some((x) => !(x > 0))) throw new ModelError("degenerate", "The returned model is flat or empty.");

  // Orientation, then framing from the anatomical profile.
  const orientation = detectOrientation(positions);
  const m3 = orientationMatrix(orientation);
  const rot = new Matrix4().set(m3[0], m3[3], m3[6], 0, m3[1], m3[4], m3[7], 0, m3[2], m3[5], m3[8], 0, 0, 0, 0, 1);
  const oriented = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    const [x, y, z] = [positions[i], positions[i + 1], positions[i + 2]];
    oriented[i] = m3[0] * x + m3[3] * y + m3[6] * z;
    oriented[i + 1] = m3[1] * x + m3[4] * y + m3[7] * z;
    oriented[i + 2] = m3[2] * x + m3[5] * y + m3[8] * z;
  }
  const profile = analyzeProfile(oriented);
  const framing = profile.ok
    ? {
        pivot: profile.profile.chinT + 0.28 * (1 - profile.profile.chinT),
        focus: profile.profile.chinT + 0.25 * (1 - profile.profile.chinT),
      }
    : { pivot: 0.62, focus: 0.6 };
  const euler = new Euler().setFromRotationMatrix(rot, "XYZ");

  return {
    orientation: [euler.x, euler.y, euler.z],
    orientationConfidence: orientation.confidence,
    framing,
    triangles: Math.round(triangles),
    meshes: root.listMeshes().length,
    materials: root.listMaterials().length,
    textures: root.listTextures().length,
    profile: { ok: profile.ok, reason: profile.ok ? null : profile.reason },
  };
}
