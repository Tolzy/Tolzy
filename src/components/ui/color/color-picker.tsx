"use client";

import { Slider as RSlider } from "radix-ui";
import { Check, ClipboardPaste, Copy, Pipette } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import {
  formatColor,
  hexToHsva,
  hsvaToHex,
  hsvaToHsla,
  hsvaToRgba,
  hslaToHsva,
  parseColor,
  rgbaToHsva,
  type ColorFormat,
  type Hsva,
} from "@/lib/color/color";
import { useRecentColors } from "@/stores/recent-colors";
import { Select } from "../overlays";

export interface ColorPickerProps {
  value: string;
  /** Called continuously while dragging (preview, not an undo step). */
  onPreview?: (hex: string) => void;
  /** Called when a change is final (release, Enter, swatch click). */
  onChange: (hex: string) => void;
  /** Show the opacity slider and field. */
  alpha?: boolean;
  /** Extra swatches (e.g. curated backgrounds) shown above recent colours. */
  swatches?: readonly { label: string; color: string }[];
  /** Accessible name prefix, e.g. "Tint". */
  label: string;
}

const FORMATS: { value: ColorFormat; label: string }[] = [
  { value: "hex", label: "HEX" },
  { value: "rgb", label: "RGB" },
  { value: "hsl", label: "HSL" },
  { value: "hsb", label: "HSB" },
];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

interface EyeDropperLike {
  open(): Promise<{ sRGBHex: string }>;
}
function eyeDropper(): (new () => EyeDropperLike) | null {
  return typeof window !== "undefined" && "EyeDropper" in window
    ? (window as unknown as { EyeDropper: new () => EyeDropperLike }).EyeDropper
    : null;
}

/**
 * Figma-style colour picker: saturation/brightness area, hue and opacity
 * sliders, HEX/RGB/HSL/HSB fields, eyedropper (where the browser supports it),
 * copy/paste and recent colours. Works in HSB internally so hue survives
 * greys and black while editing; commits canonical hex.
 */
