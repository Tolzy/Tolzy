import { Color } from "three";
import { hexToRgba } from "./color";

/**
 * The single conversion point from stored colours (sRGB hex, optional alpha)
 * to three.js values: a linear-space Color plus alpha.
 */
export function toThreeColor(hex: string, target = new Color()): { color: Color; alpha: number } {
  const c = hexToRgba(hex) ?? { r: 255, g: 255, b: 255, a: 1 };
  target.setRGB(c.r / 255, c.g / 255, c.b / 255, "srgb");
  return { color: target, alpha: c.a };
}
