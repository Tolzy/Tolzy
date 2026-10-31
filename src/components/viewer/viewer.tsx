"use client";

import { useGLTF, useProgress } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { NeutralToneMapping, PerspectiveCamera, SRGBColorSpace } from "three";
import { cn } from "@/lib/cn";
import type { ModelFraming } from "@/lib/studio/sample-model";
import { MATERIAL_PRESET_DEFS } from "@/lib/studio/materials";
import type { Background, PortraitSettings } from "@/lib/studio/settings";
import { clippingPlanes, fitDistance, insetShift, MODEL_HEIGHT, zoomedDistance } from "./framing";
import { PortraitModel, type ModelBounds } from "./portrait-model";
import { StudioLighting, StudioShadow } from "./studio-lighting";
import { InteractionController, type Rotation } from "./interaction";
import { InteractionRig } from "./interaction-rig";
import type { MaterialSummary } from "./material-system";
import { SceneProbe } from "./scene-probe";
import { TransmissionBackdrop } from "./transmission-backdrop";
import { ViewerError, ViewerLoading } from "./viewer-states";

export interface ViewerProps {
  url: string;
  framing: ModelFraming;
  material: PortraitSettings["material"];
  /** Viewport background (drawn by CSS); glass refracts a copy of it. */
  background: Background;
  lighting: PortraitSettings["lighting"];
  motion: PortraitSettings["motion"];
  reducedMotion: boolean;
  zoom: number;
  /** Changes when the user resets the view; the head eases back to neutral. */
  resetKey: number;
  /** Accessible name of the model, e.g. "Sample head". */
  label: string;
}

/** Keyboard rotation step, degrees. */
const KEY_YAW = 10;
const KEY_PITCH = 5;

const FOV = 26; // a longer lens avoids wide-angle distortion of the face
const MARGIN = 1.22;
/** Widest part of the model (relative to its height) that framing must keep in view. */
const MAX_FRAME_WIDTH = 1;
/** Space kept clear for the floating viewport toolbar, in CSS pixels. */
const TOOLBAR_INSET = 72;

/**
 * The studio 3D viewer. Loaded lazily (see LazyViewer) so three.js is only
 * downloaded when a studio opens. The canvas is transparent: the viewport
 * background comes from the Scene settings behind it.
 */
