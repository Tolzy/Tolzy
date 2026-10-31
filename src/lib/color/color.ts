/**
 * Colour model shared by the colour picker and the renderer.
 *
 * Stored values are sRGB hex strings: "#rrggbb", or "#rrggbbaa" when alpha < 1
 * (ADR 0006 §4). RGB, HSL and HSB are views computed from that value. All
 * channels here are in their usual ranges: r/g/b 0–255, h 0–360, s/l/v 0–100,
 * alpha 0–1.
 */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}
export interface Hsva {
  h: number;
  s: number;
  v: number;
  a: number;
}
export interface Hsla {
  h: number;
  s: number;
  l: number;
  a: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round = (v: number, step = 1) => Math.round(v / step) * step;
const hex2 = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Parses 3/4/6/8-digit hex (with or without "#"). */
export function hexToRgba(hex: string): Rgba | null {
  const m = HEX_RE.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length <= 4) h = [...h].map((c) => c + c).join("");
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
}

/** Canonical stored form: lower-case "#rrggbb", or "#rrggbbaa" when alpha < 1. */
export function rgbaToHex({ r, g, b, a }: Rgba): string {
  const base = `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  const alpha = clamp(a, 0, 1);
  return alpha >= 1 - 1 / 510 ? base : base + hex2(alpha * 255);
}

/** "#rrggbb" without alpha (for inputs and three.js). */
export function opaqueHex(hex: string): string {
  const c = hexToRgba(hex);
  return c ? rgbaToHex({ ...c, a: 1 }) : "#000000";
}

export function alphaOf(hex: string): number {
  return hexToRgba(hex)?.a ?? 1;
}

export function withAlpha(hex: string, a: number): string {
  const c = hexToRgba(hex);
  return c ? rgbaToHex({ ...c, a }) : hex;
}

export function rgbaToHsva({ r, g, b, a }: Rgba): Hsva {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const d = max - Math.min(rr, gg, bb);
  let h = 0;
  if (d) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? (d / max) * 100 : 0, v: max * 100, a };
}

export function hsvaToRgba({ h, s, v, a }: Hsva): Rgba {
  const ss = clamp(s, 0, 100) / 100;
  const vv = clamp(v, 0, 100) / 100;
  const hh = (((h % 360) + 360) % 360) / 60;
  const f = (n: number) => {
    const k = (n + hh) % 6;
    return vv - vv * ss * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return { r: f(5) * 255, g: f(3) * 255, b: f(1) * 255, a: clamp(a, 0, 1) };
}

export function hsvaToHsla({ h, s, v, a }: Hsva): Hsla {
  const ss = s / 100;
  const vv = v / 100;
  const l = vv * (1 - ss / 2);
  const sl = l === 0 || l === 1 ? 0 : (vv - l) / Math.min(l, 1 - l);
  return { h, s: sl * 100, l: l * 100, a };
}

export function hslaToHsva({ h, s, l, a }: Hsla): Hsva {
  const ss = clamp(s, 0, 100) / 100;
  const ll = clamp(l, 0, 100) / 100;
  const v = ll + ss * Math.min(ll, 1 - ll);
  return { h, s: v === 0 ? 0 : 2 * (1 - ll / v) * 100, v: v * 100, a };
}

export const hexToHsva = (hex: string): Hsva | null => {
  const c = hexToRgba(hex);
  return c ? rgbaToHsva(c) : null;
};
export const hsvaToHex = (c: Hsva) => rgbaToHex(hsvaToRgba(c));

/* ───────────────────────── Formatting ───────────────────────── */

export type ColorFormat = "hex" | "rgb" | "hsl" | "hsb";

const pctA = (a: number) => `${round(a * 100)}%`;

/** CSS-style text for copying, in the given format. */
export function formatColor(hex: string, format: ColorFormat): string {
  const c = hexToRgba(hex);
  if (!c) return hex;
  const hasA = c.a < 1;
  switch (format) {
    case "hex":
      return rgbaToHex(c).toUpperCase();
    case "rgb":
      return `rgb(${round(c.r)} ${round(c.g)} ${round(c.b)}${hasA ? ` / ${pctA(c.a)}` : ""})`;
    case "hsl": {
      const h = hsvaToHsla(rgbaToHsva(c));
      return `hsl(${round(h.h)} ${round(h.s)}% ${round(h.l)}%${hasA ? ` / ${pctA(c.a)}` : ""})`;
    }
    case "hsb": {
      const h = rgbaToHsva(c);
      return `hsb(${round(h.h)} ${round(h.s)}% ${round(h.v)}%${hasA ? ` / ${pctA(c.a)}` : ""})`;
    }
  }
}

/* ───────────────────────── Parsing (paste) ───────────────────────── */

const NAMED: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  lime: "#00ff00",
  blue: "#0000ff",
  yellow: "#ffff00",
  cyan: "#00ffff",
  aqua: "#00ffff",
  magenta: "#ff00ff",
  fuchsia: "#ff00ff",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  maroon: "#800000",
  olive: "#808000",
  navy: "#000080",
  purple: "#800080",
  teal: "#008080",
  orange: "#ffa500",
  pink: "#ffc0cb",
  gold: "#ffd700",
  transparent: "#00000000",
};

/** A number token: "50%", "0.5", "120deg". */
function num(token: string, scale: number): number | null {
  const t = token.trim().toLowerCase().replace(/deg$/, "");
  if (!t) return null;
  const pct = t.endsWith("%");
  const v = Number(pct ? t.slice(0, -1) : t);
  if (!Number.isFinite(v)) return null;
  return pct ? (v / 100) * scale : v;
}

/**
 * Parses pasted colour text: hex (3/4/6/8 digits, "#" optional), rgb()/rgba(),
 * hsl()/hsla(), hsb()/hsv(), comma or space separated, optional "/ alpha",
 * and common CSS colour names. Returns the canonical hex, or null.
 */
export function parseColor(input: string): string | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;
  if (NAMED[text]) return NAMED[text];
  const hex = hexToRgba(text);
  if (hex) return rgbaToHex(hex);

  const m = /^(rgba?|hsla?|hsva?|hsba?)\s*\(([^)]*)\)$/.exec(text);
  if (!m) return null;
  const fn = m[1].replace(/a$/, "") as "rgb" | "hsl" | "hsv" | "hsb";
  const parts = m[2]
    .replace(/\//g, " ")
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  const alpha = parts[3] !== undefined ? num(parts[3], 1) : 1;
  if (alpha === null) return null;

  if (fn === "rgb") {
    const [r, g, b] = parts.slice(0, 3).map((p) => num(p, 255));
    if (r === null || g === null || b === null) return null;
    return rgbaToHex({ r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), a: clamp(alpha, 0, 1) });
  }
  const h = num(parts[0], 360);
  const s = num(parts[1], 100);
  const third = num(parts[2], 100);
  if (h === null || s === null || third === null) return null;
  // Bare numbers for s/l/v are percentages (hsl(0 50 50) ≡ hsl(0 50% 50%)).
  const hsva =
    fn === "hsl"
      ? hslaToHsva({ h, s, l: third, a: alpha })
      : { h, s: clamp(s, 0, 100), v: clamp(third, 0, 100), a: alpha };
  return hsvaToHex(hsva);
}
