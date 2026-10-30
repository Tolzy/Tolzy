"use client";

import { AlertCircle, Box, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown while three.js and the model download. */
export function ViewerLoading({ progress }: { progress?: number }) {
  const pct = Math.round(progress ?? 0);
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3" role="status">
      <div className="bg-vp-line h-0.5 w-28 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full bg-white/70 transition-[width] duration-200 ease-out"
          style={{ width: `${Math.max(pct, 6)}%` }}
        />
      </div>
      <p className="text-vp-muted text-xs">Loading model{pct > 0 ? ` · ${pct}%` : ""}</p>
    </div>
  );
}

/** Shown when the model cannot be loaded or parsed. */
export function ViewerError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center" role="alert">
      <span className="bg-vp-chrome border-vp-line text-vp-muted flex size-10 items-center justify-center rounded-full border">
        <AlertCircle className="size-5" />
      </span>
      <p className="text-vp-fg mt-4 text-sm font-medium">The model couldn’t be loaded</p>
      <p className="text-vp-muted mt-1 max-w-xs text-xs">
        The file may be missing or damaged. Your settings are not affected.
      </p>
      <Button variant="viewport" size="sm" className="mt-4 border border-white/10" onClick={onRetry}>
        <RotateCcw /> Try again
      </Button>
      <p className="sr-only">Details: {error.message}</p>
    </div>
  );
}

/** Shown when the browser cannot create a WebGL context. */
export function ViewerUnsupported() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center" role="alert">
      <span className="bg-vp-chrome border-vp-line text-vp-muted flex size-10 items-center justify-center rounded-full border">
        <Box className="size-5" />
      </span>
      <p className="text-vp-fg mt-4 text-sm font-medium">3D isn’t available in this browser</p>
      <p className="text-vp-muted mt-1 max-w-xs text-xs">
        Turn on hardware acceleration or try a recent version of Chrome, Safari, Firefox or Edge.
      </p>
    </div>
  );
}
