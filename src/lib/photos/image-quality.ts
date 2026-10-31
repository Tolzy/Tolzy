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

export interface ColorStats {
  /** Mean colour 0–255. */
  r: number;
  g: number;
  b: number;
  /** Hasler–Süsstrunk colourfulness: ~0 for greys, > 40 for vivid colour. */
  colourfulness: number;
  /** Standard deviation of luma: high for patterns and stripes. */
  lumaSpread: number;
  /** Share of near-white pixels (luma > 170): threads, prints, light fabric. */
  brightShare: number;
}

/** Colour statistics of RGBA pixels (used for the head-covering check). */
export function colorStats(rgba: Uint8ClampedArray): ColorStats {
  const n = rgba.length / 4 || 1;
  let r = 0,
    g = 0,
    b = 0,
    rg = 0,
    yb = 0,
    rg2 = 0,
    yb2 = 0,
    l = 0,
    l2 = 0,
    bright = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const [R, G, B] = [rgba[i], rgba[i + 1], rgba[i + 2]];
    r += R;
    g += G;
    b += B;
    const a = R - G;
    const c = 0.5 * (R + G) - B;
    rg += a;
    yb += c;
    rg2 += a * a;
    yb2 += c * c;
    const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    l += y;
    l2 += y * y;
    if (y > 170) bright++;
  }
  const mrg = rg / n;
  const myb = yb / n;
  const srg = Math.sqrt(Math.max(0, rg2 / n - mrg * mrg));
  const syb = Math.sqrt(Math.max(0, yb2 / n - myb * myb));
  const ml = l / n;
  return {
    r: r / n,
    g: g / n,
    b: b / n,
    colourfulness: Math.hypot(srg, syb) + 0.3 * Math.hypot(mrg, myb),
    lumaSpread: Math.sqrt(Math.max(0, l2 / n - ml * ml)),
    brightShare: bright / n,
  };
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
  /** Head covering above the forehead (calibrated on headwear.jpg vs front.jpg). */
  /** Colourfulness above the cheeks' own, for a vivid covering. */
  headwearExtraColourfulness: 18,
  /** Luma spread of a patterned covering (stripes, prints). Hair ≈ 20–35. */
  headwearSpread: 50,
  /** Share of near-white pixels in a patterned covering (dark hair ≈ 0). */
  headwearBrightShare: 0.08,
  /** Minimum colour distance from the skin. */
  headwearSkinDistance: 70,
};
