"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  AlertTriangle,
  ChevronRight,
  Filter,
  GitPullRequest,
  Layers,
  List,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityRow } from "@/components/app/activity-row";
import { useNow, useSync } from "@/components/app/hooks";
import { useNavGuard } from "@/components/app/nav-guard";
import { DemoTag, Page, PageHeader, RepoSelector } from "@/components/app/page";
import { Avatar } from "@/components/ui/avatar";
import { CategoryBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/form";
import { MenuItem, MenuLabel, MenuSeparator, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { EmptyState, Segmented, Skeleton } from "@/components/ui/misc";
import { activityService } from "@/lib/services/mock";
import { generateStory, suggestGroups } from "@/lib/story";
import { unreleased, useActivity, useActivityReleaseMap, useDb, useUsers, useWorkspace } from "@/lib/store";
import type { ActivityItem, ActivityType } from "@/lib/types";
import { cn, pluralize } from "@/lib/utils";

type DateRange = "any" | "1" | "7" | "30";

function dayLabel(iso: string, now: number) {
  const d = new Date(iso);
  const today = new Date(now);
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function FeedSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading activity" className="divide-y divide-line">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="size-4" />
          <Skeleton className="size-4 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-3.5" style={{ width: `${40 + ((i * 17) % 35)}%` }} />
            <Skeleton className="mt-2 h-2.5" style={{ width: `${30 + ((i * 11) % 30)}%` }} />
          </div>
          <Skeleton className="h-3 w-10" />
        </div>
      ))}
    </div>
  );
}

