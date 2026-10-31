import { describe, expect, it } from "vitest";
import {
  formatColor,
  hexToHsva,
  hexToRgba,
  hslaToHsva,
  hsvaToHex,
  hsvaToHsla,
  parseColor,
  rgbaToHex,
  withAlpha,
  type ColorFormat,
} from "./color";
import { toThreeColor } from "./three";

describe("hex", () => {
  it("parses 3/4/6/8 digits with or without #", () => {
    expect(hexToRgba("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(hexToRgba("0f08")).toEqual({ r: 0, g: 255, b: 0, a: 136 / 255 });
    expect(hexToRgba("#1F1F23")).toEqual({ r: 31, g: 31, b: 35, a: 1 });
    expect(hexToRgba("#ff000080")?.a).toBeCloseTo(0.502, 3);
    expect(hexToRgba("#12345")).toBeNull();
    expect(hexToRgba("nope")).toBeNull();
  });

  it("stores alpha only when it is below 1", () => {
    expect(rgbaToHex({ r: 31, g: 31, b: 35, a: 1 })).toBe("#1f1f23");
    expect(rgbaToHex({ r: 255, g: 0, b: 0, a: 0.5 })).toBe("#ff000080");
    expect(withAlpha("#ff0000", 0)).toBe("#ff000000");
    expect(withAlpha("#ff000080", 1)).toBe("#ff0000");
  });
});

describe("conversions", () => {
  it("round-trips every format without drift across the colour cube", () => {
    const formats: ColorFormat[] = ["hex", "rgb", "hsl", "hsb"];
    for (let r = 0; r <= 255; r += 51)
      for (let g = 0; g <= 255; g += 51)
        for (let b = 0; b <= 255; b += 51) {
          const hex = rgbaToHex({ r, g, b, a: 1 });
          expect(hsvaToHex(hexToHsva(hex)!)).toBe(hex);
          expect(hsvaToHex(hslaToHsva(hsvaToHsla(hexToHsva(hex)!)))).toBe(hex);
          for (const f of formats) {
            const back = hexToRgba(parseColor(formatColor(hex, f))!)!;
            const want = hexToRgba(hex)!;
            // HEX and RGB text are exact; whole-number HSL/HSB can be one 8-bit step off.
            const tolerance = f === "hex" || f === "rgb" ? 0 : 1;
            for (const k of ["r", "g", "b"] as const)
              expect(Math.abs(back[k] - want[k]), `${hex} via ${f}`).toBeLessThanOrEqual(tolerance);
          }
        }
  });

  it("keeps alpha through every format", () => {
    for (const f of ["hex", "rgb", "hsl", "hsb"] as const) {
      expect(hexToRgba(parseColor(formatColor("#3366cc80", f))!)!.a).toBeCloseTo(128 / 255, 2);
    }
  });

  it("matches known values", () => {
    expect(hexToHsva("#ff0000")).toMatchObject({ h: 0, s: 100, v: 100 });
    expect(hsvaToHsla({ h: 120, s: 100, v: 100, a: 1 })).toMatchObject({ h: 120, s: 100, l: 50 });
    expect(formatColor("#1f1f23", "rgb")).toBe("rgb(31 31 35)");
    expect(formatColor("#ff000080", "hsl")).toBe("hsl(0 100% 50% / 50%)");
    expect(formatColor("#00ff00", "hsb")).toBe("hsb(120 100% 100%)");
    expect(formatColor("#abcdef", "hex")).toBe("#ABCDEF");
  });
});

describe("parseColor (paste)", () => {
  it.each([
    ["#ABC", "#aabbcc"],
    ["abcdef", "#abcdef"],
    ["rgb(255, 0, 0)", "#ff0000"],
    ["rgba(255,0,0,0.5)", "#ff000080"],
    ["rgb(255 0 0 / 50%)", "#ff000080"],
    ["rgb(100% 0% 0%)", "#ff0000"],
    ["hsl(120, 100%, 50%)", "#00ff00"],
    ["hsla(240 100% 50% / 0.25)", "#0000ff40"],
    ["hsb(0, 0%, 100%)", "#ffffff"],
    ["hsv(60deg 100% 100%)", "#ffff00"],
    ["  Gold ", "#ffd700"],
  ])("%s → %s", (input, hex) => expect(parseColor(input)).toBe(hex));

  it.each(["", "rgb(1,2)", "hsl(a b c)", "#12", "colour", "rgb(1 2 3 4 5)"])("rejects %s", (input) =>
    expect(parseColor(input)).toBeNull(),
  );
});

describe("three.js boundary", () => {
  it("converts sRGB hex to a linear colour plus alpha", () => {
    const { color, alpha } = toThreeColor("#80808080");
    expect(color.r).toBeCloseTo(0.2159, 3); // sRGB 128 → linear
    expect(alpha).toBeCloseTo(0.502, 3);
  });
});
