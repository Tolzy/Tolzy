// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BufferGeometry,
  Group,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Uint16BufferAttribute,
  BufferAttribute,
} from "three";
import { loadGlbInputs } from "@/lib/segmentation/test-utils";
import { GeometrySystem, plainArray } from "./geometry-system";

describe("plainArray", () => {
  it("unpacks interleaved attributes", () => {
    // position(3) + uv(2) per vertex, two vertices.
    const buf = new InterleavedBuffer(new Float32Array([1, 2, 3, 0.1, 0.2, 4, 5, 6, 0.3, 0.4]), 5);
    expect(Array.from(plainArray(new InterleavedBufferAttribute(buf, 3, 0), 3)!)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(Array.from(plainArray(new InterleavedBufferAttribute(buf, 2, 3), 2)!).map((x) => +x.toFixed(2))).toEqual([
      0.1, 0.2, 0.3, 0.4,
    ]);
  });

  it("denormalises quantised attributes", () => {
    const attr = new Uint16BufferAttribute([0, 65535], 1, true);
    expect(Array.from(plainArray(attr, 1)!)).toEqual([0, 1]);
  });

  it("returns packed float arrays as they are", () => {
    const arr = new Float32Array([1, 2, 3]);
    expect(plainArray(new BufferAttribute(arr, 3), 3)).toBe(arr);
  });
});

describe("GeometrySystem", () => {
  it("segments a model whose attributes are interleaved, as GLTFLoader may produce", async () => {
    const [input] = await loadGlbInputs("fixtures/reconstruction/fused-zup-cm.glb");
    const count = input.positions.length / 3;
    const stride = 8;
    const data = new Float32Array(count * stride);
    for (let i = 0; i < count; i++) {
      for (let c = 0; c < 3; c++) data[i * stride + c] = input.positions[i * 3 + c];
      for (let c = 0; c < 3; c++) data[i * stride + 3 + c] = input.normals![i * 3 + c];
      for (let c = 0; c < 2; c++) data[i * stride + 6 + c] = input.uvs![i * 2 + c];
    }
    const buf = new InterleavedBuffer(data, stride);
    const g = new BufferGeometry();
    g.setAttribute("position", new InterleavedBufferAttribute(buf, 3, 0));
    g.setAttribute("normal", new InterleavedBufferAttribute(buf, 3, 3));
    g.setAttribute("uv", new InterleavedBufferAttribute(buf, 2, 6));
    g.setIndex(new BufferAttribute(Uint32Array.from(input.indices), 1));

    const root = new Group();
    const mesh = new Mesh(g, new MeshStandardMaterial());
    mesh.name = "mesh_0";
    // Z-up in the file; the pipeline's orientation brings it to Y-up.
    mesh.applyMatrix4(new Matrix4().fromArray(input.matrixWorld));
    root.rotation.x = -Math.PI / 2;
    root.add(mesh);

    const system = new GeometrySystem(root);
    expect(system.segmentation.ok).toBe(true);
    expect(system.segmentation.loops.head).toBe(1);
    const available = system
      .regions()
      .filter((r) => r.available)
      .map((r) => r.id);
    expect(available).toEqual(expect.arrayContaining(["head", "face", "neck", "bust"]));
    system.dispose();
    expect(root.children).toEqual([mesh]);
  });
});
