/**
 * Pure framing maths for the studio camera. Kept free of three.js so it can be
 * unit tested and reused by exports (PNG renders) later.
 */

/** Models are normalised to this height (scene units) before framing. */
export const MODEL_HEIGHT = 1;

export interface FrameInput {
  /** Normalised model width and height (scene units). */
  width: number;
  height: number;
  /** Vertical field of view in degrees. */
  fov: number;
  /** Viewport aspect ratio (width / height). */
  aspect: number;
  /** Extra space around the model; 1.2 = 20 % breathing room. */
  margin: number;
  /** Fraction of the viewport height available to the model (UI overlays excluded). Default 1. */
  fill?: number;
}

/** Distance at which the model fits the viewport both vertically and horizontally. */
export function fitDistance({ width, height, fov, aspect, margin, fill = 1 }: FrameInput): number {
  const halfV = (fov * Math.PI) / 360;
  const tanH = Math.tan(halfV) * Math.max(aspect, 1e-3);
  const tanV = Math.tan(halfV) * fill;
  const byHeight = (height * margin) / 2 / tanV;
  const byWidth = (width * margin) / 2 / tanH;
  return Math.max(byHeight, byWidth);
}

/** Applies the viewport zoom (percent) to a fitted distance. */
export function zoomedDistance(distance: number, zoomPercent: number): number {
  return distance / Math.max(zoomPercent / 100, 0.01);
}

/** Near/far planes that keep depth precision tight around the model. */
export function clippingPlanes(distance: number, radius: number): { near: number; far: number } {
  const near = Math.max(0.01, distance - radius * 4);
  return { near: Math.min(near, distance * 0.25), far: distance + radius * 8 };
}

/**
 * World-space amount to lower the camera target so the model is centred in
 * the part of the viewport above a bottom overlay of `insetPx` pixels.
 */
export function insetShift(distance: number, fov: number, viewportPx: number, insetPx: number): number {
  const visible = 2 * distance * Math.tan((fov * Math.PI) / 360);
  return (insetPx / 2) * (visible / Math.max(viewportPx, 1));
}
