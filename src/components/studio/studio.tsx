"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Crosshair,
  Download,
  Image as ImageIcon,
  Lightbulb,
  Maximize2,
  Minimize2,
  Minus,
  Move3d,
  PanelRight,
  Palette,
  Plus,
  Redo2,
  RotateCcw,
  Share2,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { backgroundToCss, DEFAULT_SETTINGS } from "@/lib/studio/settings";
import { useStudioStore, type InspectorContext, ZOOM_MAX, ZOOM_MIN } from "@/stores/studio-store";
import { Badge } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { LazyViewer } from "@/components/viewer/lazy-viewer";
import { SAMPLE_MODEL, type ModelFraming } from "@/lib/studio/sample-model";
import { ExportPanel, LightPanel, MaterialPanel, MotionPanel, ScenePanel } from "./inspector-panels";
import { ShareDialog } from "./share-dialog";
import { StudioModelContext } from "./studio-context";
import { usePrefersReducedMotion } from "./use-studio";

const CONTEXTS: {
  id: InspectorContext;
  label: string;
  title: string;
  icon: ReactNode;
  panel: () => ReactNode;
}[] = [
  {
    id: "material",
    label: "Material",
    title: "Material",
    icon: <Palette />,
    panel: MaterialPanel,
  },
  {
    id: "light",
    label: "Light",
    title: "Lighting",
    icon: <Lightbulb />,
    panel: LightPanel,
  },
  {
    id: "scene",
    label: "Scene",
    title: "Scene",
    icon: <ImageIcon />,
    panel: ScenePanel,
  },
  {
    id: "motion",
    label: "Motion",
    title: "Interaction",
    icon: <Move3d />,
    panel: MotionPanel,
  },
  {
    id: "export",
    label: "Export",
    title: "Export",
    icon: <Download />,
    panel: ExportPanel,
  },
];

interface StudioProps {
  portraitName: string;
  projectName: string;
  /** GLB to render and how to place it. */
  modelUrl: string;
  framing: ModelFraming;
  /** Rendered thumbnail of this model, shown as the "Original" material preview. */
  thumbnailUrl?: string;
  isSample?: boolean;
}

export function Studio({ portraitName, projectName, modelUrl, framing, thumbnailUrl, isSample }: StudioProps) {
  const inspectorOpen = useStudioStore((s) => s.inspectorOpen);
  useStudioShortcuts();
  useInitialSettings();

  return (
    <StudioModelContext value={{ thumbnailUrl: thumbnailUrl ?? null }}>
      <div className="bg-bg flex h-dvh flex-col">
        <TopBar portraitName={portraitName} projectName={projectName} isSample={isSample} />
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <Viewport isSample={isSample} modelUrl={modelUrl} framing={framing} modelLabel={portraitName} />
          <div className="bg-surface flex min-h-0 flex-1 flex-col md:flex-none md:flex-row-reverse">
            <ContextRail />
            <Inspector className={cn(!inspectorOpen && "md:hidden")} />
          </div>
        </div>
      </div>
    </StudioModelContext>
  );
}

/* ───────────────────────── Top bar ───────────────────────── */

function TopBar({
  portraitName,
  projectName,
  isSample,
}: Pick<StudioProps, "portraitName" | "projectName" | "isSample">) {
  const undo = useStudioStore((s) => s.undo);
  const redo = useStudioStore((s) => s.redo);
  const canUndo = useStudioStore((s) => s.past.length > 0 || s.pending !== null);
  const canRedo = useStudioStore((s) => s.future.length > 0);
  const setContext = useStudioStore((s) => s.setContext);

  return (
    <header className="border-line bg-surface flex h-12 shrink-0 items-center gap-2 border-b px-2 sm:px-3">
      <Tooltip content="Back to portraits">
        <Button variant="ghost" iconOnly asChild>
          <Link href="/dashboard" aria-label="Back to portraits">
            <ArrowLeft />
          </Link>
        </Button>
      </Tooltip>
      <span className="bg-line h-4 w-px" aria-hidden="true" />
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 pl-1 text-sm">
        <span className="text-muted hidden truncate sm:inline">{projectName}</span>
        <span className="text-subtle hidden sm:inline" aria-hidden="true">
          /
        </span>
        <h1 className="text-fg truncate font-medium" aria-current="page">
          {portraitName}
        </h1>
        {isSample && <Badge tone="outline">Sample</Badge>}
      </nav>

      <div className="ml-auto flex items-center gap-1">
        <div className="mr-1 hidden items-center sm:flex">
          <Tooltip content="Undo" shortcut={["⌘", "Z"]}>
            <Button variant="ghost" iconOnly aria-label="Undo" disabled={!canUndo} onClick={undo}>
              <Undo2 />
            </Button>
          </Tooltip>
          <Tooltip content="Redo" shortcut={["⇧", "⌘", "Z"]}>
            <Button variant="ghost" iconOnly aria-label="Redo" disabled={!canRedo} onClick={redo}>
              <Redo2 />
            </Button>
          </Tooltip>
        </div>
        <ShareDialog
          trigger={
            <Button variant="secondary">
              <Share2 className="sm:hidden" />
              <span className="max-sm:sr-only">Share</span>
            </Button>
          }
        />
        <Button variant="primary" onClick={() => setContext("export")}>
          Export
        </Button>
      </div>
    </header>
  );
}

