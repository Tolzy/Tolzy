import { cn } from "@/lib/cn";

export function Kbd({ keys, tone = "light" }: { keys: string[]; tone?: "light" | "dark" }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {keys.map((k) => (
        <kbd
          key={k}
          className={cn(
            "text-2xs inline-flex h-4 min-w-4 items-center justify-center rounded-sm px-1 font-sans",
            tone === "light" ? "bg-sunken text-muted ring-line ring-1" : "bg-white/10 text-white/70",
          )}
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}
