/**
 * Finds which way a reconstructed bust is facing, so models from providers
 * with different conventions (Y-up / Z-up, ±Z forward) arrive upright and
 * facing the camera. Pure maths on world-space positions.
 */

type Axis = 0 | 1 | 2;
export interface Direction {
  axis: Axis;
  sign: 1 | -1;
}

export interface OrientationResult {
  up: Direction;
  forward: Direction;
  /** 0–1: how clearly the shape decided (low → conventions were assumed). */
  confidence: { up: number; forward: number };
}

const coord = (p: ArrayLike<number>, i: number, a: Axis) => p[i * 3 + a];

/** Share of occupied voxels that are still occupied after mirroring across `axis`. */
function mirrorOverlap(p: ArrayLike<number>, n: number, axis: Axis, min: number[], max: number[]): number {
  const R = 24;
  const cell = (v: number, a: Axis) =>
    Math.min(R - 1, Math.max(0, Math.floor(((v - min[a]) / (max[a] - min[a] || 1)) * R)));
  const occ = new Set<number>();
  for (let i = 0; i < n; i++)
    occ.add(cell(coord(p, i, 0), 0) * R * R + cell(coord(p, i, 1), 1) * R + cell(coord(p, i, 2), 2));
  // Mirror about the centroid along `axis` (robust to off-centre models).
  let c = 0;
  for (let i = 0; i < n; i++) c += coord(p, i, axis);
  c /= n;
  let hit = 0;
  for (const key of occ) {
    const idx = [Math.floor(key / (R * R)), Math.floor(key / R) % R, key % R];
    const centre = ((c - min[axis]) / (max[axis] - min[axis] || 1)) * R;
    idx[axis] = Math.round(2 * centre - idx[axis] - 1);
    if (idx[axis] >= 0 && idx[axis] < R && occ.has(idx[0] * R * R + idx[1] * R + idx[2])) hit++;
  }
  return hit / occ.size;
}

/** Widths along `lateral` in bins along `along`, from its min to its max end. */
function widthProfile(
  p: ArrayLike<number>,
  n: number,
  along: Axis,
  lateral: Axis,
  min: number[],
  max: number[],
  bins = 24,
) {
  const lo = new Array(bins).fill(Infinity);
  const hi = new Array(bins).fill(-Infinity);
  for (let i = 0; i < n; i++) {
    const b = Math.min(
      bins - 1,
      Math.floor(((coord(p, i, along) - min[along]) / (max[along] - min[along] || 1)) * bins),
    );
    const v = coord(p, i, lateral);
    lo[b] = Math.min(lo[b], v);
    hi[b] = Math.max(hi[b], v);
  }
  return lo.map((l, i) => (Number.isFinite(l) ? hi[i] - l : 0));
}

/**
 * How neck-like a profile is: wide end → narrow waist → wider head → closed
 * top. Returns a score (0 = no neck) and which end holds the shoulders.
 */
function neckScore(w: number[]): { score: number; shouldersAtMin: boolean } {
  const best = { score: 0, shouldersAtMin: true };
  for (const shouldersAtMin of [true, false]) {
    const prof = shouldersAtMin ? w : [...w].reverse();
    const n = prof.length;
    // Waist in the middle 15–75 %; head above it; shoulders below it.
    for (let k = Math.floor(n * 0.15); k < Math.floor(n * 0.75); k++) {
      const waist = prof[k];
      if (!(waist > 0)) continue;
      const head = Math.max(...prof.slice(k + 1));
      const shoulders = Math.max(...prof.slice(0, k));
      const top = prof[n - 1];
      if (head < waist * 1.08 || shoulders < waist * 1.2) continue;
      // The head end closes (crown narrower than the head's widest slice).
      const closes = top < head * 0.9 ? 1 : 0.5;
      const score = Math.min(head / waist, 2) * Math.min(shoulders / waist, 4) * closes;
      if (score > best.score) Object.assign(best, { score, shouldersAtMin });
    }
  }
  return best;
}

