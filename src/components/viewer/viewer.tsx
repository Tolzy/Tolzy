"use client";

import { useGLTF, useProgress } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Component, Suspense, useCallback, useLayoutEffect, useState, type ReactNode } from "react";
import { NeutralToneMapping, PerspectiveCamera, SRGBColorSpace } from "three";
import type { ModelFraming } from "@/lib/studio/sample-model";
import type { PortraitSettings } from "@/lib/studio/settings";
import { clippingPlanes, fitDistance, insetShift, MODEL_HEIGHT, zoomedDistance } from "./framing";
import { PortraitModel, type ModelBounds } from "./portrait-model";
import { StudioLighting, StudioShadow } from "./studio-lighting";
import { ViewerError, ViewerLoading } from "./viewer-states";

export interface ViewerProps {
  url: string;
  framing: ModelFraming;
  lighting: PortraitSettings["lighting"];
  zoom: number;
}

const FOV = 26; // a longer lens avoids wide-angle distortion of the face
const MARGIN = 1.22;
/** Space kept clear for the floating viewport toolbar, in CSS pixels. */
const TOOLBAR_INSET = 72;

/**
 * The studio 3D viewer. Loaded lazily (see LazyViewer) so three.js is only
 * downloaded when a studio opens. The canvas is transparent: the viewport
 * background comes from the Scene settings behind it.
 */
export default function Viewer({ url, framing, lighting, zoom }: ViewerProps) {
  const [bounds, setBounds] = useState<ModelBounds | null>(null);
  const [attempt, setAttempt] = useState(0);
  const onReady = useCallback((b: ModelBounds) => setBounds(b), []);
  const floorY = -framing.pivot * MODEL_HEIGHT;

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
      <Canvas
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
        aria-label="3D sample head"
        role="img"
      >
        <CameraRig bounds={bounds} framing={framing} zoom={zoom} />
        <StudioLighting intensity={lighting.intensity} rotation={lighting.rotation} />
        <Suspense fallback={null}>
          <PortraitModel url={url} framing={framing} onReady={onReady} />
          {lighting.shadows && bounds && <StudioShadow floorY={floorY} />}
        </Suspense>
      </Canvas>
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
    const width = bounds?.width ?? 0.8;
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
