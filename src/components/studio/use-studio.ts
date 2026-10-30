"use client";

import { useSyncExternalStore } from "react";
import type { PortraitSettings } from "@/lib/studio/settings";
import { useStudioStore } from "@/stores/studio-store";

type Section = Exclude<keyof PortraitSettings, "background">;

/**
 * Binds one settings section to inspector controls.
 * `set` records an undo step; `drag` + `commit` group a continuous change.
 */
export function useSection<K extends Section>(key: K) {
  const value = useStudioStore((s) => s.settings[key]);
  const apply = useStudioStore((s) => s.apply);
  const preview = useStudioStore((s) => s.preview);
  const commit = useStudioStore((s) => s.commit);

  const merge = (patch: Partial<PortraitSettings[K]>) => (s: PortraitSettings) => ({
    ...s,
    [key]: { ...s[key], ...patch },
  });

  return {
    value,
    set: (patch: Partial<PortraitSettings[K]>) => apply(merge(patch)),
    drag: (patch: Partial<PortraitSettings[K]>) => preview(merge(patch)),
    commit,
  };
}

const REDUCED = "(prefers-reduced-motion: reduce)";

/** Live `prefers-reduced-motion` value (false during SSR). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(REDUCED);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}
