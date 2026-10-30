import { Slot } from "radix-ui";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "viewport";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Square button that only holds an icon. Requires an aria-label. */
  iconOnly?: boolean;
  /** Render the child element (e.g. a Link) with button styling. */
  asChild?: boolean;
}

const base =
  "inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap font-medium " +
  "transition-[background-color,border-color,color,box-shadow] duration-[120ms] ease-out " +
  "disabled:pointer-events-none disabled:opacity-45 aria-disabled:cursor-default aria-disabled:opacity-45 " +
  "[&_svg]:size-4 [&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-fg text-inverse hover:bg-[#2c2c30] active:bg-[#3a3a3f]",
  secondary:
    "border border-line bg-surface text-fg shadow-[0_1px_0_rgb(16_16_18/0.03)] hover:border-line-strong hover:bg-hover active:bg-active",
  ghost: "text-muted hover:bg-hover hover:text-fg active:bg-active",
  danger: "bg-danger text-white hover:bg-[#b23126]",
  viewport:
    "text-vp-muted hover:bg-vp-chrome-hover hover:text-vp-fg aria-pressed:bg-vp-chrome-hover aria-pressed:text-vp-fg",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-7 rounded-md px-2.5 text-xs",
  md: "h-8 rounded-md px-3 text-sm",
  lg: "h-10 rounded-lg px-4 text-base",
};

const iconSizes: Record<ButtonSize, string> = {
  sm: "size-7 rounded-md",
  md: "size-8 rounded-md",
  lg: "size-10 rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", iconOnly, asChild, className, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? "button")}
      className={cn(base, variants[variant], iconOnly ? iconSizes[size] : sizes[size], className)}
      {...props}
    />
  );
});
