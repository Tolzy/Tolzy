"use client";

import { ChevronDown } from "lucide-react";
import { forwardRef, useEffect, useId, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-md border border-line bg-surface text-fg placeholder:text-fg-faint transition-[border-color,box-shadow] duration-150 " +
  "hover:border-line-strong focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { leading?: React.ReactNode }>(
  function Input({ className, leading, ...props }, ref) {
    if (leading) {
      return (
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 flex -translate-y-1/2 text-fg-faint [&>svg]:size-3.5">{leading}</span>
          <input ref={ref} className={cn(fieldBase, "h-8 pl-8 pr-2.5 text-sm", className)} {...props} />
        </div>
      );
    }
    return <input ref={ref} className={cn(fieldBase, "h-8 px-2.5 text-sm", className)} {...props} />;
  },
);

/** Textarea that grows with its content. */
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { autoGrow?: boolean; bare?: boolean }>(
  function Textarea({ className, autoGrow = true, bare, value, ...props }, forwarded) {
    const inner = useRef<HTMLTextAreaElement | null>(null);
    useEffect(() => {
      const el = inner.current;
      if (!el || !autoGrow) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, [value, autoGrow]);
    return (
      <textarea
        ref={(el) => {
          inner.current = el;
          if (typeof forwarded === "function") forwarded(el);
          else if (forwarded) forwarded.current = el;
        }}
        value={value}
        rows={1}
        className={cn(
          bare
            ? "w-full resize-none bg-transparent text-fg placeholder:text-fg-faint focus:outline-none"
            : cn(fieldBase, "min-h-[72px] px-2.5 py-2 text-sm"),
          autoGrow && "resize-none overflow-hidden",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(fieldBase, "h-8 appearance-none pl-2.5 pr-8 text-sm", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-faint" aria-hidden />
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-fg-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-fg-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  checked,
  indeterminate,
  onChange,
  label,
  className,
  disabled,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (v: boolean) => void;
  label: string;
  className?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  const on = checked || indeterminate;
  return (
    <span className={cn("relative inline-flex size-4 shrink-0", className)}>
      <input
        ref={ref}
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        onClick={(e) => e.stopPropagation()}
        className="peer absolute inset-0 z-10 m-0 cursor-pointer appearance-none rounded-[4px] disabled:cursor-not-allowed"
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none flex size-4 items-center justify-center rounded-[4px] border transition-[background-color,border-color] duration-150",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-surface",
          on ? "border-accent bg-accent text-accent-fg" : "border-line-strong bg-surface peer-hover:border-fg-faint",
        )}
      >
        {on && (
          <svg viewBox="0 0 12 12" className="size-3" fill="none">
            {indeterminate && !checked ? (
              <path d="M3 6h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            ) : (
              <motion.path
                d="M2.5 6.2 5 8.5l4.5-5"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
              />
            )}
          </svg>
        )}
      </span>
    </span>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs text-fg-subtle">{description}</p>}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 disabled:opacity-50",
          checked ? "bg-accent" : "bg-surface-3",
        )}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 700, damping: 40 }}
          className={cn("size-4 rounded-full bg-white shadow-raised", checked && "ml-auto")}
        />
      </button>
    </div>
  );
}
