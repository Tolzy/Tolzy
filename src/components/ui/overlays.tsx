"use client";

import { Dialog as D, DropdownMenu as M, Select as S } from "radix-ui";
import { Check, ChevronDown, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

/* ───────────────────────── Dialog ───────────────────────── */

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg";
}

const widths = {
  sm: "max-w-[400px]",
  md: "max-w-[520px]",
  lg: "max-w-[680px]",
};

export function Dialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  width = "md",
}: DialogProps) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <D.Trigger asChild>{trigger}</D.Trigger>}
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-[rgb(16_16_18/0.28)]" />
        <D.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2",
            "border-line bg-surface shadow-dialog rounded-xl border outline-none",
            widths[width],
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-5">
            <div>
              <D.Title className="text-md font-semibold tracking-[-0.01em]">{title}</D.Title>
              {description ? (
                <D.Description className="text-muted mt-1 text-sm">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{title}</D.Description>
              )}
            </div>
            <D.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label="Close" className="-mr-2">
                <X />
              </Button>
            </D.Close>
          </div>
          {children && <div className="px-6 py-5">{children}</div>}
          {footer && (
            <div className="border-line flex items-center justify-end gap-2 border-t px-6 py-3.5">{footer}</div>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export const DialogClose = D.Close;

/* ───────────────────────── Menu ───────────────────────── */

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;

export function MenuContent({ children, align = "end" }: { children: ReactNode; align?: "start" | "end" }) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={6}
        collisionPadding={8}
        className="border-line bg-surface shadow-float z-50 min-w-[200px] rounded-lg border p-1"
      >
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function MenuItem({
  children,
  icon,
  shortcut,
  danger,
  disabled,
  onSelect,
}: {
  children: ReactNode;
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  return (
    <M.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm outline-none select-none [&_svg]:size-4",
        danger ? "text-danger data-[highlighted]:bg-danger-soft" : "text-fg data-[highlighted]:bg-hover",
        "data-[disabled]:opacity-45",
      )}
    >
      {icon && <span className={danger ? "text-danger" : "text-muted"}>{icon}</span>}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="text-muted text-xs">{shortcut}</span>}
    </M.Item>
  );
}

export function MenuSeparator() {
  return <M.Separator className="bg-line my-1 h-px" />;
}

/* ───────────────────────── Select ───────────────────────── */

interface SelectProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
  /** Text shown before the value, e.g. "Sort". */
  prefix?: string;
}

export function Select<T extends string>({ value, options, onChange, ariaLabel, prefix }: SelectProps<T>) {
  return (
    <S.Root value={value} onValueChange={(v) => onChange(v as T)}>
      <S.Trigger
        aria-label={ariaLabel}
        className={cn(
          "text-fg inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm",
          "hover:bg-hover data-[state=open]:bg-hover",
        )}
      >
        {prefix && <span className="text-muted">{prefix}</span>}
        <S.Value />
        <S.Icon>
          <ChevronDown className="text-muted size-3.5" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={6}
          align="end"
          className="border-line bg-surface shadow-float z-50 min-w-[180px] rounded-lg border p-1"
        >
          <S.Viewport>
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                className="data-[highlighted]:bg-hover flex h-8 items-center justify-between gap-4 rounded-md px-2 text-sm outline-none select-none"
              >
                <S.ItemText>{o.label}</S.ItemText>
                <S.ItemIndicator>
                  <Check className="text-fg size-4" />
                </S.ItemIndicator>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
