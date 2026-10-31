"use client";

import type { FaceLandmarker } from "@mediapipe/tasks-vision";

/** Self-hosted runtime and model (see public/models/mediapipe/README.md). */
const WASM_PATH = "/vendor/mediapipe/wasm";
const MODEL_PATH = "/models/mediapipe/face_landmarker.task";

export interface DetectedFace {
  /** Bounding box of all landmarks, in pixels of the analysed canvas. */
  box: { x: number; y: number; width: number; height: number };
  /** Landmarks in canvas pixels. */
  points: { x: number; y: number }[];
  /** Head rotation in degrees (0 = facing the camera). Sign is not relied on. */
  yaw: number;
  pitch: number;
  /** MediaPipe blendshape scores 0–1, by name (eyeBlinkLeft, jawOpen, …). */
  blend: Record<string, number>;
}

let loading: Promise<FaceLandmarker> | null = null;

/**
 * MediaPipe's WebAssembly runtime prints informational lines (e.g. "INFO:
 * Created TensorFlow Lite XNNPACK delegate for CPU.") through console.error,
 * which development tools then report as errors. Drop exactly those lines;
 * everything else passes through untouched.
 */
function quietRuntimeInfo() {
  const original = console.error;
  if ((original as { quiet?: boolean }).quiet) return;
  const filtered = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      /^(INFO|I\d{4}|W\d{4}).*(TensorFlow Lite|XNNPACK|gl_context|landmark)/i.test(args[0])
    )
      return;
    original(...args);
  };
  (filtered as { quiet?: boolean }).quiet = true;
  console.error = filtered;
}

/**
 * Loads MediaPipe Face Landmarker once, on first use. Runs on the CPU
 * (WebAssembly) for consistent results across devices; photos never leave
 * the browser. Rejects if the runtime cannot load (old browser, blocked WASM).
 */
export function loadFaceDetector(): Promise<FaceLandmarker> {
  quietRuntimeInfo();
  loading ??= (async () => {
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    return FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: "CPU" },
      runningMode: "IMAGE",
      numFaces: 4,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
  })().catch((error) => {
    loading = null; // allow a retry later
    throw error;
  });
  return loading;
}

const DEG = 180 / Math.PI;

export async function detectFaces(source: HTMLCanvasElement | OffscreenCanvas): Promise<DetectedFace[]> {
  const landmarker = await loadFaceDetector();
  const w = source.width;
  const h = source.height;
  const result = landmarker.detect(source as unknown as HTMLCanvasElement);
  return result.faceLandmarks.map((lm, i) => {
    const points = lm.map((p) => ({ x: p.x * w, y: p.y * h }));
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    // Column-major 4×4 transform; R02/R22 give yaw, R12 pitch.
    const m = result.facialTransformationMatrixes?.[i]?.data;
    const yaw = m ? Math.atan2(m[8], m[10]) * DEG : 0;
    const pitch = m ? Math.asin(Math.max(-1, Math.min(1, -m[9]))) * DEG : 0;
    const blend: Record<string, number> = {};
    for (const c of result.faceBlendshapes?.[i]?.categories ?? []) blend[c.categoryName] = c.score;
    return {
      box: { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y },
      points,
      yaw,
      pitch,
      blend,
    };
  });
}
