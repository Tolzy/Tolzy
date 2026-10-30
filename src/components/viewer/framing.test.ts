import { describe, expect, it } from "vitest";
import { clippingPlanes, fitDistance, insetShift, zoomedDistance } from "./framing";

const base = { width: 0.7, height: 1, fov: 26, margin: 1.2 };

describe("fitDistance", () => {
  it("fits the height on wide viewports", () => {
    const d = fitDistance({ ...base, aspect: 16 / 9 });
    const halfHeightAtD = d * Math.tan((26 * Math.PI) / 360);
    expect(halfHeightAtD).toBeCloseTo(0.6, 5); // height * margin / 2
  });

  it("backs off on narrow viewports so the width still fits", () => {
    const wide = fitDistance({ ...base, aspect: 16 / 9 });
    const narrow = fitDistance({ ...base, aspect: 0.4 });
    expect(narrow).toBeGreaterThan(wide);
  });

  it("is monotonic in margin", () => {
    expect(fitDistance({ ...base, aspect: 1, margin: 1.4 })).toBeGreaterThan(fitDistance({ ...base, aspect: 1 }));
  });
});

describe("zoomedDistance", () => {
  it("moves closer when zooming in", () => {
    expect(zoomedDistance(4, 200)).toBe(2);
    expect(zoomedDistance(4, 50)).toBe(8);
  });
});

describe("clippingPlanes", () => {
  it("keeps the model between the near and far planes", () => {
    const { near, far } = clippingPlanes(3, 0.6);
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(3 - 0.6);
    expect(far).toBeGreaterThan(3 + 0.6);
  });
});

describe("bottom inset", () => {
  it("backs off when part of the viewport is covered", () => {
    expect(fitDistance({ ...base, aspect: 2, fill: 0.9 })).toBeGreaterThan(fitDistance({ ...base, aspect: 2 }));
  });

  it("shifts by half the inset in world units", () => {
    const d = 3;
    const visible = 2 * d * Math.tan((26 * Math.PI) / 360);
    expect(insetShift(d, 26, 800, 80)).toBeCloseTo((40 / 800) * visible, 6);
  });
});