export function ColorPicker({ value, onPreview, onChange, alpha = false, swatches, label }: ColorPickerProps) {
  const [hsva, setHsva] = useState<Hsva>(() => hexToHsva(value) ?? { h: 0, s: 0, v: 0, a: 1 });
  const [synced, setSynced] = useState(value);
  const [format, setFormat] = useState<ColorFormat>("hex");
  const [status, setStatus] = useState("");
  const recent = useRecentColors((s) => s.colors);
  const hydrate = useRecentColors((s) => s.hydrate);
  const addRecent = useRecentColors((s) => s.add);
  useEffect(hydrate, [hydrate]);

  // Follow external changes (undo, reset) unless they are our own value.
  if (synced !== value) {
    setSynced(value);
    if (value !== hsvaToHex(hsva)) setHsva(hexToHsva(value) ?? hsva);
  }

  const toHex = (c: Hsva) => hsvaToHex(alpha ? c : { ...c, a: 1 });
  const preview = (c: Hsva) => {
    setHsva(c);
    (onPreview ?? onChange)(toHex(c));
  };
  const commit = (c: Hsva = hsva) => {
    const hex = toHex(c);
    setHsva(c);
    onChange(hex);
    addRecent(hex);
  };
  const applyHex = (hex: string) => {
    const next = hexToHsva(hex);
    if (next) commit(alpha ? next : { ...next, a: 1 });
  };

  const say = (text: string) => {
    setStatus(text);
    window.setTimeout(() => setStatus((s) => (s === text ? "" : s)), 1500);
  };
  const copy = async () => {
    const text = formatColor(toHex(hsva), format);
    try {
      await navigator.clipboard.writeText(text);
      say(`Copied ${text}`);
    } catch {
      say("Copy isn’t allowed here");
    }
  };
  const paste = async () => {
    try {
      const parsed = parseColor(await navigator.clipboard.readText());
      if (parsed) {
        applyHex(parsed);
        say("Pasted");
      } else say("Clipboard has no colour");
    } catch {
      say("Paste isn’t allowed here — use ⌘V in a field");
    }
  };

  const Dropper = eyeDropper();
  const pick = async () => {
    if (!Dropper) return;
    try {
      const { sRGBHex } = await new Dropper().open();
      const parsed = parseColor(sRGBHex);
      if (parsed) applyHex(alpha ? hsvaToHex({ ...hexToHsva(parsed)!, a: hsva.a }) : parsed);
    } catch {
      // Cancelled with Escape.
    }
  };

  const hueColor = hsvaToHex({ h: hsva.h, s: 100, v: 100, a: 1 });
  const opaque = hsvaToHex({ ...hsva, a: 1 });

  return (
    <div className="flex w-[240px] flex-col gap-3" data-color-picker>
      <SpectrumArea hsva={hsva} hue={hueColor} label={label} onPreview={preview} onCommit={commit} />

      <div className="flex items-center gap-2.5">
        {Dropper && (
          <button
            type="button"
            onClick={pick}
            aria-label="Pick a colour from the screen"
            title="Eyedropper"
            className="text-muted hover:bg-hover hover:text-fg flex size-7 shrink-0 items-center justify-center rounded-md [&_svg]:size-4"
          >
            <Pipette />
          </button>
        )}
        <div className="flex flex-1 flex-col gap-2.5">
          <ChannelSlider
            label={`${label} hue slider`}
            value={hsva.h}
            max={360}
            valueText={`${Math.round(hsva.h)}°`}
            track="linear-gradient(to right,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%)"
            thumb={hueColor}
            onChange={(h) => preview({ ...hsva, h })}
            onCommit={(h) => commit({ ...hsva, h })}
          />
          {alpha && (
            <ChannelSlider
              label={`${label} opacity slider`}
              value={Math.round(hsva.a * 100)}
              max={100}
              valueText={`${Math.round(hsva.a * 100)}%`}
              track={`linear-gradient(to right, transparent, ${opaque})`}
              checker
              thumb={hsvaToHex(hsva)}
              onChange={(a) => preview({ ...hsva, a: a / 100 })}
              onCommit={(a) => commit({ ...hsva, a: a / 100 })}
            />
          )}
        </div>
        <span
          className="checker-chip ring-line relative size-7 shrink-0 overflow-hidden rounded-md ring-1"
          aria-hidden="true"
          data-testid="color-preview"
        >
          <span className="absolute inset-0" style={{ background: hsvaToHex(hsva) }} />
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="-ml-2 shrink-0">
          <Select ariaLabel="Colour format" value={format} options={FORMATS} onChange={setFormat} />
        </div>
        <ChannelInputs
          format={format}
          hsva={hsva}
          alpha={alpha}
          label={label}
          onCommit={commit}
          onPasteHex={applyHex}
        />
      </div>

      <div className="flex items-center gap-1">
        <IconAction label={`Copy ${label.toLowerCase()} colour`} onClick={copy}>
          <Copy />
        </IconAction>
        <IconAction label={`Paste ${label.toLowerCase()} colour`} onClick={paste}>
          <ClipboardPaste />
        </IconAction>
        <span role="status" aria-live="polite" className="text-2xs text-muted ml-1 truncate">
          {status}
        </span>
      </div>

      {swatches && swatches.length > 0 && (
        <SwatchRow
          title="Presets"
          colors={swatches.map((s) => s.color)}
          names={swatches.map((s) => s.label)}
          value={toHex(hsva)}
          onPick={applyHex}
        />
      )}
      <SwatchRow
        title="Recent"
        colors={recent}
        value={toHex(hsva)}
        onPick={applyHex}
        empty="Colours you choose appear here."
      />
    </div>
  );
}

/* ───────────────────────── Spectrum ───────────────────────── */

