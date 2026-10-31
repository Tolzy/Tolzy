"use client";

import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { BackSide, BufferAttribute, Color, SphereGeometry } from "three";
import { toThreeColor } from "@/lib/color/three";
import { LIGHTING_RIGS, type LightingPreset } from "@/lib/studio/lighting";
import { MODEL_HEIGHT } from "./framing";

interface StudioLightingProps {
  preset: LightingPreset;
  /** Multiplier for the direct lights (1 = default). */
  intensity: number;
  /** Rotation of the whole light rig around the model, in degrees. */
  rotation: number;
  /** Tint multiplied into the direct lights (sRGB hex, white = rig colours). */
  color: string;
  /** Multiplier for hemisphere fill and environment light (1 = default). */
  ambient: number;
  /** 0–1 strength of the shadow cast by the model onto itself. */
  shadowIntensity: number;
}

/**
 * Renders a lighting rig (see lib/studio/lighting.ts): direct lights, a
 * hemisphere fill and a procedural environment — gradient studio walls plus
 * light panels — used for lighting and reflections only. The visible viewport
 * background is independent (Scene panel).
 */
export function StudioLighting({ preset, intensity, rotation, color, ambient, shadowIntensity }: StudioLightingProps) {
  const rig = LIGHTING_RIGS[preset];
  const yaw = (rotation * Math.PI) / 180;
  // Rig colours × user tint, computed once per change (not per frame).
  const colors = useMemo(() => {
    const tint = toThreeColor(color).color;
    return rig.lights.map((l) => new Color(l.color).multiply(tint));
  }, [rig, color]);

  return (
    <>
      <group rotation={[0, yaw, 0]} name={`rig:${rig.id}`}>
        {rig.lights.map((l, i) => (
          <directionalLight
            key={`${rig.id}-${i}`}
            position={l.position}
            color={colors[i]}
            intensity={l.intensity * intensity}
            castShadow={!!l.castShadow}
            shadow-intensity={shadowIntensity}
            shadow-mapSize={[1024, 1024]}
            shadow-radius={rig.shadowRadius}
            shadow-bias={-0.0004}
            shadow-normalBias={0.02}
            shadow-camera-left={-0.9}
            shadow-camera-right={0.9}
            shadow-camera-top={0.9}
            shadow-camera-bottom={-0.9}
            shadow-camera-near={0.5}
            shadow-camera-far={10}
          />
        ))}
      </group>
      <hemisphereLight
        color={rig.hemisphere.sky}
        groundColor={rig.hemisphere.ground}
        intensity={rig.hemisphere.intensity * ambient}
      />

      {/*
       * One environment for the viewer's lifetime: it re-renders (frames=1)
       * whenever the rig changes. Remounting it per preset would leak, because
       * three.js never frees the reflection map derived from a render target.
       */}
      <Environment
        resolution={256}
        frames={1}
        environmentIntensity={rig.environment.intensity * ambient}
        environmentRotation={[0, yaw, 0]}
      >
        <GradientWalls top={rig.environment.walls[0]} bottom={rig.environment.walls[1]} />
        {rig.environment.panels.map((p, i) => (
          <Lightformer
            key={i}
            form={p.form}
            color={p.color}
            intensity={p.intensity}
            position={p.position}
            scale={[p.scale[0], p.scale[1], 1]}
            {...(p.rotation ? { rotation: p.rotation } : { target: [0, 0, 0] as [number, number, number] })}
          />
        ))}
      </Environment>
    </>
  );
}

/** Large inverted sphere with a vertical gradient: the "room" metals reflect. */
function GradientWalls({ top, bottom }: { top: string; bottom: string }) {
  const geometry = useMemo(() => {
    const g = new SphereGeometry(20, 32, 16);
    const pos = g.getAttribute("position");
    const colors = new Float32Array(pos.count * 3);
    const a = new Color(bottom);
    const b = new Color(top);
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const t = Math.min(1, Math.max(0, (pos.getY(i) / 20 + 0.35) / 1.1));
      c.copy(a).lerp(b, t * t * (3 - 2 * t));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new BufferAttribute(colors, 3));
    return g;
  }, [top, bottom]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial vertexColors side={BackSide} toneMapped={false} />
    </mesh>
  );
}

/**
 * Soft contact shadow under the bust. Rendered once (frames=1), so it must
 * mount after the model is in place.
 */
export function StudioShadow({ floorY, opacity = 1 }: { floorY: number; opacity?: number }) {
  return (
    <ContactShadows
      position={[0, floorY - 0.002, 0]}
      scale={MODEL_HEIGHT * 1.6}
      far={MODEL_HEIGHT * 0.5}
      blur={2.6}
      opacity={0.55 * opacity}
      resolution={512}
      frames={1}
      color="#000000"
    />
  );
}
