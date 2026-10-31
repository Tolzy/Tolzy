"use client";

import { ImagePlus, Plus, ScanFace } from "lucide-react";
import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ACCEPT } from "@/lib/photos/file-checks";
import { Button } from "@/components/ui/button";

/** Hidden file input + a function to open it. */
export function useFilePicker(onFile: (file: File) => void) {
  const input = useRef<HTMLInputElement>(null);
  const element = (
    <input
      ref={input}
      type="file"
      accept={ACCEPT}
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) onFile(file);
        e.target.value = ""; // allow choosing the same file again
      }}
    />
  );
  return { open: () => input.current?.click(), input: element };
}

/** Drag-and-drop handlers shared by the large and compact drop zones. */
function useDrop(onFile: (file: File) => void) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const handlers = {
    onDragEnter: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      depth.current++;
      setOver(true);
    },
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setOver(false);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
  };
  return { over, handlers };
}

/** Wraps any content (e.g. a filled photo card) so a new photo can be dropped on it. */
export function DropTarget({
  onFile,
  children,
  className,
}: {
  onFile: (file: File) => void;
  children: ReactNode;
  className?: string;
}) {
  const { over, handlers } = useDrop(onFile);
  return (
    <div {...handlers} data-dragging={over || undefined} className={cn("relative", className)}>
      {children}
      {over && (
        <div className="bg-accent-soft/80 ring-accent text-fg pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl text-sm font-medium ring-2">
          Drop to replace
        </div>
      )}
    </div>
  );
}

export function MainDropZone({ onFile }: { onFile: (file: File) => void }) {
  const { open, input } = useFilePicker(onFile);
  const { over, handlers } = useDrop(onFile);
  const hint = useId();
  return (
    <div
      {...handlers}
      data-testid="main-drop-zone"
      data-dragging={over || undefined}
      className={cn(
        "border-line-strong bg-bg flex aspect-[16/10] w-full flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center transition-colors",
        over && "border-accent bg-accent-soft/40",
      )}
    >
      {input}
      <span className="bg-surface text-muted ring-line shadow-soft flex size-14 items-center justify-center rounded-full ring-1">
        <ScanFace className="size-6" strokeWidth={1.5} />
      </span>
      <p className="text-md text-fg mt-5 font-medium">
        {over ? "Drop to add your photo" : "Drop a front-facing photo here"}
      </p>
      <p className="text-muted mt-1 text-sm">or</p>
      <Button className="mt-3" onClick={open} aria-describedby={hint}>
        <ImagePlus />
        Choose a file
      </Button>
      <p id={hint} className="text-muted mt-5 text-xs">
        JPG, PNG, WebP or HEIC · up to 20 MB · at least 1024 px on the short side
      </p>
    </div>
  );
}

export function SlotDropZone({ label, onFile }: { label: string; onFile: (file: File) => void }) {
  const { open, input } = useFilePicker(onFile);
  const { over, handlers } = useDrop(onFile);
  return (
    <div {...handlers}>
      {input}
      <button
        type="button"
        onClick={open}
        aria-label={`Add ${label.toLowerCase()} photo`}
        className={cn(
          "border-line-strong bg-bg text-subtle hover:text-muted hover:border-subtle flex aspect-[4/5] w-full items-center justify-center rounded-lg border border-dashed transition-colors",
          over && "border-accent bg-accent-soft/40 text-fg",
        )}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
