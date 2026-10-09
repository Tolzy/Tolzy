import { cn } from "@/lib/utils";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-line bg-surface-2 px-1 font-sans text-[10.5px] font-medium leading-none text-fg-subtle",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