export function detectOrientation(positions: ArrayLike<number>): OrientationResult {
  const n = Math.floor(positions.length / 3);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++)
    for (const a of [0, 1, 2] as Axis[]) {
      min[a] = Math.min(min[a], coord(positions, i, a));
      max[a] = Math.max(max[a], coord(positions, i, a));
    }

  // Lateral (left–right): the axis of mirror symmetry of a face and shoulders.
  const sym = ([0, 1, 2] as Axis[]).map((a) => mirrorOverlap(positions, n, a, min, max));
  const lateral = ([0, 1, 2] as Axis[]).reduce((b, a) => (sym[a] > sym[b] ? a : b), 0 as Axis);

  // Up: of the other two axes, the one whose width profile has a neck.
  const others = ([0, 1, 2] as Axis[]).filter((a) => a !== lateral);
  const scores = others.map((a) => neckScore(widthProfile(positions, n, a, lateral, min, max)));
  let upIdx = scores[0].score >= scores[1].score ? 0 : 1;
  let upConfidence = Math.min(
    1,
    Math.abs(scores[0].score - scores[1].score) / Math.max(scores[0].score, scores[1].score, 1e-9),
  );
  if (Math.max(scores[0].score, scores[1].score) === 0) {
    // No neck found (e.g. a head without shoulders): fall back to the glTF convention.
    upIdx = others.indexOf(1) >= 0 ? others.indexOf(1) : 0;
    upConfidence = 0;
  }
  const upAxis = others[upIdx];
  const up: Direction = {
    axis: upAxis,
    sign: scores[upIdx].score === 0 && upAxis === 1 ? 1 : scores[upIdx].shouldersAtMin ? 1 : -1,
  };
  const depthAxis = others[1 - upIdx];
  const L = max[up.axis] - min[up.axis];

  // Forward: at nose height the front surface has a narrow central spike
  // (the nose, ~±10 % of head width); the back of the skull is a broad curve.
  const along = widthProfile(positions, n, up.axis, lateral, min, max);
  const prof = up.sign === 1 ? along : [...along].reverse();
  let waist = Math.floor(prof.length * 0.15);
  for (let k = waist; k < Math.floor(prof.length * 0.75); k++) if (prof[k] > 0 && prof[k] < prof[waist]) waist = k;
  const tWaist = (waist + 0.5) / prof.length;
  const span = 1 - tWaist;
  const height = (t: number) => (up.sign === 1 ? min[up.axis] + t * L : max[up.axis] - t * L);
  const [bandA, bandB] = [height(tWaist + 0.28 * span), height(tWaist + 0.55 * span)];
  const bandLo = Math.min(bandA, bandB);
  const bandHi = Math.max(bandA, bandB);

  const LB = 40;
  const front = new Array(LB).fill(-Infinity);
  const back = new Array(LB).fill(Infinity);
  let latMin = Infinity;
  let latMax = -Infinity;
  for (let i = 0; i < n; i++) {
    const u = coord(positions, i, up.axis);
    if (u < bandLo || u > bandHi) continue;
    latMin = Math.min(latMin, coord(positions, i, lateral));
    latMax = Math.max(latMax, coord(positions, i, lateral));
  }
  for (let i = 0; i < n; i++) {
    const u = coord(positions, i, up.axis);
    if (u < bandLo || u > bandHi) continue;
    const b = Math.min(LB - 1, Math.floor(((coord(positions, i, lateral) - latMin) / (latMax - latMin || 1)) * LB));
    const d = coord(positions, i, depthAxis);
    front[b] = Math.max(front[b], d);
    back[b] = Math.min(back[b], d);
  }
  const c = LB / 2;
  const sharp = (curve: number[], sign: 1 | -1) => {
    const at = (k: number) => sign * curve[Math.round(k)];
    const centre = Math.max(at(c - 1), at(c), at(c - 2));
    const sides = (at(c - 6) + at(c + 4)) / 2;
    return Number.isFinite(centre - sides) ? centre - sides : 0;
  };
  const frontSharp = sharp(front, 1);
  const backSharp = sharp(back, -1);
  const forwardSign: 1 | -1 = frontSharp >= backSharp ? 1 : -1;
  const forwardConfidence = Math.min(
    1,
    Math.abs(frontSharp - backSharp) / Math.max(Math.abs(frontSharp), Math.abs(backSharp), 1e-9),
  );
  return {
    up,
    forward: { axis: depthAxis, sign: forwardSign },
    confidence: { up: Math.max(0, upConfidence), forward: forwardConfidence },
  };
}

/**
 * Column-major 3×3 rotation taking the detected frame to Y-up, +Z-forward.
 * Rows of the matrix are the detected right, up and forward vectors.
 */
export function orientationMatrix(o: OrientationResult): number[] {
  const vec = (d: Direction) => {
    const v = [0, 0, 0];
    v[d.axis] = d.sign;
    return v;
  };
  const up = vec(o.up);
  const fwd = vec(o.forward);
  const right = [up[1] * fwd[2] - up[2] * fwd[1], up[2] * fwd[0] - up[0] * fwd[2], up[0] * fwd[1] - up[1] * fwd[0]];
  // Row-major [right; up; fwd] → column-major for three.js Matrix3/Matrix4.
  return [right[0], up[0], fwd[0], right[1], up[1], fwd[1], right[2], up[2], fwd[2]];
}
