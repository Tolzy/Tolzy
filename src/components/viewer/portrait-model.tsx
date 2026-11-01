"use client";

import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box3, Group, Material, Mesh, Object3D, Texture, Vector3 } from "three";
import type { ModelFraming } from "@/lib/studio/sample-model";
import type { PortraitSettings } from "@/lib/studio/settings";
import type { RegionId } from "@/lib/segmentation/regions";
import type { RegionReport } from "@/lib/segmentation/segment";
import { GeometrySystem } from "./geometry-system";
import { MaterialSystem, type MaterialSummary } from "./material-system";
import { MODEL_HEIGHT } from "./framing";

let cachedUrl: string | null = null;

export interface ModelBounds {
  width: number;
  height: number;
  depth: number;
  /** Visible extent in model space (y up, pivot at 0). Narrower than the model when parts are hidden. */
  minY: number;
  maxY: number;
}

export interface GeometryReport {
  segmented: boolean;
  reason: string | null;
  regions: RegionReport[];
  hidden: RegionId[];
  visibleTriangles: number;
}

interface PortraitModelProps {
  url: string;
  framing: ModelFraming;
  /** Material preset and adjustments to apply (see lib/studio/materials.ts). */
  material: PortraitSettings["material"];
  /** Reports the normalised size once the model is placed. */
  onReady?: (bounds: ModelBounds) => void;
  /** Reports what is actually on the model after every material change. */
  onMaterials?: (summary: MaterialSummary, regions: ReturnType<MaterialSystem["regionSummary"]>) => void;
  /** Which parts are shown (Milestone 7). */
  geometry: PortraitSettings["geometry"];
  /** Per-region material overrides (Milestone 7). */
  regionMaterials: PortraitSettings["regionMaterials"];
  /** Reports segmentation and visibility after every change. */
  onGeometry?: (report: GeometryReport) => void;
  /** Gives the viewer the part meshes (for picking and highlighting). */
  onParts?: (parts: Mesh[] | null) => void;
}

/**
 * Loads a GLB and normalises it: applies the orientation fix, scales it to
 * MODEL_HEIGHT and moves the pivot (a fraction of its height) to the origin.
 *
 * Material presets are applied by a MaterialSystem, which keeps the original
 * materials in `userData.originalMaterial` and never modifies geometry.
 */
export function PortraitModel({
  url,
  framing,
  material,
  geometry,
  regionMaterials,
  onReady,
  onMaterials,
  onGeometry,
  onParts,
}: PortraitModelProps) {
  // No Draco/meshopt: avoids loading decoders from third-party CDNs.
  const gltf = useGLTF(url, false, false);
  const invalidate = useThree((s) => s.invalidate);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const normalizer = useRef<Group>(null);
  const full = useRef<Pick<ModelBounds, "width" | "height" | "depth">>({ width: 1, height: MODEL_HEIGHT, depth: 1 });
  const [systems, setSystems] = useState<{ geometry: GeometrySystem; materials: MaterialSystem } | null>(null);

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

    full.current = { width: size.x * scale, height: MODEL_HEIGHT, depth: size.z * scale };
    // Split into regions, then put materials on the resulting parts.
    const geometrySystem = new GeometrySystem(scene);
    const materialSystem = new MaterialSystem(scene);
    // Systems wrap the loaded three.js scene (an external, mutable object), so
    // they are created after normalisation here and published via state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSystems({ geometry: geometrySystem, materials: materialSystem });
    onParts?.(geometrySystem.segmentation.ok ? geometrySystem.partMeshes() : null);
    invalidate();
    return () => {
      materialSystem.dispose();
      geometrySystem.dispose();
      onParts?.(null);
    };
  }, [scene, framing, invalidate, onParts]);

  // Visibility of parts; framing follows what is visible.
  const hiddenKey = geometry.hidden.join(",");
  useLayoutEffect(() => {
    if (!systems) return;
    const g = systems.geometry;
    const hidden = g.show(geometry.preset, hiddenKey ? (hiddenKey.split(",") as RegionId[]) : []);
    const box = g.visibleBounds();
    const pivotY = -framing.pivot * MODEL_HEIGHT;
    onReady?.({
      ...full.current,
      width: box ? box.max.x - box.min.x : full.current.width,
      height: box ? box.max.y - box.min.y : full.current.height,
      minY: box ? box.min.y : pivotY,
      maxY: box ? box.max.y : pivotY + MODEL_HEIGHT,
    });
    onGeometry?.({
      segmented: g.segmentation.ok,
      reason: g.segmentation.reason ?? null,
      regions: g.regions(),
      hidden: [...hidden],
      visibleTriangles: g.visibleTriangles(),
    });
    invalidate();
  }, [systems, geometry.preset, hiddenKey, framing.pivot, onReady, onGeometry, invalidate]);

  const { preset, tint, roughness, metalness, clearcoat, thickness, opacity } = material;
  const overridesKey = JSON.stringify(regionMaterials);
  useLayoutEffect(() => {
    if (!systems) return;
    const overrides = JSON.parse(overridesKey) as PortraitSettings["regionMaterials"];
    const summary = systems.materials.apply(
      preset,
      { tint, roughness, metalness, clearcoat, thickness, opacity },
      overrides,
    );
    onMaterials?.(summary, systems.materials.regionSummary());
    invalidate();
  }, [
    systems,
    preset,
    tint,
    roughness,
    metalness,
    clearcoat,
    thickness,
    opacity,
    overridesKey,
    onMaterials,
    invalidate,
  ]);

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
