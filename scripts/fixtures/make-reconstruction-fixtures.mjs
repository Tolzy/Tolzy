// Builds provider-like test models from the CC0 sample head.
// Usage: node scripts/fixtures/make-reconstruction-fixtures.mjs
//   fixtures/reconstruction/fused-zup-cm.glb — the skin only (one fused mesh,
//   no separate hair or eyes), Z-up and in centimetres, offset from the origin:
//   exercises orientation, scale and segmentation of a single-mesh result.
import { NodeIO } from "@gltf-transform/core";

const io = new NodeIO();
const doc = await io.read("public/models/sample-head/sample-head.glb");
const root = doc.getRoot();
for (const node of root.listNodes()) {
  const name = node.getName();
  if (name !== "Skin" && name !== "SampleHead") node.dispose();
}
for (const mesh of root.listMeshes()) if (!mesh.listParents().some((p) => p.propertyType === "Node")) mesh.dispose();
const skin = root.listNodes().find((n) => n.getName() === "Skin");
skin.setName("mesh_0"); // providers rarely name their meshes
// Y-up → Z-up (rotate +90° about X), metres → centimetres, offset.
const s = Math.SQRT1_2;
const top = root.listNodes().find((n) => n.getName() === "SampleHead") ?? skin;
top.setRotation([s, 0, 0, s]).setScale([100, 100, 100]).setTranslation([12, -40, 7]);
await io.write("fixtures/reconstruction/fused-zup-cm.glb", doc);
console.log("wrote fixtures/reconstruction/fused-zup-cm.glb");