function SpectrumArea({
  hsva,
  hue,
  label,
  onPreview,
  onCommit,
}: {
  hsva: Hsva;
  hue: string;
  label: string;
  onPreview: (c: Hsva) => void;
  onCommit: (c: Hsva) => void;
}) {
  const area = useRef<HTMLDivElement>(null);

  const at = (e: PointerEvent) => {
    const r = area.current!.getBoundingClientRect();
    return {
      ...hsva,
      s: clamp(((e.clientX - r.left) / r.width) * 100, 0, 100),
      v: clamp((1 - (e.clientY - r.top) / r.height) * 100, 0, 100),
    };
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    onPreview(at(e));
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) onPreview(at(e));
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) onCommit(at(e));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 1;
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const delta = d[e.key];
    if (!delta) return;
    e.preventDefault();
    onCommit({ ...hsva, s: clamp(hsva.s + delta[0], 0, 100), v: clamp(hsva.v + delta[1], 0, 100) });
  };

  return (
    <div
      ref={area}
      role="slider"
      tabIndex={0}
      aria-label={`${label} saturation and brightness`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(hsva.s)}
      aria-valuetext={`Saturation ${Math.round(hsva.s)}%, brightness ${Math.round(hsva.v)}%`}
      data-testid="color-spectrum"
      className="relative h-[150px] w-full cursor-crosshair touch-none rounded-md outline-offset-2 select-none"
      style={{
        background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hue})`,
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onKeyDown={onKey}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute size-3.5 -translate-x-1/2 translate-y-1/2 rounded-full shadow-[0_0_0_2px_#fff,0_0_0_3px_rgb(0_0_0/0.35),inset_0_0_0_1px_rgb(0_0_0/0.2)]"
        style={{ left: `${hsva.s}%`, bottom: `${hsva.v}%`, background: hsvaToHex({ ...hsva, a: 1 }) }}
      />
    </div>
  );
}

/* ───────────────────────── Sliders ───────────────────────── */

function ChannelSlider({
  label,
  value,
  max,
  valueText,
  track,
  thumb,
  checker,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  max: number;
  valueText: string;
  track: string;
  thumb: string;
  checker?: boolean;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  return (
    <RSlider.Root
      className="relative flex h-3 w-full touch-none items-center select-none"
      value={[value]}
      min={0}
      max={max}
      step={1}
      onValueChange={([v]) => onChange(v)}
      onValueCommit={([v]) => onCommit(v)}
    >
      <RSlider.Track className={cn("relative h-3 grow overflow-hidden rounded-full", checker && "checker-chip")}>
        <span className="absolute inset-0 rounded-full" style={{ background: track }} />
      </RSlider.Track>
      <RSlider.Thumb
        aria-label={label}
        aria-valuetext={valueText}
        className="relative block size-3.5 rounded-full shadow-[0_0_0_2px_#fff,0_0_0_3px_rgb(0_0_0/0.3)] focus-visible:outline-offset-3"
        style={{ background: thumb }}
      />
    </RSlider.Root>
  );
}

/* ───────────────────────── Numeric / text inputs ───────────────────────── */

function ChannelInputs({
  format,
  hsva,
  alpha,
  label,
  onCommit,
  onPasteHex,
}: {
  format: ColorFormat;
  hsva: Hsva;
  alpha: boolean;
  label: string;
  onCommit: (c: Hsva) => void;
  onPasteHex: (hex: string) => void;
}) {
  const alphaField = alpha && (
    <NumberInput
      label={`${label} opacity percent`}
      value={Math.round(hsva.a * 100)}
      max={100}
      suffix="%"
      onCommit={(a) => onCommit({ ...hsva, a: a / 100 })}
      onPasteHex={onPasteHex}
      wide
    />
  );

  if (format === "hex") {
    return (
      <div className="flex min-w-0 flex-1 gap-1">
        <HexInput label={`${label} hex`} hsva={hsva} onPasteHex={onPasteHex} />
        {alphaField}
      </div>
    );
  }
  let channels: { key: string; label: string; value: number; max: number; set: (v: number) => Hsva }[];
  if (format === "rgb") {
    const c = hsvaToRgba(hsva);
    const set = (k: "r" | "g" | "b") => (v: number) => ({ ...rgbaToHsva({ ...c, [k]: v }), a: hsva.a });
    channels = [
      { key: "r", label: "Red", value: Math.round(c.r), max: 255, set: set("r") },
      { key: "g", label: "Green", value: Math.round(c.g), max: 255, set: set("g") },
      { key: "b", label: "Blue", value: Math.round(c.b), max: 255, set: set("b") },
    ];
  } else if (format === "hsl") {
    const c = hsvaToHsla(hsva);
    const set = (k: "h" | "s" | "l") => (v: number) => hslaToHsva({ ...c, [k]: v });
    channels = [
      { key: "h", label: "Hue", value: Math.round(c.h), max: 360, set: set("h") },
      { key: "s", label: "Saturation", value: Math.round(c.s), max: 100, set: set("s") },
      { key: "l", label: "Lightness", value: Math.round(c.l), max: 100, set: set("l") },
    ];
  } else {
    channels = [
      { key: "h", label: "Hue", value: Math.round(hsva.h), max: 360, set: (h) => ({ ...hsva, h }) },
      { key: "s", label: "Saturation", value: Math.round(hsva.s), max: 100, set: (s) => ({ ...hsva, s }) },
      { key: "v", label: "Brightness", value: Math.round(hsva.v), max: 100, set: (v) => ({ ...hsva, v }) },
    ];
  }
  return (
    <div className="flex min-w-0 flex-1 gap-1">
      {channels.map((ch) => (
        <NumberInput
          key={ch.key}
          label={`${label} ${ch.label.toLowerCase()}`}
          value={ch.value}
          max={ch.max}
          onCommit={(v) => onCommit(ch.set(v))}
          onPasteHex={onPasteHex}
        />
      ))}
      {alphaField}
    </div>
  );
}

const inputClass =
  "tabular bg-sunken ring-line focus:ring-line-strong text-fg h-7 min-w-0 rounded-md px-1.5 text-xs ring-1 outline-none ring-inset";

function useDraft(value: string) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setDraft(value);
  }
  return [draft, setDraft] as const;
}

/** Pasting any colour format into a field applies it. */
function pasteHandler(onPasteHex: (hex: string) => void) {
  return (e: React.ClipboardEvent<HTMLInputElement>) => {
    const parsed = parseColor(e.clipboardData.getData("text"));
    if (parsed) {
      e.preventDefault();
      onPasteHex(parsed);
    }
  };
}

function HexInput({ label, hsva, onPasteHex }: { label: string; hsva: Hsva; onPasteHex: (hex: string) => void }) {
  const hex = hsvaToHex({ ...hsva, a: 1 })
    .slice(1)
    .toUpperCase();
  const [draft, setDraft] = useDraft(hex);
  const commit = () => {
    const parsed = parseColor(draft.length === 6 || draft.length === 3 ? `#${draft}` : draft);
    if (parsed) onPasteHex(hsvaToHex({ ...hexToHsva(parsed)!, a: hsva.a }));
    else setDraft(hex);
  };
  return (
    <input
      aria-label={label}
      value={draft}
      spellCheck={false}
      maxLength={7}
      onChange={(e) => setDraft(e.target.value.replace("#", "").trim())}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      onPaste={pasteHandler(onPasteHex)}
      className={cn(inputClass, "flex-1 font-mono uppercase")}
    />
  );
}

