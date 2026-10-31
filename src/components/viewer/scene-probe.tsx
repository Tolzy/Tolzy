"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import { Vector3, type DirectionalLight, type HemisphereLight, type Object3D } from "three";

const world = new Vector3();

/**
 * Mirrors live renderer state onto the viewer element as data attributes:
 * the active lights (read from the scene graph), the environment map and the
 * GPU resource counts. Used by browser tests to verify the real Three.js
 * scene, and handy when debugging. Writes only when something changes.
 */
export function SceneProbe({ target }: { target: RefObject<HTMLElement | null> }) {
  const last = useRef("");
  useFrame(({ gl, scene }) => {
    const el = target.current;
    if (!el) return;
    const lights: string[] = [];
    const colors: string[] = [];
    let rig = "";
    let ambient = 0;
    let shadow = 0;
    scene.traverse((o: Object3D) => {
      if (o.name.startsWith("rig:")) rig = o.name.slice(4);
      const l = o as DirectionalLight;
      if (l.isDirectionalLight) {
        const p = l.getWorldPosition(world); // includes the rig rotation
        lights.push(
          `${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}@${l.intensity.toFixed(2)}${l.castShadow ? "s" : ""}`,
        );
        colors.push(`#${l.color.getHexString()}`);
        if (l.castShadow) shadow = l.shadow.intensity;
      }
      const h = o as HemisphereLight;
      if (h.isHemisphereLight) ambient = h.intensity;
    });
    const { memory, programs } = gl.info;
    // The environment re-renders in place: its PMREM version counts the updates.
    const env = scene.environment ? `${scene.environment.uuid.slice(0, 8)}:${scene.environment.pmremVersion}` : "none";
    const envIntensity = scene.environmentIntensity.toFixed(3);
    const key = `${rig}|${lights.join(";")}|${colors.join(";")}|${ambient}|${shadow}|${envIntensity}|${env}|${memory.geometries}|${memory.textures}|${programs?.length ?? 0}`;
    if (key === last.current) return;
    last.current = key;
    writeData(el, {
      lightRig: rig,
      lights: lights.join(";"),
      lightColors: colors.join(";"),
      ambient: ambient.toFixed(3),
      environmentIntensity: envIntensity,
      shadowIntensity: shadow.toFixed(3),
      environment: env,
      gpuGeometries: String(memory.geometries),
      gpuTextures: String(memory.textures),
      gpuPrograms: String(programs?.length ?? 0),
    });
  });
  return null;
}

function writeData(el: HTMLElement, data: Record<string, string>) {
  Object.assign(el.dataset, data);
}
