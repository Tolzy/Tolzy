"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, CornerDownLeft, Link2, Moon, Plus, RefreshCw, Rocket, Search, Sun } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { publishingService, repositoryService } from "@/lib/services/mock";
import { useAppTheme, useReleases, useSwitchWorkspace, useWorkspace } from "@/lib/store";
import { cn } from "@/lib/utils";
import { StatusBadge } from "../ui/badge";
import { useFocusTrap } from "../ui/dialog";
import { Kbd } from "../ui/kbd";
import { useToast } from "../ui/toast";
import { useNavGuard } from "./nav-guard";
import { NAV, WorkspaceMark } from "./sidebar";

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: React.ReactNode;
  icon: React.ReactNode;
  keywords?: string;
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { navigate, request } = useNavGuard();
  const { workspace, workspaces, integration } = useWorkspace();
  const switchWorkspace = useSwitchWorkspace();
  const releases = useReleases();
  const [theme, setTheme] = useAppTheme();
  const toast = useToast();
  useFocusTrap(ref, open, inputRef);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => navigate(href);
    const list: Command[] = [
      { id: "new", group: "Actions", label: "Create release", icon: <Plus />, hint: <Kbd>C</Kbd>, keywords: "new draft story", run: go("/app/releases/new") },
      {
        id: "sync",
        group: "Actions",
        label: "Sync GitHub activity",
        icon: <RefreshCw />,
        keywords: "refresh pull fetch",
        run: () => {
          if (integration.status === "disconnected") {
            toast.info("GitHub isn't connected", "Connect it from Integrations first.");
            return;
          }
          repositoryService
            .sync(workspace.id)
            .then((r) => toast.success("Sync complete (demo)", r.newItems ? `${r.newItems} new item${r.newItems > 1 ? "s" : ""} found.` : "You're up to date."))
            .catch((e: Error) => toast.error("Sync failed", e.message));
        },
      },
      {
        id: "theme",
        group: "Actions",
        label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon: theme === "dark" ? <Sun /> : <Moon />,
        hint: <Kbd>⇧⌘L</Kbd>,
        keywords: "appearance mode dark light",
        run: () => setTheme(theme === "dark" ? "light" : "dark"),
      },
      { id: "public", group: "Actions", label: "Open public changelog", icon: <ArrowUpRight />, keywords: "view site", run: () => window.open(`/changelog/${workspace.slug}`, "_blank") },
      {
        id: "copy",
        group: "Actions",
        label: "Copy public changelog URL",
        icon: <Link2 />,
        keywords: "share link",
        run: () => {
          navigator.clipboard
            ?.writeText(publishingService.publicUrl(workspace.slug))
            .then(() => toast.success("Link copied", publishingService.publicUrl(workspace.slug)))
            .catch(() => toast.error("Couldn't copy link"));
        },
      },
      ...NAV.map((n) => ({ id: n.href, group: "Navigate", label: n.label, icon: <n.icon />, hint: <Kbd>{n.shortcut}</Kbd>, run: go(n.href) })),
      ...releases.slice(0, 20).map((r) => ({
        id: r.id,
        group: "Releases",
        label: r.title || "Untitled release",
        icon: <Rocket />,
        hint: <StatusBadge status={r.status} />,
        keywords: r.summary,
        run: go(`/app/releases/${r.id}`),
      })),
      ...workspaces
        .filter((w) => w.id !== workspace.id)
        .map((w) => ({
          id: `ws-${w.id}`,
          group: "Workspaces",
          label: `Switch to ${w.name}`,
          icon: <WorkspaceMark initials={w.initials} className="size-4 rounded text-[9px]" />,
          run: () => request(() => switchWorkspace(w.id)),
        })),
    ];
    return list;
  }, [navigate, request, integration.status, workspace, workspaces, releases, theme, setTheme, switchWorkspace, toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    const terms = q.split(/\s+/);
    return commands.filter((c) => {
      const hay = `${c.label} ${c.keywords ?? ""} ${c.group}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [commands, query]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const runAt = (i: number) => {
    const c = filtered[i];
    if (!c) return;
    onClose();
    // Let the dialog close before navigating so focus restores cleanly.
    setTimeout(c.run, 0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAt(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (typeof document === "undefined") return null;
  let lastGroup = "";

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[95] flex items-start justify-center p-4 pt-[14vh]">
          <motion.div
            className="fixed inset-0 bg-[rgb(10_10_9/0.32)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label="Command menu"
            initial={{ opacity: 0, scale: 0.98, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
            transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
            className="relative w-full max-w-[600px] overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-4 text-fg-faint" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command or search releases…"
                role="combobox"
                aria-expanded="true"
                aria-controls="cmd-list"
                aria-activedescendant={filtered[active] ? `cmd-${filtered[active].id}` : undefined}
                aria-autocomplete="list"
                className="h-12 flex-1 bg-transparent text-md text-fg placeholder:text-fg-faint focus:outline-none"
              />
              <Kbd>Esc</Kbd>
            </div>
            <div ref={listRef} id="cmd-list" role="listbox" aria-label="Commands" className="scrollbar-thin max-h-[min(420px,55vh)] overflow-y-auto p-1.5">
              {filtered.length === 0 && (
                <div className="px-3 py-10 text-center text-sm text-fg-subtle">
                  No results for “{query}”
                </div>
              )}
              {filtered.map((c, i) => {
                const header = c.group !== lastGroup;
                lastGroup = c.group;
                return (
                  <div key={c.id}>
                    {header && <div className="px-2.5 pb-1 pt-2.5 text-2xs font-medium uppercase tracking-[0.06em] text-fg-faint">{c.group}</div>}
                    <div
                      id={`cmd-${c.id}`}
                      role="option"
                      aria-selected={i === active}
                      data-index={i}
                      onMouseMove={() => setActive(i)}
                      onClick={() => runAt(i)}
                      className={cn(
                        "relative flex h-9 cursor-default items-center gap-3 rounded-md px-2.5 text-sm",
                        i === active ? "text-fg" : "text-fg-muted",
                      )}
                    >
                      {i === active && (
                        <motion.span layoutId="cmd-active" className="absolute inset-0 rounded-md bg-surface-2" transition={{ type: "spring", stiffness: 700, damping: 45 }} />
                      )}
                      <span className="relative flex size-4 items-center justify-center text-fg-subtle [&>svg]:size-4">{c.icon}</span>
                      <span className="relative min-w-0 flex-1 truncate">{c.label}</span>
                      <span className="relative">{c.hint}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-2xs text-fg-faint">
              <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> to navigate</span>
              <span className="flex items-center gap-1.5"><Kbd><CornerDownLeft className="size-2.5" /></Kbd> to select</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
