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
  primary: "bg-primary text-primary-fg hover:bg-primary-hover active:bg-primary-active",
  secondary:
    "border border-line bg-surface text-fg shadow-soft hover:border-line-strong hover:bg-hover active:bg-active",
  ghost: "text-muted hover:bg-hover hover:text-fg active:bg-active",
  danger: "bg-danger text-primary-fg hover:bg-danger-hover",
  // Floating controls over the 3D viewport: follow the app theme.
  viewport:
    "text-float-muted hover:bg-float-hover hover:text-float-fg aria-pressed:bg-float-hover aria-pressed:text-float-fg",
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
