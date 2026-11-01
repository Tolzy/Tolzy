/** Test helper: loads a GLB with glTF Transform into segmentation inputs (Node only). */
import { NodeIO, type Node as GNode } from "@gltf-transform/core";
import { Matrix4 } from "three";
import type { MeshInput, MeshRole } from "./segment";

export function roleFor(name: string, alphaMode: string): MeshRole {
  const n = name.toLowerCase();
  if (/hair/.test(n) || alphaMode === "MASK") return "hair";
  if (/brow/.test(n)) return "brows";
  if (/lash/.test(n)) return "lashes";
  if (/eye/.test(n)) return "eyes";
  if (/base/.test(n)) return "base";
  return "body";
}

export async function loadGlbInputs(path: string, transform?: Matrix4): Promise<MeshInput[]> {
  const doc = await new NodeIO().read(path);
  const inputs: MeshInput[] = [];
  const visit = (node: GNode, parent: Matrix4) => {
    const local = new Matrix4().fromArray(node.getMatrix());
    const world = parent.clone().multiply(local);
    const mesh = node.getMesh();
    for (const prim of mesh?.listPrimitives() ?? []) {
      const pos = prim.getAttribute("POSITION")!.getArray()!;
      const idx = prim.getIndices()?.getArray() ?? Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
      inputs.push({
        key: `${node.getName()}#${inputs.length}`,
        role: roleFor(node.getName(), prim.getMaterial()?.getAlphaMode() ?? "OPAQUE"),
        positions: pos,
        normals: prim.getAttribute("NORMAL")?.getArray() ?? null,
        uvs: prim.getAttribute("TEXCOORD_0")?.getArray() ?? null,
        indices: idx,
        matrixWorld: world.elements,
      });
    }
    for (const child of node.listChildren()) visit(child, world);
  };
  for (const scene of doc.getRoot().listScenes())
    for (const n of scene.listChildren()) visit(n, transform ?? new Matrix4());
  return inputs;
}
