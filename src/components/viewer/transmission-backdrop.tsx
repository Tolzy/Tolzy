"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { Color, Mesh, PlaneGeometry, ShaderMaterial, type WebGLRenderer } from "three";
import { hexToRgba } from "@/lib/color/color";
import type { Background } from "@/lib/studio/settings";

/** Layer the backdrop lives on, so helper cameras (contact shadows) never see it. */
export const BACKDROP_LAYER = 1;
/** What glass sees through a transparent viewport. */
const TRANSPARENT_FALLBACK = "#161618";

/**
 * The visible viewport background is CSS behind a transparent canvas, so
 * transmissive materials (Glass) would otherwise refract an empty, whitish
 * buffer. This full-screen quad re-draws the same background, but only into
 * three.js's transmission buffer: in the on-screen pass it writes nothing.
 * It mirrors the CSS gradient in lib/studio/settings.ts `backgroundToCss`.
 */
export function TransmissionBackdrop({ background, active }: { background: Background; active: boolean }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);

  const mesh = useMemo(() => {
    const material = new ShaderMaterial({
      uniforms: {
        from: { value: new Color() },
        to: { value: new Color() },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 1.0, 1.0);
        }`,
      // Interpolates in sRGB like CSS, then converts to linear for the buffer.
      fragmentShader: /* glsl */ `
        uniform vec3 from;
        uniform vec3 to;
        varying vec2 vUv;
        void main() {
          vec2 p = vec2((vUv.x - 0.5) / 1.2, ((1.0 - vUv.y) - 0.38) / 0.9);
          vec3 srgb = mix(from, to, clamp(length(p), 0.0, 1.0));
          gl_FragColor = vec4(pow(srgb, vec3(2.2)), 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const m = new Mesh(new PlaneGeometry(2, 2), material);
    m.name = "transmission-backdrop";
    m.frustumCulled = false;
    m.renderOrder = -1e6;
    m.layers.set(BACKDROP_LAYER);
    // Draw only into render targets (the transmission pass), never on screen.
    m.onBeforeRender = (renderer: WebGLRenderer) => {
      material.colorWrite = renderer.getRenderTarget() !== null;
    };
    return m;
  }, []);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as ShaderMaterial).dispose();
    },
    [mesh],
  );

  useLayoutEffect(() => {
    camera.layers.enable(BACKDROP_LAYER);
  }, [camera]);

  useLayoutEffect(() => {
    const [from, to] =
      background.type === "gradient"
        ? [background.from, background.to]
        : background.type === "solid"
          ? [background.color, background.color]
          : [TRANSPARENT_FALLBACK, TRANSPARENT_FALLBACK];
    const u = (mesh.material as ShaderMaterial).uniforms;
    // Keep raw sRGB values (the shader converts after interpolating). A
    // see-through colour is composited over the dark stage, as on screen.
    const over = (hex: string, target: Color) => {
      const c = hexToRgba(hex) ?? { r: 0, g: 0, b: 0, a: 1 };
      const base = hexToRgba(TRANSPARENT_FALLBACK)!;
      const mix = (v: number, b: number) => (v * c.a + b * (1 - c.a)) / 255;
      target.setRGB(mix(c.r, base.r), mix(c.g, base.g), mix(c.b, base.b), "srgb-linear");
    };
    over(from, u.from.value as Color);
    over(to, u.to.value as Color);
    invalidate();
  }, [background, mesh, invalidate]);

  // Only drawn while a transmissive material is on screen.
  return <primitive object={mesh} visible={active} />;
}
