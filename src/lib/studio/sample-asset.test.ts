import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SAMPLE_MODEL } from "./sample-model";

/*
 * Guards the shipped sample head against geometry regressions such as the
 * "black wedge" (a tilted bust cap that became visible when the head turned).
 */

type Vec3 = [number, number, number];

function readGlb(path: string) {
  const buf = readFileSync(path);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
  const bin = buf.subarray(20 + jsonLen + 8);
  const accessor = (i: number) => {
    const a = json.accessors[i];
    const v = json.bufferViews[a.bufferView];
    const size = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type as "SCALAR" | "VEC2" | "VEC3"];
    const start = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const out: number[] = [];
    for (let k = 0; k < a.count * size; k++) {
      if (a.componentType === 5126) out.push(bin.readFloatLE(start + k * 4));
      else if (a.componentType === 5123) out.push(bin.readUInt16LE(start + k * 2));
      else out.push(bin.readUInt32LE(start + k * 4));
    }
    return out;
  };
  const mesh = (name: string) => {
    const m = json.meshes.find((x: { name: string }) => x.name === name);
    const p = m.primitives[0];
    const pos = accessor(p.attributes.POSITION);
    const P: Vec3[] = [];
    for (let i = 0; i < pos.length; i += 3) P.push([pos[i], pos[i + 1], pos[i + 2]]);
    return { P, I: accessor(p.indices), material: json.materials[p.material] };
  };
  return { mesh };
}

const glb = readGlb(join(process.cwd(), "public", SAMPLE_MODEL.url));
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

describe("sample head asset", () => {
  it("has a flat bust base facing straight down", () => {
    const { P, I } = glb.mesh("Base");
    const ys = P.map((p) => p[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(1e-4); // planar, horizontal
    for (let t = 0; t < I.length; t += 3) {
      const n = cross(sub(P[I[t + 1]], P[I[t]]), sub(P[I[t + 2]], P[I[t]]));
      expect(n[1]).toBeLessThan(0); // every face points down, away from the bust
    }
  });

  it("is closed everywhere except where the base cap seals it", () => {
    const { P, I } = glb.mesh("Skin");
    const key = (i: number) => P[i].map((v) => v.toFixed(5)).join(",");
    const edges = new Map<string, number>();
    for (let t = 0; t < I.length; t += 3) {
      const tri = [I[t], I[t + 1], I[t + 2]].map(key);
      for (let k = 0; k < 3; k++) {
        const e = [tri[k], tri[(k + 1) % 3]].sort().join("|");
        edges.set(e, (edges.get(e) ?? 0) + 1);
      }
    }
    const openYs = [...edges]
      .filter(([, n]) => n === 1)
      .flatMap(([e]) => e.split("|").map((v) => Number(v.split(",")[1])));
    expect(openYs.length).toBeGreaterThan(0);
    expect(Math.max(...openYs)).toBeLessThan(1e-4); // only the base outline (y = 0) is open
  });

  it("does not render the base as a black void", () => {
    const base = glb.mesh("Base").material.pbrMetallicRoughness.baseColorFactor as number[];
    expect(Math.max(...base.slice(0, 3))).toBeGreaterThan(0.1);
  });
});
