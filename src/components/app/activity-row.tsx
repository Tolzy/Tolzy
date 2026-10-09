"use client";

import { motion } from "framer-motion";
import { ExternalLink, GitCommitHorizontal, GitPullRequest } from "lucide-react";
import { parseTitle } from "@/lib/story";
import type { ActivityItem, Release, User } from "@/lib/types";
import { cn, relativeTime, shortSha } from "@/lib/utils";
import { Avatar } from "../ui/avatar";
import { Checkbox } from "../ui/form";
import { Tooltip } from "../ui/tooltip";

const TYPE_TONE: Record<string, string> = {
  feat: "text-accent",
  fix: "text-danger",
  perf: "text-success",
  style: "text-fg-subtle",
  chore: "text-fg-faint",
  docs: "text-fg-faint",
};

export function ActivityIcon({ item, className }: { item: ActivityItem; className?: string }) {
  return item.type === "pull_request" ? (
    <GitPullRequest className={cn("size-4 text-success", className)} aria-label="Pull request" />
  ) : (
    <GitCommitHorizontal className={cn("size-4 text-fg-subtle", className)} aria-label="Commit" />
  );
}

export function ConventionalTag({ title, className }: { title: string; className?: string }) {
  const p = parseTitle(title);
  if (p.type === "other") return null;
  return (
    <span className={cn("shrink-0 font-mono text-[11px]", TYPE_TONE[p.type] ?? "text-fg-subtle", className)}>
      {p.type}
      {p.scope && <span className="text-fg-faint">({p.scope})</span>}
    </span>
  );
}

export function ActivityRow({
  item,
  author,
  release,
  selected,
  onToggle,
  compact,
  now,
  onOpenRelease,
}: {
  item: ActivityItem;
  author?: User;
  release?: Release;
  selected?: boolean;
  onToggle?: (v: boolean) => void;
  compact?: boolean;
  now?: number;
  onOpenRelease?: (r: Release) => void;
}) {
  const p = parseTitle(item.title);
  const selectable = !!onToggle;
  return (
    <motion.div
      layout="position"
      transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
      onClick={selectable ? () => onToggle!(!selected) : undefined}
      className={cn(
        "group relative flex items-start gap-3 px-4 transition-colors",
        compact ? "py-2.5" : "py-3",
        selectable && "cursor-pointer",
        selected ? "bg-accent-soft/60" : selectable && "hover:bg-surface-2/60",
      )}
    >
      {selected && <motion.span className="absolute inset-y-0 left-0 w-0.5 bg-accent" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.15 }} />}
      {selectable && (
        <span className="pt-0.5">
          <Checkbox checked={!!selected} onChange={(v) => onToggle!(v)} label={`Select ${item.title}`} />
        </span>
      )}
      <span className="pt-0.5">
        <ActivityIcon item={item} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className={cn("min-w-0 text-sm font-medium text-fg", compact && "truncate")}>{p.subject.charAt(0).toUpperCase() + p.subject.slice(1)}</span>
          <ConventionalTag title={item.title} />
        </div>
        {!compact && <p className="mt-0.5 line-clamp-1 text-xs text-fg-subtle">{item.description}</p>}
        {release && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenRelease?.(release);
            }}
            className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded border border-line bg-surface px-1.5 py-0.5 text-2xs text-fg-subtle transition-colors hover:border-line-strong hover:text-fg"
          >
            <span className={cn("size-1.5 rounded-full", release.status === "published" ? "bg-success" : release.status === "scheduled" ? "bg-warning" : "bg-fg-faint")} aria-hidden />
            <span className="truncate">
              {release.status === "published" ? "Shipped in" : "In draft"} “{release.title}”
            </span>
          </button>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3 pt-0.5">
        <span className={cn("hidden font-mono text-[11px] text-fg-faint", !compact && "md:inline")}>
          {item.type === "pull_request" ? `#${item.number}` : shortSha(item.sha)}
        </span>
        <Avatar user={author} size={18} />
        <time dateTime={item.createdAt} className="w-12 text-right text-xs tabular text-fg-faint" title={new Date(item.createdAt).toLocaleString()}>
          {relativeTime(item.createdAt, now)}
        </time>
        <Tooltip content="Open on GitHub">
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Open ${item.type === "pull_request" ? `pull request #${item.number}` : `commit ${shortSha(item.sha)}`} on GitHub`}
            className={cn("rounded p-0.5 text-fg-faint opacity-60 transition-[opacity,color] hover:text-fg group-hover:opacity-100 focus-visible:opacity-100", compact && "hidden")}
          >
            <ExternalLink className="size-3.5" />
          </a>
        </Tooltip>
      </div>
    </motion.div>
  );
}
