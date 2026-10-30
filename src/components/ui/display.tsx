"use client";

import { Collapsible, RadioGroup } from "radix-ui";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ───────────────────────── Badge ───────────────────────── */

type BadgeTone = "neutral" | "outline" | "accent" | "success" | "warning" | "viewport";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-sunken text-muted ring-1 ring-line ring-inset",
  outline: "text-muted ring-1 ring-line-strong ring-inset",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  viewport: "bg-white/[0.06] text-vp-muted ring-1 ring-white/10 ring-inset",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-2xs inline-flex h-5 shrink-0 items-center gap-1 rounded-[5px] px-1.5 font-medium [&_svg]:size-3",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ───────────────────────── Inspector section ───────────────────────── */

interface SectionProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Flat inspector section: hairline divider, small heading, no card. */
export function Section({ title, action, children, className }: SectionProps) {
  return (
    <section className={cn("border-line border-b px-4 py-3.5 last:border-b-0", className)}>
      <header className="mb-2.5 flex h-5 items-center justify-between">
        <h3 className="text-fg text-xs font-medium">{title}</h3>
        {action}
      </header>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

/** Section whose body is hidden until expanded — used for advanced settings. */
export function DisclosureSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <Collapsible.Root defaultOpen={defaultOpen} className="group/disclosure border-line border-b last:border-b-0">
      <Collapsible.Trigger className="text-fg hover:bg-hover/60 flex h-11 w-full items-center gap-1.5 px-4 text-xs font-medium">
        <ChevronRight className="text-muted size-3.5 transition-transform duration-[160ms] group-data-[state=open]/disclosure:rotate-90" />
        {title}
      </Collapsible.Trigger>
      <Collapsible.Content className="space-y-1.5 px-4 pb-4">{children}</Collapsible.Content>
    </Collapsible.Root>
  );
}

/* ───────────────────────── Empty state ───────────────────────── */

export function EmptyState({
  icon,
  title,
  description,
  actions,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-16 text-center", className)}>
      {icon && (
        <div className="bg-sunken text-muted ring-line mb-4 flex size-10 items-center justify-center rounded-lg ring-1 [&_svg]:size-5">
          {icon}
        </div>
      )}
      <h2 className="text-md text-fg font-medium">{title}</h2>
      {description && <p className="text-muted mt-1.5 max-w-sm text-sm">{description}</p>}
      {actions && <div className="mt-5 flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ───────────────────────── Preset group ───────────────────────── */

interface PresetGroupProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  columns?: 3 | 4;
  children: ReactNode;
}

/** Radio group of visual presets with arrow-key navigation. */
export function PresetGroup<T extends string>({ label, value, onChange, columns = 3, children }: PresetGroupProps<T>) {
  return (
    <RadioGroup.Root
      aria-label={label}
      value={value}
      onValueChange={(v) => onChange(v as T)}
      className={cn(
        "grid gap-x-2.5 gap-y-3",
        columns === 3
          ? "grid-cols-3 max-md:grid-cols-6 max-md:gap-x-1.5"
          : "grid-cols-4 max-md:grid-cols-6 max-md:gap-x-1.5",
      )}
    >
      {children}
    </RadioGroup.Root>
  );
}

interface PresetTileProps {
  value: string;
  label: string;
  /** Visual preview, typically a sphere swatch. */
  preview: ReactNode;
}

export function PresetTile({ value, label, preview }: PresetTileProps) {
  return (
    <RadioGroup.Item value={value} className="group flex flex-col items-center gap-1.5 rounded-lg outline-offset-2">
      <span
        className={cn(
          "relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-[#141416]",
          "group-hover:ring-line-strong ring-1 ring-black/5 transition-shadow duration-[120ms]",
          "group-data-[state=checked]:ring-accent group-data-[state=checked]:ring-offset-surface group-data-[state=checked]:ring-2 group-data-[state=checked]:ring-offset-2",
        )}
      >
        {preview}
      </span>
      <span className="text-2xs text-muted group-hover:text-fg group-data-[state=checked]:text-fg group-data-[state=checked]:font-medium">
        {label}
      </span>
    </RadioGroup.Item>
  );
}
