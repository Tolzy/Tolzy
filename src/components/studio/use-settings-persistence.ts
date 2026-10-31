"use client";

import { useEffect } from "react";
import { parseSettings, SETTINGS_SCHEMA_VERSION, type StoredSettings } from "@/lib/studio/schema";
import { DEFAULT_SETTINGS, type PortraitSettings } from "@/lib/studio/settings";
import { useStudioStore } from "@/stores/studio-store";

const key = (portraitId: string) => `ps-settings:${portraitId}`;
const SAVE_DELAY_MS = 400;

/**
 * Restores a portrait's settings from this device and saves changes
 * (debounced). The same validated document moves to `portrait_settings`
 * when accounts exist; undo history is not persisted.
 *
 * Without saved settings the studio starts from defaults, with cursor
 * tracking off for reduced-motion users.
 */
export function useSettingsPersistence(portraitId: string) {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const defaults: PortraitSettings = {
      ...DEFAULT_SETTINGS,
      motion: { ...DEFAULT_SETTINGS.motion, tracking: !reduced },
    };
    let initial = defaults;
    try {
      const raw = localStorage.getItem(key(portraitId));
      if (raw) initial = parseSettings((JSON.parse(raw) as Partial<StoredSettings>).settings, defaults);
    } catch {
      // Unreadable or blocked storage: start from defaults.
    }
    useStudioStore.getState().reset(initial);

    let timer: number | undefined;
    const save = (settings: PortraitSettings) => {
      try {
        const doc: StoredSettings = { schemaVersion: SETTINGS_SCHEMA_VERSION, settings };
        localStorage.setItem(key(portraitId), JSON.stringify(doc));
      } catch {
        // Storage full or blocked: changes still apply for this session.
      }
    };
    const unsubscribe = useStudioStore.subscribe((state, prev) => {
      if (state.settings === prev.settings) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = undefined;
        save(state.settings);
      }, SAVE_DELAY_MS);
    });
    // Flush a pending save when leaving the studio or closing/reloading the tab.
    const flush = () => {
      if (timer === undefined) return;
      window.clearTimeout(timer);
      timer = undefined;
      save(useStudioStore.getState().settings);
    };
    window.addEventListener("pagehide", flush);
    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [portraitId]);
}
