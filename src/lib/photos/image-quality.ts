/**
 * Image measurements on greyscale pixels (0–255), independent of the browser
 * so they can be unit-tested. Inputs are small crops (≈ 256 px) of the face.
 */

/** Converts RGBA pixels to luma (Rec. 709). */
export function toGray(rgba: Uint8ClampedArray): Float32Array {
  const out = new Float32Array(rgba.length / 4);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    out[j] = 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];
  }
  return out;
}

/**
 * Variance of the Laplacian — a standard focus measure. Sharp edges give high
 * values; blur removes high frequencies and the variance collapses.
 */
export function laplacianVariance(gray: Float32Array, width: number, height: number): number {
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const v = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  if (!n) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export interface LightStats {
  /** Mean luma 0–255 (reported only: skin tone sets it, not exposure). */
  mean: number;
  /** 5th / 95th percentile luma. A well-exposed face of any skin tone has bright highlights (eyes, specular skin). */
  p5: number;
  p95: number;
  /** Share of pixels that are nearly black / nearly white. */
  dark: number;
  bright: number;
  /** Brighter half ÷ darker half (left vs right), ≥ 1. */
  sideRatio: number;
}

export function lightStats(gray: Float32Array, width: number, height: number): LightStats {
  let sum = 0;
  let dark = 0;
  let bright = 0;
  let left = 0;
  let right = 0;
  const half = Math.floor(width / 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = gray[y * width + x];
      sum += v;
      if (v < 25) dark++;
      if (v > 245) bright++;
      if (x < half) left += v;
      else right += v;
    }
  }
  const n = width * height || 1;
  const sorted = Float32Array.from(gray).sort();
  const pct = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  const l = left / Math.max(1, half * height);
  const r = right / Math.max(1, (width - half) * height);
  return {
    mean: sum / n,
    p5: pct(0.05),
    p95: pct(0.95),
    dark: dark / n,
    bright: bright / n,
    sideRatio: Math.max(l, r) / Math.max(1, Math.min(l, r)),
  };
}

/** Mean luma of a rectangular region (clamped to the image). */
export function regionMean(
  gray: Float32Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  const xa = Math.max(0, Math.floor(Math.min(x0, x1)));
  const xb = Math.min(width, Math.ceil(Math.max(x0, x1)));
  const ya = Math.max(0, Math.floor(Math.min(y0, y1)));
  const yb = Math.min(height, Math.ceil(Math.max(y0, y1)));
  let sum = 0;
  let n = 0;
  for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++, n++) sum += gray[y * width + x];
  return n ? sum / n : 0;
}

/**
 * Stretches luma so its 2nd–98th percentiles span 0–255. Focus is then
 * measured independently of exposure and skin tone (a dark or low-contrast
 * photo is not mistaken for a blurry one).
 */
export function normalizeContrast(gray: Float32Array): Float32Array {
  const sorted = Float32Array.from(gray).sort();
  const lo = sorted[Math.floor(0.02 * sorted.length)] ?? 0;
  const hi = sorted[Math.floor(0.98 * sorted.length)] ?? 255;
  const range = Math.max(8, hi - lo);
  return gray.map((v) => Math.min(255, Math.max(0, ((v - lo) / range) * 255)));
}

/**
 * Thresholds, calibrated on the bundled fixtures (tests/fixtures/photos).
 * Exposure uses percentiles and clipping, never average brightness, so dark
 * and light skin tones are judged the same way.
 */
export const QUALITY = {
  /** Laplacian variance on a contrast-normalised 256-px face crop. */
  sharpFail: 40,
  sharpWarn: 90,
  /** Underexposed: even the brightest 5 % of the face is dim. */
  darkP95: 70,
  /** Overexposed: even the darkest 5 % of the face is bright. */
  brightP5: 185,
  clippedShare: 0.3,
  unevenRatio: 2.2,
};