export default function Viewer({
  url,
  framing,
  material,
  background,
  lighting,
  motion,
  reducedMotion,
  zoom,
  resetKey,
  label,
}: ViewerProps) {
  const [bounds, setBounds] = useState<ModelBounds | null>(null);
  const [attempt, setAttempt] = useState(0);
  const onReady = useCallback((b: ModelBounds) => setBounds(b), []);
  const floorY = -framing.pivot * MODEL_HEIGHT;
  const surface = useRef<HTMLDivElement>(null);
  const [controller] = useState(() => new InteractionController({ ...motion, reducedMotion }));

  useEffect(() => controller.setConfig({ ...motion, reducedMotion }), [controller, motion, reducedMotion]);
  useEffect(() => {
    if (resetKey > 0) controller.reset();
  }, [controller, resetKey]);

  // Cursor tracking listens on the whole viewport (including the toolbar), so
  // moving onto the toolbar is not treated as leaving.
  useEffect(() => {
    const el = surface.current?.closest<HTMLElement>("[data-viewport]") ?? surface.current;
    if (!el) return;
    const move = (e: globalThis.PointerEvent) => {
      if (e.pointerType === "touch") return; // touch rotates by dragging instead
      const rect = el.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      controller.pointerMove(nx, ny);
    };
    const leave = () => controller.pointerLeave(performance.now());
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [controller]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (
      controller.dragStart(e.pointerId, e.clientX, e.clientY, rect.width, rect.height, performance.now(), e.pointerType)
    ) {
      try {
        // Keep receiving moves even when the pointer leaves the canvas mid-drag.
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Some synthetic or already-released pointers cannot be captured; dragging still works.
      }
      e.currentTarget.dataset.dragging = "true";
    }
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (controller.dragging) controller.dragMove(e.pointerId, e.clientX, e.clientY, performance.now());
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (!controller.dragging) return;
    const now = performance.now();
    controller.dragEnd(e.pointerId, now, cancelled);
    delete e.currentTarget.dataset.dragging;
    // Released outside the viewport: no leave event will follow, so send one.
    const area = e.currentTarget.closest<HTMLElement>("[data-viewport]") ?? e.currentTarget;
    const r = area.getBoundingClientRect();
    const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (outside || e.pointerType === "touch") {
      controller.pointerLeave(now);
    } else {
      // Resume tracking towards where the pointer is now, smoothly from the current pose.
      controller.pointerMove(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_YAW, 0],
      ArrowRight: [KEY_YAW, 0],
      ArrowUp: [0, KEY_PITCH],
      ArrowDown: [0, -KEY_PITCH],
    };
    const d = step[e.key];
    if (!d) return;
    e.preventDefault();
    controller.nudge(d[0], d[1]);
  };

  // Mirror the rotation onto the element for tests and debugging (cheap, only while moving).
  const lastWritten = useRef("");
  const onRotate = useCallback((r: Rotation) => {
    const el = surface.current;
    if (!el) return;
    const key = `${r.yaw.toFixed(1)}|${r.pitch.toFixed(1)}|${r.settled}`;
    if (key === lastWritten.current) return;
    lastWritten.current = key;
    el.dataset.yaw = r.yaw.toFixed(2);
    el.dataset.pitch = r.pitch.toFixed(2);
    el.dataset.trackYaw = r.trackYaw.toFixed(2);
    el.dataset.manualYaw = r.manualYaw.toFixed(2);
    el.dataset.manualPitch = r.manualPitch.toFixed(2);
    el.dataset.settled = String(r.settled);
  }, []);

  // Mirror what is actually on the model (read from the Three.js objects).
  const onMaterials = useCallback((m: MaterialSummary) => {
    const el = surface.current;
    if (!el) return;
    el.dataset.material = m.preset;
    el.dataset.materialType = m.type;
    el.dataset.materialColor = m.color;
    el.dataset.metalness = m.metalness.toFixed(3);
    el.dataset.roughness = m.roughness.toFixed(3);
    el.dataset.transmission = m.transmission.toFixed(3);
    el.dataset.clearcoat = m.clearcoat.toFixed(3);
    el.dataset.thickness = m.thickness.toFixed(3);
    el.dataset.hiddenMeshes = String(m.hidden);
    el.dataset.geometryKey = m.geometryKey;
    el.dataset.materialsCreated = String(m.created);
  }, []);

  return (
    <ModelErrorBoundary
      key={attempt}
      fallback={(error) => (
        <ViewerError
          error={error}
          onRetry={() => {
            // The loader caches failures; clear it so the retry fetches again.
            useGLTF.clear(url);
            setAttempt((n) => n + 1);
          }}
        />
      )}
    >
      <div
        ref={surface}
        data-testid="viewer-surface"
        role="application"
        aria-roledescription="3D viewer"
        aria-label={`${label}. ${motion.dragEnabled ? "Drag or use the arrow keys to rotate." : "Rotation is turned off."}`}
        tabIndex={0}
        className={cn(
          "absolute inset-0 touch-none outline-none select-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-inset",
          motion.dragEnabled && "cursor-grab data-[dragging=true]:cursor-grabbing",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e, false)}
        onPointerCancel={(e) => endDrag(e, true)}
        onLostPointerCapture={(e) => endDrag(e, true)}
        onKeyDown={onKeyDown}
      >
        <Canvas
          shadows="percentage"
          className="!absolute inset-0"
          frameloop="demand"
          dpr={[1, 2]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            toneMapping: NeutralToneMapping,
            toneMappingExposure: 1.0,
            outputColorSpace: SRGBColorSpace,
          }}
          camera={{ fov: FOV, near: 0.05, far: 50, position: [0, 0, 4] }}
          aria-label={`3D ${label.toLowerCase()}`}
          role="img"
        >
          <CameraRig bounds={bounds} framing={framing} zoom={zoom} />
          <StudioLighting preset={lighting.preset} intensity={lighting.intensity} rotation={lighting.rotation} />
          <SceneProbe target={surface} />
          <TransmissionBackdrop
            background={background}
            active={MATERIAL_PRESET_DEFS[material.preset].physics.transmission > 0}
          />
          <Suspense fallback={null}>
            <InteractionRig controller={controller} onRotate={onRotate}>
              <PortraitModel
                url={url}
                framing={framing}
                material={material}
                onReady={onReady}
                onMaterials={onMaterials}
              />
            </InteractionRig>
            {lighting.shadows && bounds && <StudioShadow floorY={floorY} />}
          </Suspense>
        </Canvas>
      </div>
      {!bounds && <LoadingOverlay />}
    </ModelErrorBoundary>
  );
}

function LoadingOverlay() {
  const { progress } = useProgress();
  return <ViewerLoading progress={progress} />;
}

/** Positions the fixed camera so the model fills the viewport at any size. */
function CameraRig({ bounds, framing, zoom }: { bounds: ModelBounds | null; framing: ModelFraming; zoom: number }) {
  const get = useThree((s) => s.get);
  const size = useThree((s) => s.size);

  useLayoutEffect(() => {
    // Frame at most a square around the bust: on narrow viewports the shoulder
    // tips may run to the edge (a portrait crop) so the face stays large.
    const width = Math.min(bounds?.width ?? 0.8, MODEL_HEIGHT * MAX_FRAME_WIDTH);
    const height = bounds?.height ?? MODEL_HEIGHT;
    const aspect = size.width / Math.max(size.height, 1);
    const fill = Math.max(0.5, 1 - TOOLBAR_INSET / Math.max(size.height, 1));
    const fit = fitDistance({ width, height, fov: FOV, aspect, margin: MARGIN, fill });
    const distance = zoomedDistance(fit, zoom);
    const radius = Math.hypot(width, height, bounds?.depth ?? 0.6) / 2;
    const { near, far } = clippingPlanes(distance, radius);

    const { camera, invalidate } = get() as { camera: PerspectiveCamera; invalidate: () => void };
    // Look at the model's focus height; the model's pivot sits at the origin.
    // Centre the model in the area above the toolbar.
    const focusY = (framing.focus - framing.pivot) * height - insetShift(distance, FOV, size.height, TOOLBAR_INSET);
    camera.position.set(0, focusY + height * 0.02, distance);
    camera.lookAt(0, focusY, 0);
    camera.near = near;
    camera.far = far;
    camera.updateProjectionMatrix();
    invalidate();
  }, [bounds, framing, zoom, size.width, size.height, get]);

  return null;
}

/* ───────────────────────── Error boundary ───────────────────────── */

interface BoundaryProps {
  fallback: (error: Error) => ReactNode;
  children: ReactNode;
}

class ModelErrorBoundary extends Component<BoundaryProps, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.warn("[viewer] model failed to load:", error.message);
  }

  render() {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children;
  }
}
