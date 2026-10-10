"use client";

import { ImagePlus, Link2, Shapes, Trash2, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { MediaAsset, MediaPreset } from "@/lib/types";
import { cn, isSafeUrl } from "@/lib/utils";
import { Button, IconButton } from "../ui/button";
import { Input } from "../ui/form";
import { Segmented } from "../ui/misc";
import { MediaView, PRESET_LABELS } from "./illustration";

const MAX_UPLOAD = 1.5 * 1024 * 1024;

/** Choose an image from built-in product illustrations, a URL, or an upload. */
export function MediaPicker({
  value,
  onChange,
  accent,
  label = "Image",
  compact,
}: {
  value: MediaAsset | null;
  onChange: (m: MediaAsset | null) => void;
  accent?: string;
  label?: string;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<"illustration" | "url" | "upload">("illustration");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const id = useId();

  if (value) {
    return (
      <div className="group/media relative overflow-hidden rounded-lg border border-line bg-surface-2">
        <MediaView media={value} accent={accent} />
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/media:opacity-100">
          <IconButton label={`Remove ${label.toLowerCase()}`} variant="secondary" size="sm" onClick={() => onChange(null)}>
            <Trash2 className="size-3.5" />
          </IconButton>
        </div>
        <div className="border-t border-line bg-surface px-3 py-2">
          <label htmlFor={`${id}-alt`} className="sr-only">Alt text</label>
          <input
            id={`${id}-alt`}
            value={value.alt}
            onChange={(e) => onChange({ ...value, alt: e.target.value })}
            placeholder="Describe the image for screen readers (alt text)"
            className="w-full bg-transparent text-xs text-fg-muted placeholder:text-fg-faint focus:outline-none"
          />
        </div>
      </div>
    );
  }

  const onFile = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose an image file (PNG, JPG, GIF, WebP or SVG).");
    if (file.size > MAX_UPLOAD) return setError("That image is over 1.5 MB. The prototype stores uploads in your browser, so please pick a smaller file.");
    const reader = new FileReader();
    reader.onload = () => onChange({ kind: "upload", src: String(reader.result), alt: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "), name: file.name });
    reader.onerror = () => setError("Couldn't read that file.");
    reader.readAsDataURL(file);
  };

  return (
    <div className={cn("rounded-lg border border-dashed border-line-strong bg-surface-2/40", compact ? "p-3" : "p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
          <ImagePlus className="size-3.5" aria-hidden /> {label}
        </span>
        <Segmented
          size="sm"
          label={`${label} source`}
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(null);
          }}
          options={[
            { value: "illustration", label: "Screens", icon: <Shapes /> },
            { value: "url", label: "URL", icon: <Link2 /> },
            { value: "upload", label: "Upload", icon: <Upload /> },
          ]}
        />
      </div>
      <div className="mt-3">
        {mode === "illustration" && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {(Object.keys(PRESET_LABELS) as MediaPreset[]).map((p) => (
              <button
                key={p}
                type="button"
                data-media-option
                onClick={() => onChange({ kind: "illustration", preset: p, alt: PRESET_LABELS[p] })}
                className="group/p overflow-hidden rounded-md border border-line bg-surface text-left transition-[border-color,transform] hover:border-accent active:scale-[0.98]"
              >
                <div className="pointer-events-none">
                  <MediaView media={{ kind: "illustration", preset: p, alt: "" }} accent={accent} />
                </div>
                <span className="block truncate border-t border-line px-1.5 py-1 text-[10.5px] text-fg-subtle group-hover/p:text-fg">{PRESET_LABELS[p]}</span>
              </button>
            ))}
          </div>
        )}
        {mode === "url" && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!isSafeUrl(url)) return setError("Enter a full image URL starting with https://");
              onChange({ kind: "url", src: url, alt: "" });
              setUrl("");
            }}
          >
            <div className="flex-1">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/screenshot.png" aria-label="Image URL" aria-invalid={!!error} />
            </div>
            <Button type="submit">Add</Button>
          </form>
        )}
        {mode === "upload" && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onFile(e.dataTransfer.files[0]);
            }}
            className="flex flex-col items-center justify-center gap-2 rounded-md border border-line bg-surface py-6 text-center"
          >
            <p className="text-sm text-fg-muted">Drop an image here, or</p>
            <Button size="sm" onClick={() => fileRef.current?.click()} icon={<Upload className="size-3.5" />}>
              Choose file
            </Button>
            <p className="text-2xs text-fg-faint">Up to 1.5 MB · stored locally in this browser</p>
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
        )}
        {error && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
