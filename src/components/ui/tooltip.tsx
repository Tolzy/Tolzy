"use client";

import { Tooltip as T } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Kbd } from "./kbd";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <T.Provider delayDuration={400} skipDelayDuration={200}>
      {children}
    </T.Provider>
  );
}

interface TooltipProps {
  content: ReactNode;
  /** Keyboard shortcut shown after the label, e.g. ["⌘", "Z"]. */
  shortcut?: string[];
  side?: "top" | "right" | "bottom" | "left";
  children: ReactNode;
}

export function Tooltip({ content, shortcut, side = "bottom", children }: TooltipProps) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "z-50 flex items-center gap-2 rounded-md bg-[#1c1c1f] px-2 py-1 text-xs text-[#f2f2f1]",
            "shadow-float",
          )}
        >
          {content}
          {shortcut && <Kbd keys={shortcut} tone="dark" />}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
