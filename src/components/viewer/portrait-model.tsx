"use client";

import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Box3, Group, Material, Mesh, Object3D, Texture, Vector3 } from "three";
import type { ModelFraming } from "@/lib/studio/sample-model";
import type { PortraitSettings } from "@/lib/studio/settings";
import { MaterialSystem, type MaterialSummary } from "./material-system";
import { MODEL_HEIGHT } from "./framing";

let cachedUrl: string | null = null;

export interface ModelBounds {
  width: number;
  height: number;
  depth: number;
}

interface PortraitModelProps {
  url: string;
  framing: ModelFraming;
  /** Material preset and adjustments to apply (see lib/studio/materials.ts). */
  material: PortraitSettings["material"];
  /** Reports the normalised size once the model is placed. */
  onReady?: (bounds: ModelBounds) => void;
  /** Reports what is actually on the model after every material change. */
  onMaterials?: (summary: MaterialSummary) => void;
}

/**
 * Loads a GLB and normalises it: applies the orientation fix, scales it to
 * MODEL_HEIGHT and moves the pivot (a fraction of its height) to the origin.
 *
 * Material presets are applied by a MaterialSystem, which keeps the original
 * materials in `userData.originalMaterial` and never modifies geometry.
 */
export function PortraitModel({ url, framing, material, onReady, onMaterials }: PortraitModelProps) {
  // No Draco/meshopt: avoids loading decoders from third-party CDNs.
  const gltf = useGLTF(url, false, false);
  const invalidate = useThree((s) => s.invalidate);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const normalizer = useRef<Group>(null);

  useLayoutEffect(() => {
    scene.rotation.set(...framing.orientation);
    scene.position.set(0, 0, 0);
    scene.scale.setScalar(1);
    scene.updateMatrixWorld(true);

    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    const scale = MODEL_HEIGHT / Math.max(size.y, 1e-6);
    const center = box.getCenter(new Vector3());

    scene.scale.setScalar(scale);
    scene.position.set(-center.x * scale, -(box.min.y + size.y * framing.pivot) * scale, -center.z * scale);

    scene.traverse((obj) => {
      if ((obj as Mesh).isMesh && !obj.userData.helper) {
        const mesh = obj as Mesh;
        mesh.userData.originalMaterial ??= mesh.material;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    onReady?.({ width: size.x * scale, height: MODEL_HEIGHT, depth: size.z * scale });
    invalidate();
  }, [scene, framing, onReady, invalidate]);

  // One material system per loaded model; presets are applied in place.
  const materials = useMemo(() => new MaterialSystem(scene), [scene]);
  useEffect(() => () => materials.dispose(), [materials]);

  const { preset, tint, roughness, metalness, clearcoat, thickness, opacity } = material;
  useLayoutEffect(() => {
    const summary = materials.apply(preset, { tint, roughness, metalness, clearcoat, thickness, opacity });
    onMaterials?.(summary);
    invalidate();
  }, [materials, preset, tint, roughness, metalness, clearcoat, thickness, opacity, onMaterials, invalidate]);

  // Keep only the current model in the loader cache.
  useEffect(() => {
    if (cachedUrl && cachedUrl !== url) useGLTF.clear(cachedUrl);
    cachedUrl = url;
  }, [url]);

  // Free GPU memory when the model leaves the studio. The clone shares
  // geometry, materials and textures with the cached original; three.js
  // re-uploads them if the same model is shown again.
  useEffect(() => () => disposeObject(gltf.scene), [gltf.scene]);

  return (
    <group ref={normalizer} name="normalizer">
      <primitive object={scene} />
    </group>
  );
}

/** Disposes geometry, materials and textures under an object. */
export function disposeObject(root: Object3D) {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    for (const m of ([] as Material[]).concat(mesh.material)) {
      for (const value of Object.values(m)) if (value instanceof Texture) value.dispose();
      m.dispose();
    }
  });
}
