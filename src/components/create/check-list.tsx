import { CircleAlert, CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CheckStatus, PhotoCheck, PhotoResult } from "@/lib/photos/types";

const ICON: Record<CheckStatus, React.ReactNode> = {
  pass: <CircleCheck className="text-success" aria-hidden="true" />,
  warn: <CircleAlert className="text-warning" aria-hidden="true" />,
  fail: <CircleX className="text-danger" aria-hidden="true" />,
};
const SR: Record<CheckStatus, string> = { pass: "Passed", warn: "Suggestion", fail: "Problem" };

export function CheckList({ checks, compact }: { checks: PhotoCheck[]; compact?: boolean }) {
  return (
    <ul className={cn("space-y-2", compact && "space-y-1.5")}>
      {checks.map((c) => (
        <li
          key={c.id}
          data-check={c.id}
          data-status={c.status}
          className="flex gap-2.5 [&_svg]:mt-px [&_svg]:size-4 [&_svg]:shrink-0"
        >
          {ICON[c.status]}
          <span className="min-w-0 text-sm">
            <span className="sr-only">{SR[c.status]}: </span>
            <span className="text-fg font-medium">{c.label}</span>
            <span className="text-muted"> — {c.message}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** One-line summary for a photo's state. */
export function PhotoStatus({ checking, result }: { checking: boolean; result: PhotoResult | null }) {
  if (checking || !result)
    return (
      <span className="text-muted inline-flex items-center gap-1.5 text-xs">
        <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        Checking…
      </span>
    );
  const warnings = result.checks.filter((c) => c.status === "warn").length;
  const text =
    result.status === "fail"
      ? "Can’t use this photo"
      : warnings
        ? `Usable · ${warnings} suggestion${warnings > 1 ? "s" : ""}`
        : result.faceChecksRan
          ? "Looks good"
          : "Checked (no face check)";
  return (
    <span
      data-photo-status={result.status}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium [&_svg]:size-3.5",
        result.status === "fail" ? "text-danger" : result.status === "warn" ? "text-warning" : "text-success",
      )}
    >
      {ICON[result.status]}
      {text}
    </span>
  );
}
