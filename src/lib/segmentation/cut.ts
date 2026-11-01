/**
 * Exact plane cuts on indexed triangle meshes, plus caps that close the cut.
 *
 * Triangles crossing the plane are clipped (Sutherland–Hodgman) instead of
 * being assigned whole to one side, so cut edges are straight rather than
 * jagged. Every crossed edge gets exactly one new vertex (shared by both
 * neighbouring triangles), so the two sides and the cap meet without gaps.
 */

import type { Plane } from "./profile";

/** Growable vertex attributes shared by every part made from one mesh. */
export class VertexStore {
  positions: number[];
  normals: number[] | null;
  uvs: number[] | null;
  private splits = new Map<string, number>();

  constructor(positions: ArrayLike<number>, normals?: ArrayLike<number> | null, uvs?: ArrayLike<number> | null) {
    this.positions = Array.from(positions);
    this.normals = normals ? Array.from(normals) : null;
    this.uvs = uvs ? Array.from(uvs) : null;
  }

  get count() {
    return this.positions.length / 3;
  }

  position(i: number): [number, number, number] {
    return [this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]];
  }

  /** Vertex at fraction f along edge a→b (deduplicated per edge and plane). */
  split(a: number, b: number, f: number, planeKey: string): number {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const key = `${planeKey}:${lo}:${hi}`;
    const hit = this.splits.get(key);
    if (hit !== undefined) return hit;
    const ff = a === lo ? f : 1 - f;
    const lerp = (arr: number[], size: number) => {
      for (let k = 0; k < size; k++) arr.push(arr[lo * size + k] + (arr[hi * size + k] - arr[lo * size + k]) * ff);
    };
    lerp(this.positions, 3);
    if (this.normals) {
      lerp(this.normals, 3);
      const n = this.normals.length - 3;
      const l = Math.hypot(this.normals[n], this.normals[n + 1], this.normals[n + 2]) || 1;
      for (let k = 0; k < 3; k++) this.normals[n + k] /= l;
    }
    if (this.uvs) lerp(this.uvs, 2);
    const index = this.count - 1;
    this.splits.set(key, index);
    return index;
  }

  /** Appends a vertex with explicit attributes (cap vertices). */
  add(p: [number, number, number], n: [number, number, number], uv: [number, number]): number {
    this.positions.push(...p);
    this.normals?.push(...n);
    this.uvs?.push(...uv);
    return this.count - 1;
  }
}

export interface CutResult {
  above: number[];
  below: number[];
  /** Cut edges lying on the plane, as vertex index pairs (for caps). */
  segments: [number, number][];
}

const EPS = 1e-7;

/** Splits triangles (flat index list) by a plane given in the store's space. */
export function cutTriangles(store: VertexStore, tris: number[], plane: Plane, planeKey: string): CutResult {
  const above: number[] = [];
  const below: number[] = [];
  const segments: [number, number][] = [];
  const d = (i: number) => {
    const [x, y, z] = store.position(i);
    const v = plane.normal[0] * x + plane.normal[1] * y + plane.normal[2] * z + plane.constant;
    return Math.abs(v) < EPS ? 0 : v;
  };

  for (let t = 0; t < tris.length; t += 3) {
    const v = [tris[t], tris[t + 1], tris[t + 2]];
    const dist = v.map(d);
    if (dist.every((x) => x >= 0)) {
      above.push(...v);
      if (dist.filter((x) => x === 0).length === 2) {
        const on = v.filter((_, k) => dist[k] === 0);
        segments.push([on[0], on[1]]);
      }
      continue;
    }
    if (dist.every((x) => x <= 0)) {
      below.push(...v);
      continue;
    }
    // Crossing: clip against each side.
    const clip = (sign: 1 | -1) => {
      const out: number[] = [];
      for (let k = 0; k < 3; k++) {
        const a = v[k];
        const b = v[(k + 1) % 3];
        const da = dist[k] * sign;
        const db = dist[(k + 1) % 3] * sign;
        if (da >= 0) out.push(a);
        if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
          out.push(store.split(a, b, dist[k] / (dist[k] - dist[(k + 1) % 3]), planeKey));
        }
      }
      return out;
    };
    const up = clip(1);
    const down = clip(-1);
    for (let k = 1; k + 1 < up.length; k++) above.push(up[0], up[k], up[k + 1]);
    for (let k = 1; k + 1 < down.length; k++) below.push(down[0], down[k], down[k + 1]);
    // The two vertices of the upper polygon that lie on the plane form the cut edge.
    const on = up.filter((i) => Math.abs(d(i)) < 1e-6 || !v.includes(i));
    const uniq = [...new Set(on)];
    if (uniq.length === 2) segments.push([uniq[0], uniq[1]]);
  }
  return { above, below, segments };
}

