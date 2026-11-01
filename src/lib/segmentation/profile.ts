/**
 * Anatomical landmarks of a head-and-shoulders model from horizontal slices
 * of its surface — no texture, landmarks or provider metadata needed, so it
 * works on any reconstruction (separate meshes or one fused mesh).
 *
 * Coordinates: Y up, +Z towards the viewer (the face), any scale. Input is a
 * flat list of world-space vertex positions (x, y, z, x, y, z, …).
 */

export interface Plane {
  /** Unit normal pointing to the "upper" side (towards the head). */
  normal: [number, number, number];
  /** n · p + constant = 0 on the plane (three.js convention). */
  constant: number;
}

export interface Profile {
  minY: number;
  maxY: number;
  centerX: number;
  /** Heights as fractions of the model height (0 = bottom, 1 = top). */
  neckT: number;
  chinT: number;
  shoulderT: number | null;
  neckWidth: number;
  headWidth: number;
  /** Slanted cut from under the chin to the nape: separates head from neck. */
  headCut: Plane;
  /** Horizontal cut where the neck meets the shoulders (null for head-only models). */
  shoulderCut: Plane | null;
  /** Head depth extremes at mid-head height (for face and ear rules). */
  headFrontZ: number;
  headBackZ: number;
}

export type ProfileResult = { ok: true; profile: Profile } | { ok: false; reason: string };

const BINS = 120;

interface Slice {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  n: number;
}

function smooth(values: number[], radius: number): number[] {
  return values.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let k = i - radius; k <= i + radius; k++) {
      if (k >= 0 && k < values.length && Number.isFinite(values[k])) {
        s += values[k];
        n++;
      }
    }
    return n ? s / n : NaN;
  });
}

/** Fills empty slices from their neighbours. */
function fill(values: number[]): number[] {
  const out = [...values];
  let last = NaN;
  for (let i = 0; i < out.length; i++)
    if (Number.isFinite(out[i])) last = out[i];
    else out[i] = last;
  last = NaN;
  for (let i = out.length - 1; i >= 0; i--)
    if (Number.isFinite(out[i])) last = out[i];
    else if (!Number.isFinite(out[i])) out[i] = last;
  return out;
}

export function analyzeProfile(positions: ArrayLike<number>): ProfileResult {
  const count = Math.floor(positions.length / 3);
  if (count < 200) return { ok: false, reason: "Too few vertices to analyse." };

  let minY = Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  const H = maxY - minY;
  if (!(H > 0)) return { ok: false, reason: "The model has no height." };
  const centerX = (minX + maxX) / 2;

  const slices: Slice[] = Array.from({ length: BINS }, () => ({
    minX: Infinity,
    maxX: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
    n: 0,
  }));
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const b = Math.min(BINS - 1, Math.floor(((y - minY) / H) * BINS));
    const s = slices[b];
    if (x < s.minX) s.minX = x;
    if (x > s.maxX) s.maxX = x;
    if (z < s.minZ) s.minZ = z;
    if (z > s.maxZ) s.maxZ = z;
    s.n++;
  }
  const raw = (f: (s: Slice) => number) => slices.map((s) => (s.n ? f(s) : NaN));
  const width = smooth(fill(raw((s) => s.maxX - s.minX)), 2);
  const front = smooth(fill(raw((s) => s.maxZ)), 1);
  const back = smooth(fill(raw((s) => s.minZ)), 1);
  const t = (b: number) => (b + 0.5) / BINS;
  const bin = (tt: number) => Math.min(BINS - 1, Math.max(0, Math.floor(tt * BINS)));

  // Widest part of the head (upper 45 %).
  let headWidth = 0;
  for (let b = bin(0.55); b < BINS; b++) headWidth = Math.max(headWidth, width[b]);

  // Neck: the narrowest slice below the head.
  let neckB = -1;
  for (let b = bin(0.08); b <= bin(0.72); b++) if (neckB < 0 || width[b] < width[neckB]) neckB = b;
  const neckWidth = width[neckB];
  if (!(neckWidth < headWidth * 0.9))
    return { ok: false, reason: "No distinct neck found — the model may not be a head-and-shoulders portrait." };

  // Chin: just above the neck, the front surface jumps forward (throat → chin).
  let chinB = neckB;
  let bestJump = 0;
  const headSpan = Math.max(4, Math.round((BINS - neckB) * 0.45));
  for (let b = neckB; b < Math.min(BINS - 2, neckB + headSpan); b++) {
    const jump = front[b + 2] - front[b];
    if (jump > bestJump) {
      bestJump = jump;
      chinB = b;
    }
  }
  const chinT = t(chinB);
  const neckT = t(neckB);

  // Shoulders: going down from the neck, the width flares out (trapezius).
  let shoulderB = -1;
  for (let b = neckB; b >= 0; b--) {
    if (width[b] > neckWidth * 1.18) {
      shoulderB = b + 1;
      break;
    }
  }
  const shoulderT = shoulderB >= 0 && shoulderB < neckB ? t(shoulderB) : null;

  // Head cut: from the throat just under the jaw up to the nape at the back.
  // The jaw's sides reach lower than the chin's front, so the cut is anchored
  // where the slices are still neck-width (the top of the neck).
  const y = (tt: number) => minY + tt * H;
  let neckTopB = neckB;
  for (let b = neckB; b <= chinB; b++) if (width[b] < neckWidth * 1.1) neckTopB = b;
  const throatB = Math.max(neckB, neckTopB - 1);
  const frontPoint = [y(t(throatB)), front[throatB] + 0.02 * H] as const; // (y, z), just outside the surface
  const napeB = Math.min(BINS - 1, throatB + Math.round(0.07 * BINS));
  const backPoint = [y(t(napeB)), back[napeB] - 0.02 * H] as const;
  // Normal ⟂ (back − front) in the YZ plane, pointing up.
  const dy = backPoint[0] - frontPoint[0];
  const dz = backPoint[1] - frontPoint[1];
  let ny = -dz;
  let nz = dy;
  if (ny < 0) {
    ny = -ny;
    nz = -nz;
  }
  const len = Math.hypot(ny, nz) || 1;
  const headNormal: [number, number, number] = [0, ny / len, nz / len];
  const headCut: Plane = {
    normal: headNormal,
    constant: -(headNormal[1] * frontPoint[0] + headNormal[2] * frontPoint[1]),
  };

  // The cut must leave the neck below it at the back as well.
  if (backPoint[0] <= y(neckT)) return { ok: false, reason: "The head and neck could not be separated cleanly." };

  const shoulderCut: Plane | null = shoulderT !== null ? { normal: [0, 1, 0], constant: -y(shoulderT) } : null;

  const midHead = bin(chinT + (1 - chinT) * 0.45);
  return {
    ok: true,
    profile: {
      minY,
      maxY,
      centerX,
      neckT,
      chinT,
      shoulderT,
      neckWidth,
      headWidth,
      headCut,
      shoulderCut,
      headFrontZ: front[midHead],
      headBackZ: back[midHead],
    },
  };
}

export const planeDistance = (p: Plane, x: number, y: number, z: number) =>
  p.normal[0] * x + p.normal[1] * y + p.normal[2] * z + p.constant;
