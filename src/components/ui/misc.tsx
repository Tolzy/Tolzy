"use client";

import { motion } from "framer-motion";
import { useId } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={cn("skeleton rounded", className)} style={style} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  tone = "default",
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  tone?: "default" | "error";
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && (
        <div
          className={cn(
            "mb-4 flex size-10 items-center justify-center rounded-lg border [&>svg]:size-[18px]",
            tone === "error" ? "border-danger/25 bg-danger-soft text-danger" : "border-line bg-surface text-fg-subtle",
          )}
        >
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-subtle text-pretty">{description}</p>}
      {action && <div className="mt-5 flex items-center gap-2">{action}</div>}
    </div>
  );
}

/** Segmented control with an animated active indicator. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; icon?: React.ReactNode; title?: string }[];
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex items-center rounded-md border border-line bg-surface-2 p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const idx = options.findIndex((x) => x.value === value);
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                onChange(options[(idx + 1) % options.length].value);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                onChange(options[(idx - 1 + options.length) % options.length].value);
              }
            }}
            tabIndex={active ? 0 : -1}
            className={cn(
              "relative flex items-center justify-center gap-1.5 rounded-[5px] font-medium transition-colors",
              size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-sm",
              active ? "text-fg" : "text-fg-subtle hover:text-fg",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[5px] border border-line bg-surface shadow-raised"
                transition={{ type: "spring", stiffness: 600, damping: 40 }}
              />
            )}
            <span className="relative flex items-center gap-1.5 [&>svg]:size-3.5">
              {o.icon}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Underlined tab bar with an animated indicator. */
export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: React.ReactNode; count?: number }[];
  label: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div role="tablist" aria-label={label} className={cn("flex items-center gap-5 border-b border-line", className)}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => {
              const idx = tabs.findIndex((x) => x.value === value);
              if (e.key === "ArrowRight") onChange(tabs[(idx + 1) % tabs.length].value);
              if (e.key === "ArrowLeft") onChange(tabs[(idx - 1 + tabs.length) % tabs.length].value);
            }}
            className={cn(
              "relative -mb-px flex h-9 items-center gap-1.5 text-sm font-medium transition-colors",
              active ? "text-fg" : "text-fg-subtle hover:text-fg",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="tabular text-xs text-fg-faint">{t.count}</span>}
            {active && (
              <motion.span
                layoutId={`tab-${id}`}
                className="absolute inset-x-0 bottom-0 h-[1.5px] bg-fg"
                transition={{ type: "spring", stiffness: 600, damping: 44 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/** Shiplog brand mark: a log line becoming a ship's wake. */
export function ShiplogMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden>
      <rect width="20" height="20" rx="5" fill="currentColor" />
      <path d="M5 7h7M5 10h10M5 13h5" stroke="var(--canvas)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function SectionHeader({ title, description, action, className, id }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-sm font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-fg-subtle">{description}</p>}
      </div>
      {action}
    </div>
  );
}
