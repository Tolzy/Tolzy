import { create } from "zustand";
import { hexToRgba, rgbaToHex } from "@/lib/color/color";

const KEY = "ps-recent-colors";
export const RECENT_LIMIT = 12;

function load(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw)
      ? raw.filter((v): v is string => typeof v === "string" && hexToRgba(v) !== null).slice(0, RECENT_LIMIT)
      : [];
  } catch {
    return [];
  }
}

interface RecentColors {
  colors: string[];
  loaded: boolean;
  /** Reads persisted colours (client only; call from an effect). */
  hydrate: () => void;
  add: (hex: string) => void;
}

/**
 * Recently committed colours, newest first, de-duplicated. Stored per browser
 * until accounts exist (then per account, Milestone 10).
 */
export const useRecentColors = create<RecentColors>()((set, get) => ({
  colors: [],
  loaded: false,
  hydrate: () => {
    if (!get().loaded) set({ colors: load(), loaded: true });
  },
  add: (hex) => {
    const c = hexToRgba(hex);
    if (!c) return;
    const value = rgbaToHex(c);
    const colors = [value, ...get().colors.filter((x) => x !== value)].slice(0, RECENT_LIMIT);
    set({ colors, loaded: true });
    try {
      localStorage.setItem(KEY, JSON.stringify(colors));
    } catch {
      // Private mode or blocked storage: keep them for this session only.
    }
  },
}));