function NumberInput({
  label,
  value,
  max,
  suffix,
  wide,
  onCommit,
  onPasteHex,
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  wide?: boolean;
  onCommit: (v: number) => void;
  onPasteHex: (hex: string) => void;
}) {
  const [draft, setDraft] = useDraft(String(value));
  const commit = (text = draft) => {
    const v = Number(text.replace(/[%°\s]/g, ""));
    if (Number.isFinite(v)) onCommit(clamp(Math.round(v), 0, max));
    else setDraft(String(value));
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commit();
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const step = (e.shiftKey ? 10 : 1) * (e.key === "ArrowUp" ? 1 : -1);
      commit(String(value + step));
    }
  };
  return (
    <span className={cn("relative flex min-w-0", wide ? "w-[52px] shrink-0" : "flex-1")}>
      <input
        aria-label={label}
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={onKey}
        onPaste={pasteHandler(onPasteHex)}
        className={cn(inputClass, "w-full text-center", suffix && "pr-3.5")}
      />
      {suffix && (
        <span className="text-2xs text-muted pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2">
          {suffix}
        </span>
      )}
    </span>
  );
}

/* ───────────────────────── Actions & swatches ───────────────────────── */

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="text-muted hover:bg-hover hover:text-fg flex size-7 items-center justify-center rounded-md [&_svg]:size-3.5"
    >
      {children}
    </button>
  );
}

function SwatchRow({
  title,
  colors,
  names,
  value,
  onPick,
  empty,
}: {
  title: string;
  colors: string[];
  names?: string[];
  value: string;
  onPick: (hex: string) => void;
  empty?: string;
}) {
  return (
    <div className="border-line border-t pt-2.5">
      <p className="text-2xs text-muted mb-1.5 font-medium">{title}</p>
      {colors.length === 0 ? (
        <p className="text-2xs text-subtle">{empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${title} colours`}>
          {colors.map((c, i) => (
            <li key={c + i}>
              <button
                type="button"
                aria-label={names?.[i] ?? formatColor(c, "hex")}
                title={names?.[i] ?? formatColor(c, "hex")}
                onClick={() => onPick(c)}
                className="checker-chip ring-line relative block size-5 overflow-hidden rounded-[4px] ring-1 outline-offset-2"
              >
                <span className="absolute inset-0" style={{ background: c }} />
                {c === value && (
                  <Check
                    className="absolute inset-0 m-auto size-3 text-white mix-blend-difference"
                    aria-hidden="true"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
