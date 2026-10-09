"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface PopoverCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
  id: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const Ctx = createContext<PopoverCtx | null>(null);
const usePopover = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("Popover parts must be inside <Popover>");
  return c;
};

/** Generic anchored popover with click-outside and Escape handling. */
export function Popover({ children, className, open: controlled, onOpenChange }: { children: React.ReactNode; className?: string; open?: boolean; onOpenChange?: (v: boolean) => void }) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlled ?? uncontrolled;
  const setOpen = useCallback(
    (v: boolean) => {
      if (onOpenChange) onOpenChange(v);
      if (controlled === undefined) setUncontrolled(v);
    },
    [controlled, onOpenChange],
  );
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <Ctx.Provider value={{ open, setOpen, id, triggerRef }}>
      <div ref={rootRef} className={cn("relative", className)}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function PopoverTrigger({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { open, setOpen, id, triggerRef } = usePopover();
  return (
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="true"
      aria-expanded={open}
      aria-controls={open ? id : undefined}
      onClick={() => setOpen(!open)}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" && !open) {
          e.preventDefault();
          setOpen(true);
        }
      }}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
}

export function PopoverContent({
  children,
  className,
  align = "start",
  side = "bottom",
  role = "dialog",
  label,
}: {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "end";
  side?: "bottom" | "top";
  role?: "dialog" | "menu" | "listbox";
  label?: string;
}) {
  const { open, id, setOpen, triggerRef } = usePopover();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      const first =
        ref.current?.querySelector<HTMLElement>("[data-autofocus]") ??
        ref.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"]), [role="menuitemradio"], [role="option"], input, button');
      first?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (role !== "menu") return;
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])') ?? [])];
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          id={id}
          role={role}
          aria-label={label}
          aria-labelledby={label ? undefined : triggerRef.current?.id || undefined}
          onKeyDown={onKeyDown}
          initial={{ opacity: 0, y: side === "bottom" ? -4 : 4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
          transition={{ duration: 0.16, ease: [0.25, 1, 0.5, 1] }}
          style={{ transformOrigin: `${align === "start" ? "left" : "right"} ${side === "bottom" ? "top" : "bottom"}` }}
          className={cn(
            "absolute z-[70] min-w-[200px] rounded-lg border border-line bg-surface p-1 shadow-pop",
            side === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5",
            align === "start" ? "left-0" : "right-0",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function usePopoverClose() {
  const { setOpen, triggerRef } = usePopover();
  return useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, [setOpen, triggerRef]);
}

export function MenuItem({
  children,
  icon,
  onSelect,
  disabled,
  checked,
  tone,
  hint,
  keepOpen,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  checked?: boolean;
  tone?: "danger";
  hint?: React.ReactNode;
  keepOpen?: boolean;
}) {
  const close = usePopoverClose();
  return (
    <div
      role={checked === undefined ? "menuitem" : "menuitemradio"}
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      tabIndex={-1}
      onClick={() => {
        if (disabled) return;
        onSelect?.();
        if (!keepOpen) close();
      }}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          onSelect?.();
          if (!keepOpen) close();
        }
      }}
      className={cn(
        "flex h-8 cursor-default select-none items-center gap-2.5 rounded-md px-2 text-sm outline-none transition-colors",
        "focus:bg-surface-2 hover:bg-surface-2",
        disabled && "pointer-events-none opacity-45",
        tone === "danger" ? "text-danger" : "text-fg",
      )}
    >
      {icon && <span className="flex size-4 items-center justify-center text-fg-subtle [&>svg]:size-4">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="text-xs text-fg-faint">{hint}</span>}
      {checked && <Check className="size-3.5 text-fg" aria-hidden />}
    </div>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2 pb-1 pt-2 text-2xs font-medium uppercase tracking-[0.06em] text-fg-faint">{children}</div>;
}

export function MenuSeparator() {
  return <div role="separator" className="-mx-1 my-1 h-px bg-line" />;
}
