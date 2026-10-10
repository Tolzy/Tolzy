"use client";

import { Check, ChevronDown, GitBranch, Lock } from "lucide-react";
import { repositoryService } from "@/lib/services/mock";
import { useWorkspace } from "@/lib/store";
import { cn } from "@/lib/utils";
import { MenuItem, MenuLabel, MenuSeparator, Popover, PopoverContent, PopoverTrigger } from "../ui/menu";
import { GitHubMark } from "../ui/misc";
import { useNavGuard } from "./nav-guard";

export function Page({ children, className, wide }: { children: React.ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn("mx-auto w-full px-4 pb-24 pt-7 sm:px-6 lg:px-12 lg:pt-12", wide ? "max-w-[1360px]" : "max-w-[1160px]", className)}>{children}</div>;
}

/**
 * Page title row (title + primary actions on one line), an optional
 * description, then a quiet context row (repository, sync state).
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("pb-10", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[20px] font-semibold leading-tight tracking-[-0.022em] text-fg text-balance">{title}</h1>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {description && <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-fg-subtle text-pretty">{description}</p>}
      {eyebrow && <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-fg-subtle">{eyebrow}</div>}
    </header>
  );
}

/** Repository selector. Lists repositories connected to the workspace. */
export function RepoSelector({ compact }: { compact?: boolean }) {
  const { workspace, repositories, repository, integration } = useWorkspace();
  const { navigate } = useNavGuard();
  if (integration.status === "disconnected" || !repository) {
    return (
      <button
        onClick={() => navigate("/app/integrations")}
        className="inline-flex h-7 items-center gap-2 rounded-md border border-dashed border-line-strong px-2.5 text-xs font-medium text-fg-subtle transition-colors hover:border-fg-faint hover:text-fg"
      >
        <GitHubMark className="size-3.5" />
        Connect a repository
      </button>
    );
  }
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Repository: ${repository.fullName}. Change repository`}
        className="group inline-flex h-7 max-w-full items-center gap-2 rounded-md border border-line bg-surface px-2 text-xs transition-colors hover:border-line-strong"
      >
        <GitHubMark className="size-3.5 shrink-0 text-fg" />
        <span className="truncate font-mono text-fg">{repository.fullName}</span>
        {!compact && (
          <span className="hidden items-center gap-1 font-mono text-fg-subtle sm:inline-flex">
            <GitBranch className="size-3" />
            {repository.defaultBranch}
          </span>
        )}
        <ChevronDown className="size-3 shrink-0 text-fg-faint group-hover:text-fg-subtle" />
      </PopoverTrigger>
      <PopoverContent role="menu" label="Repositories" className="w-[300px]">
        <MenuLabel>Connected repositories</MenuLabel>
        {repositories.map((r) => (
          <MenuItem
            key={r.id}
            checked={r.id === repository.id}
            icon={r.private ? <Lock /> : <GitHubMark />}
            onSelect={() => repositoryService.setActiveRepository(workspace.id, r.id)}
          >
            <span className="font-mono text-xs">{r.fullName}</span>
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem icon={<Check className="opacity-0" />} onSelect={() => navigate("/app/integrations?select=1")}>
          Manage repositories…
        </MenuItem>
      </PopoverContent>
    </Popover>
  );
}

export function DemoTag({ className }: { className?: string }) {
  return (
    <span
      title="Shiplog is running against simulated GitHub data. No real repository is connected."
      className={cn("inline-flex h-5 items-center gap-1 rounded border border-warning/30 bg-warning-soft px-1.5 text-2xs font-medium text-warning", className)}
    >
      Demo data
    </span>
  );
}