/* ───────────────────────── Viewport ───────────────────────── */

function subscribeFullscreen(cb: () => void) {
  document.addEventListener("fullscreenchange", cb);
  return () => document.removeEventListener("fullscreenchange", cb);
}

function Viewport({
  isSample,
  modelUrl,
  framing,
  modelLabel,
}: {
  isSample?: boolean;
  modelUrl: string;
  framing: ModelFraming;
  modelLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const background = useStudioStore((s) => s.settings.background);
  const material = useStudioStore((s) => s.settings.material);
  const lighting = useStudioStore((s) => s.settings.lighting);
  const motion = useStudioStore((s) => s.settings.motion);
  const zoom = useStudioStore((s) => s.zoom);
  const resetKey = useStudioStore((s) => s.viewResetKey);
  const reducedMotion = usePrefersReducedMotion();
  const css = backgroundToCss(background);
  const fullscreen = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenElement !== null,
    () => false,
  );

  return (
    <section
      ref={ref}
      aria-label="3D viewport"
      data-viewport
      className={cn(
        "bg-vp relative h-[46dvh] shrink-0 overflow-hidden md:h-auto md:min-w-0 md:flex-1",
        background.type === "transparent" && "checkerboard",
      )}
      style={css ? { background: css } : undefined}
    >
      <LazyViewer
        url={modelUrl}
        framing={framing}
        material={material}
        background={background}
        lighting={lighting}
        motion={motion}
        reducedMotion={reducedMotion}
        zoom={zoom}
        resetKey={resetKey}
        label={modelLabel}
      />

      {isSample && (
        <div className="absolute top-3 left-3">
          <Tooltip
            side="bottom"
            content={
              <span className="block max-w-[240px] leading-4">
                {SAMPLE_MODEL.credit}. A demonstration model — not an AI-generated portrait of a real person.
              </span>
            }
          >
            <button type="button" className="rounded-[5px]">
              <Badge tone="float">Sample model · {SAMPLE_MODEL.licence}</Badge>
            </button>
          </Tooltip>
        </div>
      )}

      <ViewportToolbar fullscreen={fullscreen} onFullscreen={() => toggleFullscreen(ref.current)} />
    </section>
  );
}

function toggleFullscreen(el: HTMLElement | null) {
  if (!el) return;
  if (document.fullscreenElement) void document.exitFullscreen();
  else void el.requestFullscreen?.();
}

function ToolbarDivider() {
  return <span className="bg-float-line mx-0.5 h-4 w-px" aria-hidden="true" />;
}

