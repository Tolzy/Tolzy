"use client";

import { Checkbox as RCheckbox, Slider as RSlider, Switch as RSwitch, ToggleGroup } from "radix-ui";
import { Check } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ───────────────────────── Field row ───────────────────────── */

interface FieldProps {
  label: string;
  /** id of the control the label points at (omit for groups). */
  htmlFor?: string;
  /** id applied to the label element so groups can use aria-labelledby. */
  labelId?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Two-column inspector row: muted label on the left, control on the right. */
export function Field({ label, htmlFor, labelId, hint, children, className }: FieldProps) {
  return (
    <div className={cn("grid min-h-8 grid-cols-[84px_minmax(0,1fr)] items-center gap-x-3", className)}>
      <label id={labelId} htmlFor={htmlFor} className="text-muted truncate text-xs">
        {label}
      </label>
      <div className="min-w-0">{children}</div>
      {hint && <p className="text-2xs text-muted col-start-2 mt-1">{hint}</p>}
    </div>
  );
}

/* ───────────────────────── Slider ───────────────────────── */

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Formats the numeric readout, e.g. (v) => `±${v}°`. */
  format?: (value: number) => string;
  onChange: (value: number) => void;
  /** Called once when the user finishes a drag or keyboard change. */
  onCommit?: (value: number) => void;
  disabled?: boolean;
}

export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  format = (v) => String(v),
  onChange,
  onCommit,
  disabled,
}: SliderFieldProps) {
  const labelId = useId();
  return (
    <Field label={label} labelId={labelId}>
      <div className="flex items-center gap-3">
        <RSlider.Root
          className="relative flex h-5 flex-1 touch-none items-center select-none data-[disabled]:opacity-45"
          value={[value]}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-labelledby={labelId}
          onValueChange={([v]) => onChange(v)}
          onValueCommit={([v]) => onCommit?.(v)}
        >
          <RSlider.Track className="bg-active relative h-[3px] grow overflow-hidden rounded-full">
            <RSlider.Range className="bg-fg absolute h-full rounded-full" />
          </RSlider.Track>
          <RSlider.Thumb
            aria-labelledby={labelId}
            aria-valuetext={format(value)}
            className={cn(
              "border-line-strong bg-thumb shadow-soft block size-3.5 rounded-full border",
              "transition-transform duration-[120ms] hover:scale-110 focus-visible:outline-offset-1",
            )}
          />
        </RSlider.Root>
        <output className="tabular text-fg w-11 shrink-0 text-right text-xs">{format(value)}</output>
      </div>
    </Field>
  );
}

/* ───────────────────────── Segmented control ───────────────────────── */

interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible name when label is an icon. */
  ariaLabel?: string;
  disabled?: boolean;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  size?: "sm" | "md";
  className?: string;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  ariaLabelledBy,
  size = "sm",
  className,
}: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cn(
        "bg-sunken ring-line flex w-full rounded-md p-0.5 ring-1 ring-inset",
        size === "sm" ? "h-7" : "h-8",
        className,
      )}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          aria-label={o.ariaLabel}
          className={cn(
            "text-muted flex flex-1 items-center justify-center gap-1.5 rounded-[5px] px-2 text-xs",
            "hover:text-fg transition-colors duration-[120ms] disabled:opacity-45 [&_svg]:size-3.5",
            "data-[state=on]:bg-segment data-[state=on]:text-fg data-[state=on]:shadow-[var(--shadow-soft),0_0_0_1px_var(--border)]",
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

/* ───────────────────────── Switch ───────────────────────── */

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export function Switch({ checked, onChange, id, disabled, ariaLabel }: SwitchProps) {
  return (
    <RSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "bg-line-strong relative inline-flex h-[18px] w-[30px] shrink-0 items-center rounded-full",
        "data-[state=checked]:bg-primary transition-colors duration-[120ms] disabled:opacity-45",
      )}
    >
      <RSwitch.Thumb
        className={cn(
          "shadow-soft data-[state=checked]:bg-primary-fg block size-3.5 translate-x-0.5 rounded-full bg-white",
          "transition-transform duration-[160ms] ease-out data-[state=checked]:translate-x-[14px]",
        )}
      />
    </RSwitch.Root>
  );
}

/** A full-width row with a label and a trailing switch. */
export function SwitchRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex min-h-8 items-center justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-fg block text-xs">
          {label}
        </label>
        {description && <p className="text-2xs text-muted mt-0.5">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

/* ───────────────────────── Checkbox ───────────────────────── */

export function Checkbox({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <RCheckbox.Root
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v === true)}
        className={cn(
          "bg-surface ring-line-strong mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] ring-1 ring-inset",
          "data-[state=checked]:bg-primary data-[state=checked]:ring-primary transition-colors duration-[120ms] disabled:opacity-45",
        )}
      >
        <RCheckbox.Indicator>
          <Check className="text-primary-fg size-3" strokeWidth={2.5} />
        </RCheckbox.Indicator>
      </RCheckbox.Root>
      <label htmlFor={id} className={cn("text-fg text-sm", disabled && "opacity-60")}>
        {children}
      </label>
    </div>
  );
}
