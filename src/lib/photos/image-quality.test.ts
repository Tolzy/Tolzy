import { describe, expect, it } from "vitest";
import { laplacianVariance, lightStats, normalizeContrast, regionMean } from "./image-quality";

const N = 64;
function image(f: (x: number, y: number) => number) {
  const g = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) g[y * N + x] = f(x, y);
  return g;
}
const checker = image((x, y) => (((x >> 2) + (y >> 2)) % 2 ? 200 : 40));
function boxBlur(g: Float32Array, r: number) {
  return image((x, y) => {
    let s = 0;
    let n = 0;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const xx = Math.min(N - 1, Math.max(0, x + dx));
        const yy = Math.min(N - 1, Math.max(0, y + dy));
        s += g[yy * N + xx];
        n++;
      }
    return s / n;
  });
}

describe("focus measure", () => {
  it("drops sharply when an image is blurred", () => {
    const sharp = laplacianVariance(checker, N, N);
    const blurred = laplacianVariance(boxBlur(checker, 3), N, N);
    expect(sharp).toBeGreaterThan(blurred * 10);
  });

  it("is independent of exposure after contrast normalisation", () => {
    const dim = checker.map((v) => v * 0.15);
    const a = laplacianVariance(normalizeContrast(checker), N, N);
    const b = laplacianVariance(normalizeContrast(dim), N, N);
    expect(b / a).toBeGreaterThan(0.9);
    expect(b / a).toBeLessThan(1.1);
  });
});

describe("lightStats", () => {
  it("judges exposure by percentiles, not average skin brightness", () => {
    // A darker face with real highlights is well exposed…
    const deepTone = image((x, y) => ((x + y) % 17 === 0 ? 120 : 45));
    expect(lightStats(deepTone, N, N).p95).toBeGreaterThan(70);
    // …an underexposed one has no highlights at all.
    const under = image(() => 12);
    expect(lightStats(under, N, N).p95).toBeLessThan(70);
  });

  it("measures left/right imbalance", () => {
    const sided = image((x) => (x < N / 2 ? 30 : 180));
    expect(lightStats(sided, N, N).sideRatio).toBeCloseTo(6, 0);
    expect(
      lightStats(
        image(() => 100),
        N,
        N,
      ).sideRatio,
    ).toBeCloseTo(1);
  });

  it("averages regions", () => {
    expect(
      regionMean(
        image((x) => x),
        N,
        N,
        0,
        0,
        4,
        N,
      ),
    ).toBeCloseTo(1.5);
  });
});
