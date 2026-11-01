import { create } from "zustand";
import type { RegionId } from "@/lib/segmentation/regions";
import { DEFAULT_SETTINGS, type PortraitSettings } from "@/lib/studio/settings";
import type { GeometryReport } from "@/components/viewer/portrait-model";

export type InspectorContext = "model" | "material" | "light" | "scene" | "motion" | "export";

const HISTORY_LIMIT = 100;
export const ZOOM_MIN = 50;
export const ZOOM_MAX = 200;

type Updater = (s: PortraitSettings) => PortraitSettings;

interface StudioState {
  settings: PortraitSettings;
  past: PortraitSettings[];
  future: PortraitSettings[];
  /** Snapshot taken when a continuous change (slider drag) begins. */
  pending: PortraitSettings | null;

  context: InspectorContext;
  inspectorOpen: boolean;
  /** Viewport zoom in percent. View state, not part of undo history. */
  zoom: number;
  /** Incremented to ask the viewer to ease the head back to neutral. */
  viewResetKey: number;
  /** Selected model region (view state, not undoable). Material edits target it. */
  selectedRegion: RegionId | null;
  /** What the loaded model supports (from segmentation). */
  geometryReport: GeometryReport | null;

  /** Discrete change: recorded as one undo step immediately. */
  apply: (update: Updater) => void;
  /** Continuous change (e.g. while dragging): not recorded until commit(). */
  preview: (update: Updater) => void;
  /** Ends a continuous change and records it as one undo step. */
  commit: () => void;
  undo: () => void;
  redo: () => void;
  reset: (settings?: PortraitSettings) => void;

  setContext: (context: InspectorContext) => void;
  toggleInspector: () => void;
  setZoom: (zoom: number) => void;
  /** Zoom back to 100 % and ease the head to neutral. */
  resetView: () => void;
  selectRegion: (region: RegionId | null) => void;
  setGeometryReport: (report: GeometryReport | null) => void;
}

const pushPast = (past: PortraitSettings[], s: PortraitSettings) => [...past, s].slice(-HISTORY_LIMIT);

export const useStudioStore = create<StudioState>()((set, get) => ({
  settings: DEFAULT_SETTINGS,
  past: [],
  future: [],
  pending: null,
  context: "material",
  inspectorOpen: true,
  zoom: 100,
  viewResetKey: 0,
  selectedRegion: null,
  geometryReport: null,

  apply: (update) => {
    const { settings, past, pending } = get();
    const next = update(settings);
    if (next === settings) return;
    set({
      settings: next,
      past: pushPast(past, pending ?? settings),
      future: [],
      pending: null,
    });
  },

  preview: (update) => {
    const { settings, pending } = get();
    set({ settings: update(settings), pending: pending ?? settings });
  },

  commit: () => {
    const { pending, past, settings } = get();
    if (!pending) return;
    if (pending === settings) return set({ pending: null });
    set({ past: pushPast(past, pending), future: [], pending: null });
  },

  undo: () => {
    get().commit();
    const { past, future, settings } = get();
    const prev = past.at(-1);
    if (!prev) return;
    set({
      settings: prev,
      past: past.slice(0, -1),
      future: [settings, ...future],
    });
  },

  redo: () => {
    const { past, future, settings } = get();
    const [next, ...rest] = future;
    if (!next) return;
    set({ settings: next, past: pushPast(past, settings), future: rest });
  },

  reset: (settings = DEFAULT_SETTINGS) =>
    set({ settings, past: [], future: [], pending: null, zoom: 100, selectedRegion: null }),

  setContext: (context) => set({ context, inspectorOpen: true }),
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  setZoom: (zoom) => set({ zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(zoom))) }),
  resetView: () => set((s) => ({ zoom: 100, viewResetKey: s.viewResetKey + 1 })),
  selectRegion: (selectedRegion) => set({ selectedRegion }),
  setGeometryReport: (geometryReport) => set({ geometryReport }),
}));
