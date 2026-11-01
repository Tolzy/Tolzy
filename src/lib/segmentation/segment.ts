/**
 * Splits a portrait model into regions (docs/specs/model-parts.md).
 *
 * Works on any topology: separate meshes (hair, eyes, brows) are labelled by
 * their role; the skin — usually one fused head-neck-shoulder surface — is
 * cut exactly along two planes found by profile analysis (head | neck |
 * bust) and closed with caps, then face, ears and shoulders are labelled as
 * areas of that surface. Geometry is never moved or deformed: parts are
 * index lists into a shared vertex store (original vertices + cut vertices).
 */

import { buildCaps, cutTriangles, loopsFrom, outerLoops, VertexStore } from "./cut";
import { analyzeProfile, planeDistance, type Plane, type Profile } from "./profile";
import { REGION_DEFS, type RegionId } from "./regions";

export type MeshRole = "body" | "hair" | "eyes" | "brows" | "lashes" | "base" | "other";

export interface MeshInput {
  key: string;
  role: MeshRole;
  positions: ArrayLike<number>;
  normals?: ArrayLike<number> | null;
  uvs?: ArrayLike<number> | null;
  /** Triangle list (3 indices per triangle). */
  indices: ArrayLike<number>;
  /** Column-major 4×4 local → world matrix (three.js `Matrix4.elements`). */
  matrixWorld: ArrayLike<number>;
}

export interface Part {
  meshKey: string;
  region: RegionId;
  indices: number[];
}

export interface Cap {
  meshKey: string;
  /** "head": closes the head when the neck is hidden; "shoulder": closes the neck when the bust is hidden. */
  cut: "head" | "shoulder";
  indices: number[];
}

export interface RegionReport {
  id: RegionId;
  available: boolean;
  triangles: number;
  reason?: string;
}

export interface Segmentation {
  ok: boolean;
  /** Why segmentation could not run (model stays whole). */
  reason?: string;
  profile: Profile | null;
  stores: Map<string, VertexStore>;
  parts: Part[];
  caps: Cap[];
  regions: RegionReport[];
  /** Closed loops found per cut (1 = one clean neck cross-section). */
  loops: { head: number; shoulder: number };
}

const apply = (m: ArrayLike<number>, x: number, y: number, z: number): [number, number, number] => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

/** World plane → mesh-local plane (for an affine local → world matrix). */
function planeToLocal(p: Plane, m: ArrayLike<number>): Plane {
  // n_local = Aᵀ n ; c_local = n · t + c
  const n = p.normal;
  const nl: [number, number, number] = [
    m[0] * n[0] + m[1] * n[1] + m[2] * n[2],
    m[4] * n[0] + m[5] * n[1] + m[6] * n[2],
    m[8] * n[0] + m[9] * n[1] + m[10] * n[2],
  ];
  const c = n[0] * m[12] + n[1] * m[13] + n[2] * m[14] + p.constant;
  const len = Math.hypot(...nl) || 1;
  return { normal: [nl[0] / len, nl[1] / len, nl[2] / len], constant: c / len };
}

function worldPositions(mesh: MeshInput): Float32Array {
  const out = new Float32Array(mesh.positions.length);
  for (let i = 0; i < mesh.positions.length; i += 3) {
    out.set(apply(mesh.matrixWorld, mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]), i);
  }
  return out;
}

interface Tri {
  c: [number, number, number];
  n: [number, number, number];
}

function triInfo(store: VertexStore, m: ArrayLike<number>, a: number, b: number, c: number): Tri {
  const pa = apply(m, ...store.position(a));
  const pb = apply(m, ...store.position(b));
  const pc = apply(m, ...store.position(c));
  const e1 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
  const e2 = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
  const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  return {
    c: [(pa[0] + pb[0] + pc[0]) / 3, (pa[1] + pb[1] + pc[1]) / 3, (pa[2] + pb[2] + pc[2]) / 3],
    n: [n[0] / l, n[1] / l, n[2] / l],
  };
}

/** Triangle adjacency through shared vertex positions. */
function neighbours(store: VertexStore, tris: number[]): number[][] {
  const key = (i: number) =>
    store
      .position(i)
      .map((x) => x.toFixed(5))
      .join(",");
  const byVertex = new Map<string, number[]>();
  for (let t = 0; t < tris.length / 3; t++) {
    for (let k = 0; k < 3; k++) {
      const kk = key(tris[t * 3 + k]);
      (byVertex.get(kk) ?? byVertex.set(kk, []).get(kk)!).push(t);
    }
  }
  const adj: number[][] = Array.from({ length: tris.length / 3 }, () => []);
  for (const list of byVertex.values()) for (const a of list) for (const b of list) if (a !== b) adj[a].push(b);
  return adj;
}

/** Largest connected subset of `members` (by triangle adjacency). */
function largestComponent(members: Set<number>, adj: number[][]): Set<number> {
  const seen = new Set<number>();
  let best = new Set<number>();
  for (const s of members) {
    if (seen.has(s)) continue;
    const comp = new Set<number>([s]);
    const stack = [s];
    seen.add(s);
    while (stack.length) {
      const t = stack.pop()!;
      for (const n of adj[t])
        if (members.has(n) && !seen.has(n)) {
          seen.add(n);
          comp.add(n);
          stack.push(n);
        }
    }
    if (comp.size > best.size) best = comp;
  }
  return best;
}

