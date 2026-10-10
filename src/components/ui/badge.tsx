import type { Category, ReleaseStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "outline";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-muted",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  outline: "border border-line text-fg-subtle",
};

export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-1.5 text-2xs font-medium", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  feature: { label: "Feature", color: "#2856C5" },
  improvement: { label: "Improvement", color: "#6A4BC4" },
  fix: { label: "Fix", color: "#B42318" },
  performance: { label: "Performance", color: "#267447" },
  security: { label: "Security", color: "#946200" },
  other: { label: "Other", color: "#737373" },
};

export const CATEGORIES = Object.keys(CATEGORY_META) as Category[];

/** Category label used in the app. A small coloured mark keeps colour use restrained. */
export function CategoryBadge({ category, className }: { category: Category; className?: string }) {
  const meta = CATEGORY_META[category];
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 whitespace-nowrap text-xs text-fg-subtle", className)}>
      <span className="size-1.5 rounded-full" style={{ background: meta.color }} aria-hidden />
      {meta.label}
    </span>
  );
}

const STATUS: Record<ReleaseStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  scheduled: { label: "Scheduled", tone: "warning" },
  published: { label: "Published", tone: "success" },
};

const STATUS_DOT: Record<ReleaseStatus, string> = {
  draft: "border border-fg-faint bg-transparent",
  scheduled: "bg-warning",
  published: "bg-success",
};

/** Release status: a small state dot plus label. Animates when the status changes. */
export function StatusBadge({ status, className }: { status: ReleaseStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 whitespace-nowrap text-xs", status === "draft" ? "text-fg-subtle" : status === "scheduled" ? "text-warning" : "text-success", className)}>
      <span key={status} className={cn("size-[7px] shrink-0 rounded-full animate-[pop_240ms_cubic-bezier(0.25,1,0.5,1)]", STATUS_DOT[status])} aria-hidden />
      {s.label}
    </span>
  );
}
