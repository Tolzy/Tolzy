import { cn } from "@/lib/cn";

/** Product mark: a sphere inside an orbit — a head in a 3D space. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "bg-primary text-primary-fg inline-flex size-6 items-center justify-center rounded-[7px]",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="size-[18px]">
        <ellipse
          cx="12"
          cy="12"
          rx="8.25"
          ry="3.4"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="1.25"
          transform="rotate(-18 12 12)"
        />
        <circle cx="12" cy="12" r="4.1" fill="currentColor" />
      </svg>
    </span>
  );
}

export function Brand() {
  return (
    <span className="flex items-center gap-2">
      <BrandMark />
      <span className="text-sm font-semibold tracking-[-0.01em]">Portrait Studio</span>
    </span>
  );
}
