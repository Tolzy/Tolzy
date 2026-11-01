// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Euler, Matrix4, Vector3 } from "three";
import { inspectModel, ModelError } from "./model-pipeline";

const load = (p: string) => readFileSync(p);
const rotate = (o: [number, number, number], v: [number, number, number]) =>
  new Vector3(...v).applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(...o, "XYZ")));

describe("inspectModel", () => {
  it("accepts the sample head as already upright and facing forward", async () => {
    const m = await inspectModel(load("public/models/sample-head/sample-head.glb"));
    expect(m.profile.ok).toBe(true);
    expect(m.triangles).toBeGreaterThan(10_000);
    const up = rotate(m.orientation, [0, 1, 0]);
    const fwd = rotate(m.orientation, [0, 0, 1]);
    expect(up.y).toBeCloseTo(1, 5);
    expect(fwd.z).toBeCloseTo(1, 5);
    expect(m.framing.pivot).toBeGreaterThan(0.5);
    expect(m.framing.pivot).toBeLessThan(0.75);
  });

  it("turns a Z-up, centimetre, single-mesh model upright and facing the camera", async () => {
    const m = await inspectModel(load("fixtures/reconstruction/fused-zup-cm.glb"));
    expect(m.meshes).toBe(1);
    // The fixture's up is +Z and its face looks along −Y.
    const up = rotate(m.orientation, [0, 0, 1]);
    const face = rotate(m.orientation, [0, -1, 0]);
    expect(up.y).toBeCloseTo(1, 5);
    expect(face.z).toBeCloseTo(1, 5);
    expect(m.profile.ok).toBe(true);
  });

  it.each([
    ["not a GLB", Buffer.from("hello world, definitely not a model")],
    ["truncated", load("public/models/sample-head/sample-head.glb").subarray(0, 5000)],
  ])("rejects %s", async (_, data) => {
    await expect(inspectModel(data)).rejects.toBeInstanceOf(ModelError);
  });
});
