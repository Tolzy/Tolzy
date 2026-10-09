"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";
import { Tooltip } from "./tooltip";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-invert text-invert-fg hover:bg-[color-mix(in_srgb,var(--invert)_86%,var(--canvas))] shadow-raised",
  accent: "bg-accent text-accent-fg hover:bg-accent-hover shadow-raised",
  secondary:
    "bg-surface text-fg border border-line hover:border-line-strong hover:bg-surface-2 shadow-raised",
  ghost: "text-fg-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-surface text-danger border border-line hover:border-danger/40 hover:bg-danger-soft",
};

const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5 rounded-md",
  md: "h-8 px-3 text-sm gap-2 rounded-md",
  lg: "h-10 px-4 text-sm gap-2 rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, trailing, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium",
        "transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-out",
        "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner className="size-3.5" /> : icon}
      {children}
      {trailing}
    </button>
  );
});

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  shortcut?: string;
  size?: "sm" | "md";
  variant?: "ghost" | "secondary";
  tooltipSide?: "top" | "bottom" | "left" | "right";
}

/** Icon-only button. Always has an accessible label and a tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, shortcut, size = "md", variant = "ghost", tooltipSide = "top", className, children, ...props },
  ref,
) {
  return (
    <Tooltip content={label} shortcut={shortcut} side={tooltipSide}>
      <button
        ref={ref}
        aria-label={label}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md transition-[background-color,color,transform] duration-150",
          "active:scale-[0.92] disabled:pointer-events-none disabled:opacity-40",
          size === "sm" ? "size-6" : "size-8",
          variant === "ghost"
            ? "text-fg-subtle hover:bg-surface-2 hover:text-fg"
            : "border border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    </Tooltip>
  );
});
