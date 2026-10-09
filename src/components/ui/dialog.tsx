"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Traps focus inside `ref` while active and restores it on close. */
export function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean, initialFocus?: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active) return;
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const raf = requestAnimationFrame(() => {
      const target = initialFocus?.current ?? node?.querySelector<HTMLElement>("[data-autofocus]") ?? node?.querySelector<HTMLElement>(FOCUSABLE);
      (target ?? node)?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !node) return;
      const els = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [active, ref, initialFocus]);
}

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  initialFocus?: React.RefObject<HTMLElement | null>;
  /** Hide the visible header (title still announced to screen readers). */
  bare?: boolean;
  className?: string;
}

export function Dialog({ open, onClose, title, description, children, footer, size = "md", initialFocus, bare, className }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useFocusTrap(ref, open, initialFocus);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 pt-[12vh]">
          <motion.div
            className="fixed inset-0 bg-[rgb(10_10_9/0.38)] backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
            className={cn(
              "relative w-full rounded-xl border border-line bg-surface shadow-pop outline-none",
              size === "sm" && "max-w-sm",
              size === "md" && "max-w-lg",
              size === "lg" && "max-w-2xl",
              className,
            )}
          >
            {bare ? (
              <h2 id={titleId} className="sr-only">
                {title}
              </h2>
            ) : (
              <div className="flex items-start gap-4 px-5 pt-5">
                <div className="min-w-0 flex-1">
                  <h2 id={titleId} className="text-md font-semibold tracking-[-0.01em] text-fg">
                    {title}
                  </h2>
                  {description && (
                    <p id={descId} className="mt-1 text-sm text-fg-subtle">
                      {description}
                    </p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="-mr-1.5 -mt-1 rounded-md p-1.5 text-fg-faint transition-colors hover:bg-surface-2 hover:text-fg"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}
            {children && <div className={cn(!bare && "px-5 pb-5 pt-4")}>{children}</div>}
            {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Confirmation dialog for destructive or state-changing actions. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "default",
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  tone?: "default" | "danger";
  loading?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            className="h-8 rounded-md px-3 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            Cancel
          </button>
          <button
            data-autofocus
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "h-8 rounded-md px-3 text-sm font-medium transition-[background-color,transform] active:scale-[0.97] disabled:opacity-50",
              tone === "danger" ? "bg-danger text-white hover:bg-danger/90" : "bg-invert text-invert-fg hover:opacity-90",
            )}
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </>
      }
    />
  );
}
