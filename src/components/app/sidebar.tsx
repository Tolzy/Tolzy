"use client";

import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  ChevronsUpDown,
  LayoutGrid,
  Moon,
  Palette,
  Plug,
  Plus,
  Rocket,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useAppTheme, useDb, useReleases, useSwitchWorkspace, useUsers, useWorkspace } from "@/lib/store";
import { CURRENT_USER_ID } from "@/lib/demo-data";
import { cn } from "@/lib/utils";
import { Avatar } from "../ui/avatar";
import { IconButton } from "../ui/button";
import { Kbd } from "../ui/kbd";
import { MenuItem, MenuLabel, MenuSeparator, Popover, PopoverContent, PopoverTrigger } from "../ui/menu";
import { GuardedLink, useNavGuard } from "./nav-guard";
import { useToast } from "../ui/toast";

export const NAV = [
  { href: "/app/overview", label: "Overview", icon: LayoutGrid, shortcut: "G O" },
  { href: "/app/activity", label: "Activity", icon: Activity, shortcut: "G A" },
  { href: "/app/releases", label: "Releases", icon: Rocket, shortcut: "G R" },
  { href: "/app/appearance", label: "Changelog appearance", icon: Palette, shortcut: "G P" },
  { href: "/app/integrations", label: "Integrations", icon: Plug, shortcut: "G I" },
  { href: "/app/settings", label: "Settings", icon: Settings, shortcut: "G S" },
] as const;

export function WorkspaceMark({ initials, accent, className }: { initials: string; accent?: string; className?: string }) {
  return (
    <span
      className={cn("flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white", className)}
      style={{ background: accent ?? "var(--invert)" }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

function WorkspaceSwitcher() {
  const { workspace, workspaces } = useWorkspace();
  const switchWorkspace = useSwitchWorkspace();
  const s = useDb();
  const { request } = useNavGuard();
  const toast = useToast();
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Workspace: ${workspace.name}. Switch workspace`}
        className="group flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left transition-colors hover:bg-surface-2"
      >
        <WorkspaceMark initials={workspace.initials} accent={s.appearance[workspace.id]?.accent} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-fg">{workspace.name}</span>
        </span>
        <ChevronsUpDown className="size-3.5 text-fg-faint transition-colors group-hover:text-fg-subtle" />
      </PopoverTrigger>
      <PopoverContent role="menu" label="Workspaces" className="w-[244px]">
        <MenuLabel>Workspaces</MenuLabel>
        {workspaces.map((w) => (
          <MenuItem
            key={w.id}
            checked={w.id === workspace.id}
            icon={<WorkspaceMark initials={w.initials} accent={s.appearance[w.id]?.accent} className="size-4 rounded text-[9px]" />}
            hint={w.id === workspace.id ? undefined : w.plan}
            onSelect={() =>
              w.id !== workspace.id &&
              request(() => {
                switchWorkspace(w.id);
                toast.info(`Switched to ${w.name}`);
              })
            }
          >
            {w.name}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem icon={<Plus />} disabled hint="Soon">
          New workspace
        </MenuItem>
      </PopoverContent>
    </Popover>
  );
}

export function Sidebar({ onNavigate, onOpenCommand }: { onNavigate?: () => void; onOpenCommand: () => void }) {
  const pathname = usePathname();
  const { workspace } = useWorkspace();
  const releases = useReleases();
  const users = useUsers();
  const [theme, setTheme] = useAppTheme();
  const { navigate } = useNavGuard();
  const drafts = useMemo(() => releases.filter((r) => r.status === "draft").length, [releases]);
  const me = users.get(CURRENT_USER_ID);

  return (
    <nav aria-label="Primary" className="flex h-full flex-col gap-1 px-3 py-3">
      <WorkspaceSwitcher />

      <button
        onClick={onOpenCommand}
        className="mt-2 flex h-8 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-sm text-fg-faint shadow-raised transition-colors hover:border-line-strong hover:text-fg-subtle"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Search or jump to…</span>
        <Kbd>⌘K</Kbd>
      </button>

      <ul className="mt-3 flex flex-col gap-px">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <GuardedLink
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-8 items-center gap-2.5 rounded-md px-2 text-sm font-medium transition-colors",
                  active ? "text-fg" : "text-fg-subtle hover:bg-surface-2/70 hover:text-fg",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-md border border-line bg-surface shadow-raised"
                    transition={{ type: "spring", stiffness: 550, damping: 42 }}
                  />
                )}
                <Icon className="relative size-4" strokeWidth={1.75} />
                <span className="relative flex-1 truncate">{item.label}</span>
                {item.href === "/app/releases" && drafts > 0 && (
                  <span className="relative tabular text-xs text-fg-faint" aria-label={`${drafts} drafts`}>
                    {drafts}
                  </span>
                )}
              </GuardedLink>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 px-2 text-2xs font-medium uppercase tracking-[0.06em] text-fg-faint">Public</div>
      <a
        href={`/changelog/${workspace.slug}`}
        target="_blank"
        rel="noreferrer"
        className="group mt-1 flex h-8 items-center gap-2.5 rounded-md px-2 text-sm font-medium text-fg-subtle transition-colors hover:bg-surface-2/70 hover:text-fg"
      >
        <span className="flex size-4 items-center justify-center">
          <span className="size-1.5 rounded-full bg-success" aria-hidden />
        </span>
        <span className="flex-1 truncate">View changelog</span>
        <ArrowUpRight className="size-3.5 text-fg-faint transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
      </a>
      <p className="truncate px-2 pl-[34px] font-mono text-2xs text-fg-faint">/changelog/{workspace.slug}</p>

      <div className="mt-auto flex items-center gap-2 border-t border-line px-1 pt-3">
        <Popover className="min-w-0 flex-1">
          <PopoverTrigger className="flex w-full min-w-0 items-center gap-2 rounded-md p-1 text-left transition-colors hover:bg-surface-2" aria-label="Account menu">
            <Avatar user={me} size={22} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{me?.name}</span>
          </PopoverTrigger>
          <PopoverContent role="menu" side="top" label="Account" className="w-[220px]">
            <MenuLabel>Workspace theme</MenuLabel>
            <MenuItem icon={<Sun />} checked={theme === "light"} onSelect={() => setTheme("light")}>Light</MenuItem>
            <MenuItem icon={<Moon />} checked={theme === "dark"} onSelect={() => setTheme("dark")}>Dark</MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Settings />} onSelect={() => navigate("/app/settings")}>
              Settings
            </MenuItem>
          </PopoverContent>
        </Popover>
        <IconButton
          label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          shortcut="⇧⌘L"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </IconButton>
      </div>
    </nav>
  );
}