/** Chains cut segments into closed loops; open chains are discarded. */
export function loopsFrom(segments: [number, number][], store: VertexStore): number[][] {
  // Join by position, not index: on-plane original vertices and split vertices can coincide.
  const key = (i: number) =>
    store
      .position(i)
      .map((x) => x.toFixed(6))
      .join(",");
  const canon = new Map<string, number>();
  const id = (i: number) => {
    const k = key(i);
    if (!canon.has(k)) canon.set(k, i);
    return canon.get(k)!;
  };
  const adj = new Map<number, number[]>();
  for (const [a0, b0] of segments) {
    const a = id(a0);
    const b = id(b0);
    if (a === b) continue;
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
    (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
  }
  const used = new Set<string>();
  const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const loops: number[][] = [];
  for (const start of adj.keys()) {
    for (const first of adj.get(start)!) {
      if (used.has(edgeKey(start, first))) continue;
      const loop = [start];
      let prev = start;
      let cur = first;
      used.add(edgeKey(start, first));
      let closed = false;
      for (let guard = 0; guard < 100000; guard++) {
        if (cur === start) {
          closed = true;
          break;
        }
        loop.push(cur);
        const next = (adj.get(cur) ?? []).find((n) => n !== prev && !used.has(edgeKey(cur, n)));
        if (next === undefined) break;
        used.add(edgeKey(cur, next));
        prev = cur;
        cur = next;
      }
      if (closed && loop.length >= 3) loops.push(loop);
    }
  }
  return loops;
}

/**
 * Drops loops nested inside other loops (internal surfaces such as a mouth or
 * throat interior crossing the cut). The outer cap covers their openings;
 * capping both would stack coplanar triangles and flicker.
 */
export function outerLoops(loops: number[][], store: VertexStore, normal: [number, number, number]): number[][] {
  // 2D basis in the plane.
  const n = normal;
  const ref = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = [n[1] * ref[2] - n[2] * ref[1], n[2] * ref[0] - n[0] * ref[2], n[0] * ref[1] - n[1] * ref[0]];
  const ul = Math.hypot(u[0], u[1], u[2]);
  u[0] /= ul;
  u[1] /= ul;
  u[2] /= ul;
  const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  const flat = loops.map((l) =>
    l.map((i) => {
      const p = store.position(i);
      return [p[0] * u[0] + p[1] * u[1] + p[2] * u[2], p[0] * v[0] + p[1] * v[1] + p[2] * v[2]] as const;
    }),
  );
  const area = (poly: readonly (readonly [number, number])[]) =>
    Math.abs(
      poly.reduce((a, p, k) => a + p[0] * poly[(k + 1) % poly.length][1] - poly[(k + 1) % poly.length][0] * p[1], 0) /
        2,
    );
  const inside = (pt: readonly [number, number], poly: readonly (readonly [number, number])[]) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const areas = flat.map(area);
  return loops.filter((_, k) => {
    const centroid = flat[k].reduce((a, p) => [a[0] + p[0] / flat[k].length, a[1] + p[1] / flat[k].length] as const, [
      0, 0,
    ] as const);
    return !flat.some((other, j) => j !== k && areas[j] > areas[k] && inside(centroid, other));
  });
}

/**
 * Closes loops with fan triangles facing `facing`. Cap vertices get their own
 * flat normal and one UV sampled from the skin next to the cut (so a textured
 * cap is evenly skin-coloured instead of smearing across texture seams).
 */
export function buildCaps(
  store: VertexStore,
  loops: number[][],
  facing: [number, number, number],
  uvVertex: (loop: number[]) => number,
): number[] {
  const tris: number[] = [];
  for (const loop of loops) {
    const uvIndex = uvVertex(loop);
    const uv: [number, number] = store.uvs ? [store.uvs[uvIndex * 2], store.uvs[uvIndex * 2 + 1]] : [0, 0];
    const pts = loop.map((i) => store.position(i));
    const c: [number, number, number] = [0, 0, 0];
    for (const p of pts) for (let k = 0; k < 3; k++) c[k] += p[k] / pts.length;
    const center = store.add(c, facing, uv);
    const ring = pts.map((p) => store.add(p, facing, uv));
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k];
      const b = ring[(k + 1) % ring.length];
      // Orient each triangle to face `facing`.
      const pa = store.position(a);
      const pb = store.position(b);
      const e1 = [pa[0] - c[0], pa[1] - c[1], pa[2] - c[2]];
      const e2 = [pb[0] - c[0], pb[1] - c[1], pb[2] - c[2]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const dot = n[0] * facing[0] + n[1] * facing[1] + n[2] * facing[2];
      if (dot >= 0) tris.push(center, a, b);
      else tris.push(center, b, a);
    }
  }
  return tris;
}