/** More outlines than this at one cut means the surface there is not closed. */
const MAX_CUT_LOOPS = 2;

export function segmentModel(meshes: MeshInput[]): Segmentation {
  const stores = new Map<string, VertexStore>();
  const parts: Part[] = [];
  const caps: Cap[] = [];
  const counts = new Map<RegionId, number>();
  const add = (meshKey: string, region: RegionId, indices: number[]) => {
    if (!indices.length) return;
    parts.push({ meshKey, region, indices });
    counts.set(region, (counts.get(region) ?? 0) + indices.length / 3);
  };
  for (const m of meshes) stores.set(m.key, new VertexStore(m.positions, m.normals, m.uvs));

  const body = meshes.filter((m) => m.role === "body");
  const profileResult = body.length
    ? analyzeProfile(body.reduce<number[]>((acc, m) => (acc.push(...worldPositions(m)), acc), []))
    : ({ ok: false, reason: "No body surface found." } as const);

  const fail = (reason: string): Segmentation => ({
    ok: false,
    reason,
    profile: null,
    stores,
    parts: [],
    caps: [],
    regions: (Object.keys(REGION_DEFS) as RegionId[]).map((id) => ({ id, available: false, triangles: 0, reason })),
    loops: { head: 0, shoulder: 0 },
  });
  if (!profileResult.ok) return fail(profileResult.reason);
  const p = profileResult.profile;
  const H = p.maxY - p.minY;
  const yAt = (t: number) => p.minY + t * H;
  const loops = { head: 0, shoulder: 0 };
  const notes = new Map<RegionId, string>();

  for (const mesh of body) {
    const store = stores.get(mesh.key)!;
    const headLocal = planeToLocal(p.headCut, mesh.matrixWorld);
    const tris = Array.from(mesh.indices);
    const head = cutTriangles(store, tris, headLocal, "head");
    let neck = head.below;
    let bustTris: number[] = [];
    let shoulderSegments: [number, number][] = [];
    if (p.shoulderCut) {
      const shoulderLocal = planeToLocal(p.shoulderCut, mesh.matrixWorld);
      const s = cutTriangles(store, head.below, shoulderLocal, "shoulder");
      neck = s.above;
      bustTris = s.below;
      shoulderSegments = s.segments;
    }

    // Caps: pick a UV from the skin at the front of the neck.
    const frontmost = (loop: number[]) =>
      loop.reduce(
        (best, i) =>
          apply(mesh.matrixWorld, ...store.position(i))[2] > apply(mesh.matrixWorld, ...store.position(best))[2]
            ? i
            : best,
        loop[0],
      );
    const headLoops = outerLoops(loopsFrom(head.segments, store), store, headLocal.normal);
    loops.head += headLoops.length;
    // A neck cross-section is one outline (two at most for odd topology). More
    // means the cut crosses open or overlapping surfaces, and a cap would leave
    // holes or wedges, so the model is shown whole instead.
    if (headLoops.length > MAX_CUT_LOOPS)
      return fail("The neck of this model isn't a closed surface, so the head can't be separated cleanly.");
    const down = (pl: Plane): [number, number, number] => [-pl.normal[0], -pl.normal[1], -pl.normal[2]];
    const headCap = buildCaps(store, headLoops, down(headLocal), frontmost);
    if (headCap.length) caps.push({ meshKey: mesh.key, cut: "head", indices: headCap });
    if (p.shoulderCut) {
      const shoulderLocal = planeToLocal(p.shoulderCut, mesh.matrixWorld);
      const shoulderLoops = outerLoops(loopsFrom(shoulderSegments, store), store, shoulderLocal.normal);
      loops.shoulder += shoulderLoops.length;
      if (shoulderLoops.length > MAX_CUT_LOOPS)
        return fail("The shoulders of this model aren't a closed surface, so the bust can't be separated cleanly.");
      const cap = buildCaps(store, shoulderLoops, down(shoulderLocal), frontmost);
      if (cap.length) caps.push({ meshKey: mesh.key, cut: "shoulder", indices: cap });
    }

    // Label head triangles: ears and face are areas of the continuous skin.
    const headTris = head.above;
    const info = Array.from({ length: headTris.length / 3 }, (_, t) =>
      triInfo(store, mesh.matrixWorld, headTris[t * 3], headTris[t * 3 + 1], headTris[t * 3 + 2]),
    );
    const adj = neighbours(store, headTris);
    const headSpan = 1 - p.chinT;
    const depth = p.headFrontZ - p.headBackZ;
    const label: RegionId[] = info.map(() => "head");

    for (const side of [1, -1] as const) {
      const id: RegionId = side === 1 ? "ear-left" : "ear-right";
      const band = (t: Tri) =>
        t.c[1] > yAt(p.chinT + 0.18 * headSpan) &&
        t.c[1] < yAt(p.chinT + 0.62 * headSpan) &&
        t.c[2] > p.headBackZ + 0.15 * depth &&
        t.c[2] < p.headBackZ + 0.78 * depth &&
        (t.c[0] - p.centerX) * side > 0;
      let maxOut = 0;
      info.forEach((t) => band(t) && (maxOut = Math.max(maxOut, (t.c[0] - p.centerX) * side)));
      const members = new Set<number>();
      info.forEach((t, i) => band(t) && (t.c[0] - p.centerX) * side > 0.8 * maxOut && members.add(i));
      const ear = largestComponent(members, adj);
      const share = ear.size / info.length;
      if (ear.size >= 12 && share > 0.002 && share < 0.08) ear.forEach((i) => (label[i] = id));
      else notes.set(id, "No distinct ear shape was found on this model.");
    }

    const faceMembers = new Set<number>();
    const cz = (p.headFrontZ + p.headBackZ) / 2;
    info.forEach((t, i) => {
      if (label[i] !== "head") return;
      if (
        t.c[2] > cz + 0.12 * depth &&
        t.n[2] > 0.25 &&
        t.c[1] > yAt(p.chinT - 0.02) &&
        t.c[1] < yAt(p.chinT + 0.7 * headSpan)
      )
        faceMembers.add(i);
    });
    largestComponent(faceMembers, adj).forEach((i) => (label[i] = "face"));

    const byRegion = new Map<RegionId, number[]>();
    label.forEach((r, i) =>
      (byRegion.get(r) ?? byRegion.set(r, []).get(r)!).push(headTris[i * 3], headTris[i * 3 + 1], headTris[i * 3 + 2]),
    );
    for (const [r, idx] of byRegion) add(mesh.key, r, idx);
    add(mesh.key, "neck", neck);

    // Shoulders: the lateral parts of the bust.
    const shoulders: number[] = [];
    const chest: number[] = [];
    for (let t = 0; t < bustTris.length; t += 3) {
      const c = triInfo(store, mesh.matrixWorld, bustTris[t], bustTris[t + 1], bustTris[t + 2]).c;
      (Math.abs(c[0] - p.centerX) > p.neckWidth * 0.95 ? shoulders : chest).push(
        bustTris[t],
        bustTris[t + 1],
        bustTris[t + 2],
      );
    }
    add(mesh.key, "bust", chest);
    add(mesh.key, "shoulders", shoulders);
  }

  // Separate meshes, labelled by role (or by position for anything else).
  for (const mesh of meshes) {
    if (mesh.role === "body") continue;
    const store = stores.get(mesh.key)!;
    const tris = Array.from(mesh.indices);
    if (mesh.role === "hair") add(mesh.key, "hair", tris);
    else if (mesh.role === "brows") add(mesh.key, "brows", tris);
    else if (mesh.role === "lashes") add(mesh.key, "lashes", tris);
    else if (mesh.role === "base") add(mesh.key, "bust", tris);
    else if (mesh.role === "eyes") {
      const left: number[] = [];
      const right: number[] = [];
      for (let t = 0; t < tris.length; t += 3) {
        const c = triInfo(store, mesh.matrixWorld, tris[t], tris[t + 1], tris[t + 2]).c;
        (c[0] > p.centerX ? left : right).push(tris[t], tris[t + 1], tris[t + 2]);
      }
      add(mesh.key, "eye-left", left);
      add(mesh.key, "eye-right", right);
    } else {
      const byRegion = new Map<RegionId, number[]>();
      for (let t = 0; t < tris.length; t += 3) {
        const c = triInfo(store, mesh.matrixWorld, tris[t], tris[t + 1], tris[t + 2]).c;
        const r: RegionId =
          planeDistance(p.headCut, ...c) >= 0
            ? "head"
            : p.shoulderCut && planeDistance(p.shoulderCut, ...c) < 0
              ? "bust"
              : "neck";
        (byRegion.get(r) ?? byRegion.set(r, []).get(r)!).push(tris[t], tris[t + 1], tris[t + 2]);
      }
      for (const [r, idx] of byRegion) add(mesh.key, r, idx);
    }
  }

  if (!meshes.some((m) => m.role === "hair"))
    notes.set(
      "hair",
      "Hair is part of the same surface as the head in this model, so it can’t be selected separately.",
    );
  if (!meshes.some((m) => m.role === "eyes"))
    notes
      .set("eye-left", "This model has no separate eye geometry.")
      .set("eye-right", "This model has no separate eye geometry.");
  if (!p.shoulderCut)
    notes.set("bust", "This model ends at the neck.").set("shoulders", "This model ends at the neck.");

  const regions: RegionReport[] = (Object.keys(REGION_DEFS) as RegionId[]).map((id) => {
    const triangles = counts.get(id) ?? 0;
    return {
      id,
      available: triangles > 0,
      triangles,
      reason: triangles > 0 ? undefined : (notes.get(id) ?? "Not present in this model."),
    };
  });
  return { ok: true, profile: p, stores, parts, caps, regions, loops };
}
