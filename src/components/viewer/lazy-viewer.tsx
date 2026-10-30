"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import type { ViewerProps } from "./viewer";
import { ViewerLoading, ViewerUnsupported } from "./viewer-states";

// three.js, R3F and the model load only when a studio is opened.
const Viewer = dynamic(() => import("./viewer"), {
  ssr: false,
  loading: () => <ViewerLoading />,
});

let webglSupport: boolean | null = null;

/** True when the browser can create a WebGL2 or WebGL context. Cached. */
export function hasWebGL(): boolean {
  if (webglSupport !== null) return webglSupport;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    webglSupport = !!gl;
    (gl as WebGLRenderingContext | null)?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

const noop = () => () => {};

export function LazyViewer(props: ViewerProps) {
  // null during server render; checked once on the client.
  const supported = useSyncExternalStore(noop, hasWebGL, () => null);
  if (supported === null) return <ViewerLoading />;
  if (!supported) return <ViewerUnsupported />;
  return <Viewer {...props} />;
}
