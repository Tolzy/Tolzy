"use client";

import { Popover } from "radix-ui";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { alphaOf, formatColor, opaqueHex, parseColor, withAlpha } from "@/lib/color/color";
import { useRecentColors } from "@/stores/recent-colors";
import { Field } from "../controls";
import { ColorPicker } from "./color-picker";

interface ColorFieldProps {
  label: string;
  /** "#rrggbb" or "#rrggbbaa". */
  value: string;
  /** Final change (one undo step). */
  onChange: (hex: string) => void;
  /** Continuous change while dragging in the picker. Falls back to onChange. */
  onPreview?: (hex: string) => void;
  /** Whether this target supports opacity. */
  alpha?: boolean;
  swatches?: readonly { label: string; color: string }[];
  disabled?: boolean;
}

/**
 * Inspector colour row: a swatch that opens the full colour picker, an
 * editable value (accepts any pasted colour format) and, when supported,
 * opacity. Replaces the native colour input.
 */
export function ColorField({ label, value, onChange, onPreview, alpha = false, swatches, disabled }: ColorFieldProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const addRecent = useRecentColors((s) => s.add);
  const hex = opaqueHex(value).slice(1).toUpperCase();
  const [draft, setDraft] = useState(hex);
  const [synced, setSynced] = useState(hex);
  if (synced !== hex) {
    setSynced(hex);
    setDraft(hex);
  }

  const commitText = () => {
    const text = draft.trim();
    const parsed = parseColor(/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(text) ? `#${text}` : text);
    if (!parsed) return setDraft(hex);
    // Typed colours without alpha keep the current opacity.
    const next = alpha ? (parsed.length === 9 ? parsed : withAlpha(parsed, alphaOf(value))) : opaqueHex(parsed);
    if (next !== value) {
      onChange(next);
      addRecent(next);
    }
    setDraft(opaqueHex(next).slice(1).toUpperCase());
  };

  return (
    <Field label={label} htmlFor={id}>
      <div
        className={cn(
          "bg-sunken ring-line focus-within:ring-line-strong flex h-7 items-center gap-2 rounded-md pr-2 pl-1 ring-1 ring-inset",
          disabled && "opacity-45",
        )}
      >
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger
            disabled={disabled}
            aria-label={`${label} colour picker, ${formatColor(value, "hex")}`}
            className="checker-chip ring-line relative size-5 shrink-0 cursor-pointer overflow-hidden rounded-[4px] ring-1 outline-offset-2"
          >
            <span className="absolute inset-0" style={{ background: value }} />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              side="left"
              align="start"
              sideOffset={12}
              collisionPadding={12}
              aria-label={`${label} colour`}
              className="border-line bg-surface shadow-float z-50 rounded-xl border p-3 outline-none"
              onOpenAutoFocus={(e) => {
                // Focus the spectrum, not the first button.
                e.preventDefault();
                (e.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-testid=color-spectrum]")?.focus();
              }}
            >
              <ColorPicker
                label={label}
                value={value}
                alpha={alpha}
                swatches={swatches}
                onChange={onChange}
                onPreview={onPreview}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <input
          id={id}
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value.replace("#", ""))}
          onBlur={commitText}
          onKeyDown={(e) => e.key === "Enter" && commitText()}
          onPaste={(e) => {
            const parsed = parseColor(e.clipboardData.getData("text"));
            if (parsed && !/^#?[0-9a-f]{3,8}$/i.test(e.clipboardData.getData("text").trim())) {
              e.preventDefault();
              setDraft(parsed);
              const next = alpha ? parsed : opaqueHex(parsed);
              onChange(next);
              addRecent(next);
            }
          }}
          spellCheck={false}
          maxLength={32}
          className="tabular text-fg w-full min-w-0 bg-transparent font-mono text-xs uppercase outline-none"
        />
        {alpha && (
          <span className="tabular text-muted shrink-0 text-xs">
            <span className="sr-only">{label} opacity </span>
            {Math.round(alphaOf(value) * 100)}%
          </span>
        )}
      </div>
    </Field>
  );
}
