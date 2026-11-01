// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Matrix4 } from "three";
import { cutTriangles, loopsFrom, VertexStore } from "./cut";
import { hiddenRegions } from "./regions";
import { segmentModel, type Segmentation } from "./segment";
import { loadGlbInputs } from "./test-utils";

const area = (s: Segmentation, key: string, idx: number[]) => {
  const st = s.stores.get(key)!;
  let a = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const [p, q, r] = [st.position(idx[t]), st.position(idx[t + 1]), st.position(idx[t + 2])];
    const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
    const v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
    a += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
  }
  return a;
};

describe("plane cuts", () => {
  it("splits crossing triangles exactly and yields a closed loop", () => {
    // A unit cube's side faces (open top/bottom), cut horizontally.
    const pos = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1];
    const quads = [
      [0, 1, 2, 3],
      [5, 4, 7, 6],
      [4, 0, 3, 7],
      [1, 5, 6, 2],
    ];
    const tris = quads.flatMap(([a, b, c, d]) => [a, b, c, a, c, d]);
    const store = new VertexStore(pos);
    const r = cutTriangles(store, tris, { normal: [0, 1, 0], constant: -0.5 }, "y");
    expect(r.above.length).toBeGreaterThan(0);
    expect(r.below.length).toBeGreaterThan(0);
    for (const i of [...r.above]) expect(store.position(i)[1]).toBeGreaterThanOrEqual(0.5 - 1e-9);
    for (const i of [...r.below]) expect(store.position(i)[1]).toBeLessThanOrEqual(0.5 + 1e-9);
    const loops = loopsFrom(r.segments, store);
    expect(loops).toHaveLength(1);
    // 4 cut corners plus 4 points where the faces' diagonals cross the plane.
    expect(loops[0]).toHaveLength(8);
    for (const i of loops[0]) expect(store.position(i)[1]).toBeCloseTo(0.5, 9);
  });
});

describe("segmentation of real models", () => {
  it("segments the sample head (separate hair, eyes, brows) into every region", async () => {
    const s = segmentModel(await loadGlbInputs("public/models/sample-head/sample-head.glb"));
    expect(s.ok).toBe(true);
    const available = s.regions.filter((r) => r.available).map((r) => r.id);
    expect(available.sort()).toEqual(
      [
        "head",
        "face",
        "hair",
        "ear-left",
        "ear-right",
        "eye-left",
        "eye-right",
        "brows",
        "lashes",
        "neck",
        "bust",
        "shoulders",
      ].sort(),
    );
    // One clean cross-section for each cut, each closed by a cap.
    expect(s.loops).toEqual({ head: 1, shoulder: 1 });
    expect(s.caps.map((c) => c.cut).sort()).toEqual(["head", "shoulder"]);
    // Ears are mirror images: similar size, opposite sides.
    const ears = s.regions.filter((r) => r.id.startsWith("ear-")).map((r) => r.triangles);
    expect(Math.abs(ears[0] - ears[1]) / Math.max(...ears)).toBeLessThan(0.2);
  });

  it("never moves original vertices and preserves the skin's surface area", async () => {
    const inputs = await loadGlbInputs("public/models/sample-head/sample-head.glb");
    const skin = inputs.find((m) => m.role === "body")!;
    const before = Array.from(skin.positions);
    const s = segmentModel(inputs);
    const store = s.stores.get(skin.key)!;
    expect(store.positions.slice(0, before.length)).toEqual(before);
    const original = area(
      { ...s, stores: new Map([[skin.key, new VertexStore(before)]]) },
      skin.key,
      Array.from(skin.indices),
    );
    const parts = s.parts.filter((p) => p.meshKey === skin.key).reduce((a, p) => a + area(s, skin.key, p.indices), 0);
    expect(parts / original).toBeCloseTo(1, 6);
  });

  it("segments a fused single mesh in another orientation and scale (provider-like)", async () => {
    // fused-zup-cm.glb is Z-up in centimetres; bring it to Y-up as the pipeline does.
    const toYUp = new Matrix4().makeRotationX(-Math.PI / 2);
    const s = segmentModel(await loadGlbInputs("fixtures/reconstruction/fused-zup-cm.glb", toYUp));
    expect(s.ok).toBe(true);
    const r = Object.fromEntries(s.regions.map((x) => [x.id, x]));
    expect(r.head.available && r.face.available && r.neck.available && r.bust.available).toBe(true);
    // Hair and eyes are not separate here — reported, not faked.
    expect(r.hair).toMatchObject({ available: false });
    expect(r.hair.reason).toMatch(/same surface/);
    expect(r["eye-left"].available).toBe(false);
    expect(s.loops.head).toBe(1);
  });

  it("reports why a shape without a neck can't be segmented", () => {
    // A plain cylinder: the same width everywhere, so no neck.
    const pos: number[] = [];
    const idx: number[] = [];
    const rings = 30;
    const seg = 24;
    for (let r = 0; r < rings; r++)
      for (let k = 0; k < seg; k++)
        pos.push(Math.cos((k / seg) * 2 * Math.PI) * 0.2, r / rings, Math.sin((k / seg) * 2 * Math.PI) * 0.2);
    for (let r = 0; r < rings - 1; r++)
      for (let k = 0; k < seg; k++) {
        const a = r * seg + k;
        const b = r * seg + ((k + 1) % seg);
        idx.push(a, b, a + seg, b, b + seg, a + seg);
      }
    const s = segmentModel([
      { key: "a", role: "body", positions: pos, indices: idx, matrixWorld: new Matrix4().elements },
    ]);
    expect(s.ok).toBe(false);
    expect(s.reason).toMatch(/neck/);
    expect(s.regions.every((x) => !x.available)).toBe(true);
  });
});

describe("show presets", () => {
  it("hides structural parts together so nothing floats", () => {
    expect([...hiddenRegions("head", [])].sort()).toEqual(["bust", "neck", "shoulders"]);
    expect([...hiddenRegions("headNeck", [])].sort()).toEqual(["bust", "shoulders"]);
    expect([...hiddenRegions("bust", ["hair"])]).toEqual(["hair"]);
    // Face is part of the continuous skin: never hidden on its own.
    expect([...hiddenRegions("bust", ["face" as never])]).toEqual([]);
    expect([...hiddenRegions("bust", ["neck"])].sort()).toEqual(["bust", "neck", "shoulders"]);
  });
});