function ViewportToolbar({ fullscreen, onFullscreen }: { fullscreen: boolean; onFullscreen: () => void }) {
  const zoom = useStudioStore((s) => s.zoom);
  const resetView = useStudioStore((s) => s.resetView);
  const setZoom = useStudioStore((s) => s.setZoom);
  const tracking = useStudioStore((s) => s.settings.motion.tracking);
  const apply = useStudioStore((s) => s.apply);
  const inspectorOpen = useStudioStore((s) => s.inspectorOpen);
  const toggleInspector = useStudioStore((s) => s.toggleInspector);

  return (
    <div
      role="toolbar"
      aria-label="Viewport"
      className="border-float-line bg-float shadow-floating absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-[10px] border p-1 backdrop-blur-sm"
    >
      <Tooltip content="Reset view" shortcut={["0"]} side="top">
        <Button variant="viewport" size="sm" iconOnly aria-label="Reset view" onClick={resetView}>
          <RotateCcw />
        </Button>
      </Tooltip>
      <ToolbarDivider />
      <Tooltip content="Zoom out" shortcut={["−"]} side="top">
        <Button
          variant="viewport"
          size="sm"
          iconOnly
          aria-label="Zoom out"
          disabled={zoom <= ZOOM_MIN}
          onClick={() => setZoom(zoom - 10)}
        >
          <Minus />
        </Button>
      </Tooltip>
      <span
        className="tabular text-2xs text-float-fg w-11 text-center font-mono"
        aria-live="polite"
        aria-label={`Zoom ${zoom}%`}
      >
        {zoom}%
      </span>
      <Tooltip content="Zoom in" shortcut={["+"]} side="top">
        <Button
          variant="viewport"
          size="sm"
          iconOnly
          aria-label="Zoom in"
          disabled={zoom >= ZOOM_MAX}
          onClick={() => setZoom(zoom + 10)}
        >
          <Plus />
        </Button>
      </Tooltip>
      <ToolbarDivider />
      <Tooltip content={tracking ? "Cursor tracking on" : "Cursor tracking off"} side="top">
        <Button
          variant="viewport"
          size="sm"
          iconOnly
          aria-label="Cursor tracking"
          aria-pressed={tracking}
          onClick={() =>
            apply((s) => ({
              ...s,
              motion: { ...s.motion, tracking: !s.motion.tracking },
            }))
          }
        >
          <Crosshair />
        </Button>
      </Tooltip>
      <Tooltip content={fullscreen ? "Exit full screen" : "Full screen"} side="top">
        <Button
          variant="viewport"
          size="sm"
          iconOnly
          aria-label={fullscreen ? "Exit full screen" : "Full screen"}
          onClick={onFullscreen}
        >
          {fullscreen ? <Minimize2 /> : <Maximize2 />}
        </Button>
      </Tooltip>
      <span className="hidden md:contents">
        <ToolbarDivider />
        <Tooltip content={inspectorOpen ? "Hide panel" : "Show panel"} shortcut={["\\"]} side="top">
          <Button
            variant="viewport"
            size="sm"
            iconOnly
            aria-label="Properties panel"
            aria-pressed={inspectorOpen}
            onClick={toggleInspector}
          >
            <PanelRight />
          </Button>
        </Tooltip>
      </span>
    </div>
  );
}

/* ───────────────────────── Context rail + inspector ───────────────────────── */

function ContextRail() {
  const context = useStudioStore((s) => s.context);
  const inspectorOpen = useStudioStore((s) => s.inspectorOpen);
  const setContext = useStudioStore((s) => s.setContext);
  const toggleInspector = useStudioStore((s) => s.toggleInspector);

  return (
    <nav
      aria-label="Properties"
      className="border-line flex shrink-0 justify-around border-b px-1 py-1 md:w-[64px] md:flex-col md:justify-start md:gap-1 md:border-b-0 md:border-l md:px-1.5 md:py-2"
    >
      {CONTEXTS.map((c) => {
        const active = c.id === context && inspectorOpen;
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={c.id === context}
            onClick={() => (c.id === context ? toggleInspector() : setContext(c.id))}
            className={cn(
              "flex h-12 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[10px] leading-none font-medium md:flex-none",
              "transition-colors duration-[120ms] [&_svg]:size-[18px]",
              active
                ? "bg-active text-fg"
                : c.id === context
                  ? "text-fg hover:bg-hover"
                  : "text-muted hover:bg-hover hover:text-fg",
            )}
          >
            {c.icon}
            {c.label}
          </button>
        );
      })}
    </nav>
  );
}

function Inspector({ className }: { className?: string }) {
  const context = useStudioStore((s) => s.context);
  const active = CONTEXTS.find((c) => c.id === context)!;
  const Panel = active.panel;

  return (
    <aside
      aria-label={`${active.title} properties`}
      className={cn("md:border-line flex min-h-0 flex-1 flex-col md:w-[288px] md:flex-none md:border-l", className)}
    >
      <header className="border-line flex h-11 shrink-0 items-center border-b px-4">
        <h2 className="text-fg text-sm font-medium">{active.title}</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <Panel key={active.id} />
      </div>
    </aside>
  );
}

/* ───────────────────────── Behaviour ───────────────────────── */

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

function useStudioShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStudioStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        if (isTyping(e.target)) return;
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod || e.altKey || isTyping(e.target)) return;
      if (e.key === "\\") s.toggleInspector();
      else if (e.key === "0") s.resetView();
      else if (e.key === "+" || e.key === "=") s.setZoom(s.zoom + 10);
      else if (e.key === "-") s.setZoom(s.zoom - 10);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Starts each studio session from defaults; tracking is off for reduced-motion users. */
function useInitialSettings() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const motion = { ...DEFAULT_SETTINGS.motion, tracking: !reduced };
    useStudioStore.getState().reset({ ...DEFAULT_SETTINGS, motion });
  }, []);
}
