"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { AdditiveBlending, Color, LessEqualDepth, Mesh, ShaderMaterial } from "three";
import { lineage, type RegionId } from "@/lib/segmentation/regions";

/** Rest strength of the rim and its brief peak when a region is selected. */
const REST = 0.22;
const PEAK = 0.6;
const PULSE_MS = 650;

/** Owns the overlay material and meshes (imperative three.js state). */
class Highlighter {
  readonly material = new ShaderMaterial({
    uniforms: { color: { value: new Color("#8fa4ff") }, strength: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float strength;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float rim = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 2.2);
        gl_FragColor = vec4(color * (0.18 + rim) * strength, 1.0);
      }`,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    depthFunc: LessEqualDepth,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  private overlays: Mesh[] = [];
  private started = 0;
  private pulsing = false;

  /** Overlays share each part's geometry — nothing is copied. */
  show(parts: Mesh[], selected: RegionId, pulse: boolean) {
    this.clear();
    for (const p of parts) {
      if (p.userData.cap || !lineage(p.userData.region as RegionId).includes(selected)) continue;
      const o = new Mesh(p.geometry, this.material);
      o.userData.helper = true;
      o.renderOrder = 10;
      o.raycast = () => {};
      p.add(o);
      this.overlays.push(o);
    }
    this.started = performance.now();
    this.pulsing = pulse;
    this.material.uniforms.strength.value = pulse ? PEAK : REST;
  }

  clear() {
    for (const o of this.overlays) o.removeFromParent();
    this.overlays = [];
    this.pulsing = false;
  }

  /** Advances the pulse; returns true while another frame is needed. */
  tick(): boolean {
    if (!this.pulsing) return false;
    const t = (performance.now() - this.started) / PULSE_MS;
    if (t >= 1) {
      this.material.uniforms.strength.value = REST;
      this.pulsing = false;
      return true;
    }
    this.material.uniforms.strength.value = REST + (PEAK - REST) * Math.cos((t * Math.PI) / 2);
    return true;
  }

  dispose() {
    this.clear();
    this.material.dispose();
  }
}

/**
 * Subtle selection feedback: a soft fresnel rim drawn over the selected
 * region (additive, no outline, materials untouched). It pulses once when
 * selected, then rests faintly. Reduced motion: no pulse.
 */
export function SelectionHighlight({
  parts,
  selected,
  reducedMotion,
}: {
  parts: Mesh[] | null;
  selected: RegionId | null;
  reducedMotion: boolean;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const [highlighter] = useState(() => new Highlighter());
  useEffect(() => () => highlighter.dispose(), [highlighter]);

  useEffect(() => {
    if (parts && selected) highlighter.show(parts, selected, !reducedMotion);
    else highlighter.clear();
    invalidate();
    return () => highlighter.clear();
  }, [highlighter, parts, selected, reducedMotion, invalidate]);

  useFrame(() => {
    if (highlighter.tick()) invalidate();
  });
  return null;
}