export function ActivityView() {
  const now = useNow();
  const { workspace, integration, repository } = useWorkspace();
  const db = useDb();
  const users = useUsers();
  const all = useActivity(repository?.id ?? null);
  const releaseMap = useActivityReleaseMap();
  const { navigate } = useNavGuard();
  const { sync, syncing, disabled } = useSync();

  const [load, setLoad] = useState<{ status: "loading" | "ready" | "error"; error?: string }>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | ActivityType>("all");
  const [authors, setAuthors] = useState<string[]>([]);
  const [range, setRange] = useState<DateRange>("any");
  const [showReleased, setShowReleased] = useState(false);
  const [view, setView] = useState<"timeline" | "grouped">("timeline");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const repoId = repository?.id;
  useEffect(() => {
    if (!repoId) return;
    let alive = true;
    setLoad({ status: "loading" });
    activityService
      .load({ repoId })
      .then(() => alive && setLoad({ status: "ready" }))
      .catch((e: Error) => alive && setLoad({ status: "error", error: e.message }));
    return () => {
      alive = false;
    };
  }, [repoId, attempt, db.demo.activityError]);

  useEffect(() => setSelected(new Set()), [repoId, workspace.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cutoff = range === "any" ? 0 : now - Number(range) * 864e5;
    return all.filter((a) => {
      if (!showReleased && releaseMap.get(a.id)?.status === "published") return false;
      if (type !== "all" && a.type !== type) return false;
      if (authors.length && !authors.includes(a.authorId)) return false;
      if (cutoff && new Date(a.createdAt).getTime() < cutoff) return false;
      if (q) {
        const author = users.get(a.authorId);
        const hay = `${a.title} ${a.description} ${a.number ?? ""} ${a.sha.slice(0, 7)} ${a.branch} ${author?.name} ${author?.handle}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [all, query, type, authors, range, showReleased, releaseMap, users, now]);

  const pending = useMemo(() => unreleased(all, releaseMap), [all, releaseMap]);
  const groups = useMemo(() => suggestGroups(pending), [pending]);
  const selectedItems = useMemo(() => all.filter((a) => selected.has(a.id)), [all, selected]);
  const preview = useMemo(() => (selectedItems.length ? generateStory(selectedItems) : null), [selectedItems]);

  const toggle = useCallback((id: string, v: boolean) => {
    setSelected((s) => {
      const n = new Set(s);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });
  }, []);

  const selectMany = (ids: string[], v = true) =>
    setSelected((s) => {
      const n = new Set(s);
      ids.forEach((id) => (v ? n.add(id) : n.delete(id)));
      return n;
    });

  const filtersActive = !!query || type !== "all" || authors.length > 0 || range !== "any";
  const clearFilters = () => {
    setQuery("");
    setType("all");
    setAuthors([]);
    setRange("any");
  };

  const allVisibleSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.id));
  const someVisibleSelected = filtered.some((a) => selected.has(a.id));

  const createFromSelection = () => navigate(`/app/releases/new?items=${[...selected].join(",")}`);

  // Group rows for display.
  const sections = useMemo(() => {
    if (view === "timeline") {
      const out: { key: string; label: string; items: ActivityItem[]; meta?: React.ReactNode }[] = [];
      for (const a of filtered) {
        const label = dayLabel(a.createdAt, now);
        const last = out[out.length - 1];
        if (last && last.label === label) last.items.push(a);
        else out.push({ key: label, label, items: [a] });
      }
      return out;
    }
    const visible = new Set(filtered.map((f) => f.id));
    const used = new Set<string>();
    const out: { key: string; label: string; items: ActivityItem[]; meta?: React.ReactNode }[] = [];
    for (const g of suggestGroups(filtered.filter((f) => !releaseMap.has(f.id)))) {
      const items = g.activityIds.filter((id) => visible.has(id)).map((id) => filtered.find((f) => f.id === id)!);
      items.forEach((i) => used.add(i.id));
      out.push({ key: g.id, label: g.title, items, meta: <CategoryBadge category={g.category} /> });
    }
    const inReleases = filtered.filter((f) => !used.has(f.id) && releaseMap.has(f.id));
    if (inReleases.length) out.push({ key: "in-releases", label: "Already in a release", items: inReleases });
    const rest = filtered.filter((f) => !used.has(f.id) && !releaseMap.has(f.id));
    if (rest.length) out.push({ key: "ungrouped", label: "Ungrouped", items: rest });
    return out;
  }, [filtered, view, now, releaseMap]);

  const authorList = useMemo(() => [...new Set(all.map((a) => a.authorId))].map((id) => users.get(id)!).filter(Boolean), [all, users]);
  const disconnected = integration.status === "disconnected" || !repository;

  return (
    <Page wide>
      <PageHeader
        eyebrow={
          <>
            <RepoSelector />
            {integration.mode === "demo" && !disconnected && <DemoTag />}
          </>
        }
        title="Activity"
        description="Commits and pull requests from GitHub. Select related work to turn it into a release."
        actions={
          <Button icon={<RefreshCw className={cn("size-3.5", syncing && "animate-[spin_0.8s_linear_infinite]")} />} onClick={sync} disabled={disabled || syncing}>
            {syncing ? "Syncing" : "Sync now"}
          </Button>
        }
      />

      {disconnected ? (
        <div className="rounded-xl border border-dashed border-line-strong">
          <EmptyState
            icon={<GitPullRequest />}
            title="Connect a repository to see activity"
            description="Shiplog needs read access to commits and pull requests. In this prototype, connecting uses simulated GitHub data."
            action={<Button variant="primary" onClick={() => navigate("/app/integrations")}>Go to Integrations</Button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 pb-3">
              <div className="w-full sm:w-64">
                <Input
                  leading={<Search />}
                  placeholder="Search titles, #PR, SHA, author…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search activity"
                />
              </div>
              <Segmented
                label="Activity type"
                value={type}
                onChange={setType}
                options={[
                  { value: "all", label: "All" },
                  { value: "pull_request", label: "Pull requests" },
                  { value: "commit", label: "Commits" },
                ]}
              />
              <Popover>
                <PopoverTrigger
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md border bg-surface px-2.5 text-sm transition-colors hover:border-line-strong",
                    authors.length ? "border-accent/40 text-fg" : "border-line text-fg-muted",
                  )}
                >
                  <Users className="size-3.5" aria-hidden />
                  {authors.length ? pluralize(authors.length, "author") : "Author"}
                </PopoverTrigger>
                <PopoverContent role="menu" label="Filter by author" className="w-56">
                  <MenuLabel>Authors</MenuLabel>
                  {authorList.map((u) => (
                    <MenuItem
                      key={u.id}
                      keepOpen
                      checked={authors.includes(u.id)}
                      icon={<Avatar user={u} size={16} />}
                      onSelect={() => setAuthors((a) => (a.includes(u.id) ? a.filter((x) => x !== u.id) : [...a, u.id]))}
                    >
                      {u.name}
                    </MenuItem>
                  ))}
                  {authors.length > 0 && (
                    <>
                      <MenuSeparator />
                      <MenuItem onSelect={() => setAuthors([])}>Clear authors</MenuItem>
                    </>
                  )}
                </PopoverContent>
              </Popover>
              <div className="w-[130px]">
                <Select value={range} onChange={(e) => setRange(e.target.value as DateRange)} aria-label="Date range">
                  <option value="any">Any time</option>
                  <option value="1">Last 24 hours</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                </Select>
              </div>
              {filtersActive && (
                <Button variant="ghost" size="sm" icon={<X className="size-3" />} onClick={clearFilters}>
                  Clear
                </Button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-fg-subtle">
                  <Checkbox checked={showReleased} onChange={setShowReleased} label="Show released activity" />
                  Show released
                </label>
                <Segmented
                  size="sm"
                  label="View mode"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "timeline", label: "Timeline", icon: <List />, title: "Chronological feed" },
                    { value: "grouped", label: "Grouped", icon: <Layers />, title: "Group by suggested release" },
                  ]}
                />
              </div>
            </div>

            {/* Feed */}
            <div className="rounded-xl border border-line bg-surface">
              <div className="flex h-10 items-center gap-3 rounded-t-xl border-b border-line bg-surface-2/40 px-4 text-xs text-fg-subtle">
                <Checkbox
                  checked={allVisibleSelected}
                  indeterminate={!allVisibleSelected && someVisibleSelected}
                  onChange={(v) => selectMany(filtered.map((f) => f.id), v)}
                  label="Select all visible activity"
                  disabled={load.status !== "ready" || !filtered.length}
                />
                <span>
                  {load.status === "ready" ? `${pluralize(filtered.length, "item")}${filtersActive ? " match" : ""}` : "Loading…"}
                </span>
                {selected.size > 0 && <span className="text-accent">· {selected.size} selected</span>}
              </div>

              {load.status === "loading" ? (
                <FeedSkeleton />
              ) : load.status === "error" ? (
                <EmptyState
                  tone="error"
                  icon={<AlertTriangle />}
                  title="Couldn't load activity"
                  description={load.error}
                  action={
                    <>
                      <Button onClick={() => setAttempt((a) => a + 1)} icon={<RefreshCw className="size-3.5" />}>Try again</Button>
                      <Button variant="ghost" onClick={() => navigate("/app/integrations")}>Check integration</Button>
                    </>
                  }
                />
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={<Filter />}
                  title={filtersActive ? "No activity matches these filters" : "No unreleased activity"}
                  description={filtersActive ? "Try a different search, author, or date range." : "Everything here has shipped. Sync to pull new work, or show released activity."}
                  action={
                    filtersActive ? <Button onClick={clearFilters}>Clear filters</Button> : <Button onClick={() => setShowReleased(true)}>Show released</Button>
                  }
                />
              ) : (
                <LayoutGroup>
                  <div>
                    {sections.map((sec) => {
                      const isCollapsed = collapsed.has(sec.key);
                      const groupSelected = sec.items.every((i) => selected.has(i.id));
                      return (
                        <motion.section key={sec.key} layout="position" aria-label={sec.label} className="border-b border-line last:border-b-0">
                          <div className="sticky top-12 z-[5] flex h-9 items-center gap-2 border-b border-line/70 bg-surface/95 px-4 backdrop-blur lg:top-0">
                            {view === "grouped" ? (
                              <>
                                <button
                                  onClick={() =>
                                    setCollapsed((c) => {
                                      const n = new Set(c);
                                      if (n.has(sec.key)) n.delete(sec.key);
                                      else n.add(sec.key);
                                      return n;
                                    })
                                  }
                                  aria-expanded={!isCollapsed}
                                  className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-fg"
                                >
                                  <ChevronRight className={cn("size-3.5 text-fg-faint transition-transform duration-200", !isCollapsed && "rotate-90")} aria-hidden />
                                  <span className="truncate">{sec.label}</span>
                                </button>
                                {sec.meta}
                                <span className="tabular text-xs text-fg-faint">{sec.items.length}</span>
                                {sec.key.startsWith("group_") && (
                                  <button
                                    onClick={() => selectMany(sec.items.map((i) => i.id), !groupSelected)}
                                    className="ml-auto text-xs font-medium text-fg-subtle transition-colors hover:text-accent"
                                  >
                                    {groupSelected ? "Deselect group" : "Select group"}
                                  </button>
                                )}
                              </>
                            ) : (
                              <h3 className="text-xs font-medium text-fg-subtle">{sec.label}</h3>
                            )}
                          </div>
                          <AnimatePresence initial={false}>
                            {!isCollapsed && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                                className="divide-y divide-line/70 overflow-hidden"
                              >
                                {sec.items.map((a) => (
                                  <motion.div key={a.id} layoutId={`act-${a.id}`} transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}>
                                    <ActivityRow
                                      item={a}
                                      author={users.get(a.authorId)}
                                      release={releaseMap.get(a.id)}
                                      selected={selected.has(a.id)}
                                      onToggle={(v) => toggle(a.id, v)}
                                      onOpenRelease={(r) => navigate(`/app/releases/${r.id}`)}
                                      now={now}
                                    />
                                  </motion.div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.section>
                      );
                    })}
                  </div>
                </LayoutGroup>
              )}
            </div>
          </div>

          {/* Suggestions rail */}
          <aside aria-labelledby="sugg-heading" className="xl:sticky xl:top-8 xl:self-start">
            <h2 id="sugg-heading" className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-3.5 text-accent" aria-hidden /> Suggested groups
            </h2>
            <p className="mt-0.5 text-xs text-fg-subtle">Based on commit scopes and shared areas of the codebase.</p>
            {load.status !== "ready" ? (
              <div className="mt-4 space-y-3">
                {[0, 1].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
              </div>
            ) : groups.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-line-strong p-4 text-sm text-fg-subtle">No suggestions right now. Everything recent is already part of a release.</p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                <AnimatePresence initial={false}>
                  {groups.map((g) => {
                    const isSel = g.activityIds.every((id) => selected.has(id));
                    return (
                      <motion.li
                        key={g.id}
                        layout
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className={cn("rounded-lg border bg-surface p-3.5 transition-colors", isSel ? "border-accent/50 ring-2 ring-accent/10" : "border-line")}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-snug">{g.title}</p>
                          <CategoryBadge category={g.category} />
                        </div>
                        <p className="mt-1 text-xs text-fg-subtle">{g.rationale}</p>
                        <div className="mt-3 flex items-center gap-2">
                          <Button size="sm" onClick={() => selectMany(g.activityIds, !isSel)}>
                            {isSel ? "Deselect" : `Select ${g.activityIds.length}`}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/app/releases/new?items=${g.activityIds.join(",")}`)}>
                            Create release →
                          </Button>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </aside>
        </div>
      )}

      {/* Bulk action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            role="region"
            aria-label="Selection actions"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 38 }}
            className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-[640px] items-center gap-3 rounded-xl border border-line bg-invert py-2 pl-4 pr-2 text-invert-fg shadow-pop lg:left-[248px]"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white/15 text-xs font-semibold tabular">{selected.size}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{preview?.title}</p>
              <p className="truncate text-2xs opacity-60">Suggested headline · {pluralize(selectedItems.filter((s) => s.type === "pull_request").length, "PR")}, {pluralize(selectedItems.filter((s) => s.type === "commit").length, "commit")}</p>
            </div>
            <button onClick={() => setSelected(new Set())} className="h-8 rounded-md px-2.5 text-sm opacity-70 transition-opacity hover:opacity-100">
              Clear
            </button>
            <button
              onClick={createFromSelection}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-canvas px-3 text-sm font-medium text-fg transition-transform active:scale-[0.97]"
            >
              <Plus className="size-3.5" aria-hidden /> Create release
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  );
}
