"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cloneElement, isValidElement, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Kbd } from "./kbd";

type Side = "top" | "bottom" | "left" | "right";

const pos: Record<Side, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
  left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
  right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
};

const offset: Record<Side, { x?: number; y?: number }> = {
  top: { y: 3 },
  bottom: { y: -3 },
  left: { x: 3 },
  right: { x: -3 },
};

/** Lightweight tooltip shown on hover (after a short delay) and on keyboard focus. */
export function Tooltip({
  content,
  shortcut,
  side = "top",
  children,
  className,
}: {
  content: React.ReactNode;
  shortcut?: string;
  side?: Side;
  children: React.ReactElement;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  const show = (delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  const child = isValidElement<React.HTMLAttributes<HTMLElement>>(children)
    ? cloneElement(children, { "aria-describedby": open ? id : undefined })
    : children;

  return (
    <span
      className={cn("relative inline-flex", className)}
      onPointerEnter={(e) => e.pointerType === "mouse" && show(450)}
      onPointerLeave={hide}
      onFocus={(e) => {
        if ((e.target as HTMLElement).matches(":focus-visible")) show(0);
      }}
      onBlur={hide}
      onKeyDown={(e) => e.key === "Escape" && hide()}
      onPointerDown={hide}
    >
      {child}
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            id={id}
            initial={{ opacity: 0, ...offset[side] }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ duration: 0.14, ease: [0.25, 1, 0.5, 1] }}
            className={cn(
              "pointer-events-none absolute z-[80] flex items-center gap-2 whitespace-nowrap rounded-md bg-invert px-2 py-1 text-xs font-medium text-invert-fg shadow-pop",
              pos[side],
            )}
          >
            {content}
            {shortcut && <Kbd className="border-transparent bg-white/15 text-inherit">{shortcut}</Kbd>}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
