"use client";

import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { MODEL_HEIGHT } from "./framing";

interface StudioLightingProps {
  /** Overall multiplier from the Light panel (1 = default). */
  intensity: number;
  /** Rotation of the whole light rig around the model, in degrees. */
  rotation: number;
}

/**
 * Default studio light rig: a procedural environment built from softboxes
 * (no external HDR files), a warm key light, a cool rim and a soft fill.
 * Lighting presets (Milestone 4) will swap these parameters.
 */
export function StudioLighting({ intensity, rotation }: StudioLightingProps) {
  const yaw = (rotation * Math.PI) / 180;

  return (
    <>
      <group rotation={[0, yaw, 0]}>
        {/* Key: upper left, slightly warm */}
        <directionalLight position={[-2.2, 2.4, 2.6]} intensity={2.1 * intensity} color="#fff3e6" />
        {/* Rim: behind right, cool — separates the head from a dark background */}
        <directionalLight position={[2.6, 1.6, -2.4]} intensity={2.4 * intensity} color="#dfe8ff" />
        {/* Kicker: low left behind for the jaw and neck line */}
        <directionalLight position={[-2.4, -0.4, -1.8]} intensity={0.7 * intensity} color="#f0f0ff" />
      </group>
      <hemisphereLight args={["#e9eef6", "#2a2622", 0.35 * intensity]} />

      <Environment
        resolution={256}
        frames={1}
        environmentIntensity={0.85 * intensity}
        environmentRotation={[0, yaw, 0]}
      >
        {/* Large overhead softbox */}
        <Lightformer
          form="rect"
          intensity={2.2}
          color="#ffffff"
          position={[0, 4, 1]}
          rotation-x={Math.PI / 2}
          scale={[6, 3, 1]}
        />
        {/* Key softbox front left */}
        <Lightformer
          form="rect"
          intensity={3}
          color="#fff4ea"
          position={[-3, 1.2, 3]}
          scale={[2.4, 3.2, 1]}
          target={[0, 0, 0]}
        />
        {/* Fill card front right */}
        <Lightformer
          form="rect"
          intensity={0.9}
          color="#eef2ff"
          position={[3.2, 0.4, 2.4]}
          scale={[2, 3, 1]}
          target={[0, 0, 0]}
        />
        {/* Strip rims behind */}
        <Lightformer
          form="rect"
          intensity={4}
          color="#e6eeff"
          position={[2.6, 1, -3]}
          scale={[0.6, 4, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={2.2}
          color="#fff1e6"
          position={[-2.8, 1, -3]}
          scale={[0.6, 4, 1]}
          target={[0, 0, 0]}
        />
        {/* Dark floor bounce */}
        <Lightformer
          form="rect"
          intensity={0.25}
          color="#8a7f76"
          position={[0, -3, 0]}
          rotation-x={-Math.PI / 2}
          scale={[8, 8, 1]}
        />
      </Environment>
    </>
  );
}

/**
 * Soft contact shadow under the bust. Rendered once (frames=1), so it must
 * mount after the model is in place.
 */
export function StudioShadow({ floorY }: { floorY: number }) {
  return (
    <ContactShadows
      position={[0, floorY - 0.002, 0]}
      scale={MODEL_HEIGHT * 1.6}
      far={MODEL_HEIGHT * 0.5}
      blur={2.6}
      opacity={0.55}
      resolution={512}
      frames={1}
      color="#000000"
    />
  );
}
