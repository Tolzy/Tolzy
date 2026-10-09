"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Copy, Link2, MoreHorizontal, PenLine, Plus, Rocket, Search, Trash2, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useCopy, useNow, usePublicUrl } from "@/components/app/hooks";
import { GuardedLink, useNavGuard } from "@/components/app/nav-guard";
import { Page, PageHeader } from "@/components/app/page";
import { MediaView } from "@/components/release/illustration";
import { CategoryBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/form";
import { MenuItem, MenuSeparator, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { EmptyState, Tabs } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { publishingService, releaseService } from "@/lib/services/mock";
import { effectiveStatus, sortByReleaseDate, useReleases, useWorkspace } from "@/lib/store";
import type { Release, ReleaseStatus } from "@/lib/types";
import { formatDay, formatDateTime, pluralize, relativeTimeLong } from "@/lib/utils";

type TabKey = "all" | ReleaseStatus;

export function ReleasesView() {
  const now = useNow();
  const releases = useReleases();
  const { appearance } = useWorkspace();
  const { navigate } = useNavGuard();
  const toast = useToast();
  const copy = useCopy();
  const publicUrl = usePublicUrl();
  const [tab, setTab] = useState<TabKey>("all");
  const [q, setQ] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Release | null>(null);

  const withStatus = useMemo(() => releases.map((r) => ({ r, status: effectiveStatus(r, now) })), [releases, now]);
  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { all: withStatus.length, draft: 0, scheduled: 0, published: 0 };
    withStatus.forEach((x) => c[x.status]++);
    return c;
  }, [withStatus]);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    const filtered = withStatus.filter((x) => (tab === "all" || x.status === tab) && (!query || `${x.r.title} ${x.r.summary}`.toLowerCase().includes(query)));
    // Drafts first (most recently edited), then published by date.
    const drafts = filtered.filter((x) => x.status !== "published").sort((a, b) => b.r.updatedAt.localeCompare(a.r.updatedAt));
    const pub = sortByReleaseDate(filtered.filter((x) => x.status === "published").map((x) => x.r)).map((r) => ({ r, status: "published" as const }));
    return [...drafts, ...pub];
  }, [withStatus, tab, q]);

  return (
    <Page>
      <PageHeader
        title="Releases"
        description="Every story you've drafted, scheduled, or published."
        actions={
          <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => navigate("/app/releases/new")}>
            Create release
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Tabs
          label="Filter releases by status"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "all", label: "All", count: counts.all },
            { value: "draft", label: "Drafts", count: counts.draft },
            { value: "scheduled", label: "Scheduled", count: counts.scheduled },
            { value: "published", label: "Published", count: counts.published },
          ]}
          className="flex-1"
        />
        <div className="w-full sm:w-60 sm:pb-1.5">
          <Input leading={<Search />} placeholder="Search releases" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search releases" />
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<Rocket />}
          title={q ? "No releases match your search" : tab === "all" ? "No releases yet" : `No ${tab} releases`}
          description={q ? "Try a different word." : "Create a release from recent GitHub activity — Shiplog drafts the story for you."}
          action={!q && <Button variant="primary" onClick={() => navigate("/app/releases/new")}>Create release</Button>}
        />
      ) : (
        <ul className="mt-2 divide-y divide-line" aria-label="Releases">
          <AnimatePresence initial={false}>
            {list.map(({ r, status }) => (
              <motion.li key={r.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }} className="group relative flex items-center gap-4 py-4">
                <div className="hidden w-[88px] shrink-0 overflow-hidden rounded-md border border-line bg-surface-2 sm:block">
                  {r.cover ? (
                    <div className="pointer-events-none"><MediaView media={r.cover} accent={appearance.accent} /></div>
                  ) : (
                    <div className="flex aspect-[16/10] items-center justify-center font-serif text-xl text-fg-faint">{r.title.charAt(0) || "·"}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <GuardedLink href={`/app/releases/${r.id}`} className="block after:absolute after:inset-0">
                    <span className="block truncate text-[15px] font-semibold tracking-[-0.01em] text-fg">{r.title || "Untitled release"}</span>
                  </GuardedLink>
                  <p className="mt-0.5 truncate text-sm text-fg-subtle">{r.summary || "No summary"}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-faint">
                    <span>
                      {status === "published"
                        ? `Published ${formatDay(r.releaseDate)}`
                        : status === "scheduled" && r.scheduledFor
                          ? `Goes live ${formatDateTime(r.scheduledFor)}`
                          : `Edited ${relativeTimeLong(r.updatedAt, now)}`}
                    </span>
                    <span>{pluralize(r.activityIds.length, "source")}</span>
                    {r.version && <span className="font-mono">v{r.version}</span>}
                  </p>
                </div>
                <CategoryBadge category={r.category} className="hidden md:inline-flex" />
                <StatusBadge status={status} />
                <Popover className="relative z-10">
                  <PopoverTrigger aria-label={`Actions for ${r.title}`} className="inline-flex size-8 items-center justify-center rounded-md text-fg-faint transition-colors hover:bg-surface-2 hover:text-fg">
                    <MoreHorizontal className="size-4" />
                  </PopoverTrigger>
                  <PopoverContent role="menu" label="Release actions" align="end" className="w-52">
                    <MenuItem icon={<PenLine />} onSelect={() => navigate(`/app/releases/${r.id}`)}>Edit</MenuItem>
                    {status === "published" && (
                      <>
                        <MenuItem icon={<ArrowUpRight />} onSelect={() => window.open(publicUrl(r.slug), "_blank")}>View on changelog</MenuItem>
                        <MenuItem icon={<Link2 />} onSelect={() => copy(publicUrl(r.slug))}>Copy public link</MenuItem>
                      </>
                    )}
                    <MenuItem icon={<Copy />} onSelect={() => { releaseService.duplicate(r.id); toast.success("Release duplicated", "The copy is saved as a draft."); }}>Duplicate</MenuItem>
                    {status !== "draft" && (
                      <MenuItem
                        icon={<Undo2 />}
                        onSelect={() => publishingService.unpublish(r.id).then(() => toast.success("Returned to draft", `“${r.title}” is no longer public.`))}
                      >
                        {status === "scheduled" ? "Cancel schedule" : "Unpublish"}
                      </MenuItem>
                    )}
                    <MenuSeparator />
                    <MenuItem icon={<Trash2 />} tone="danger" onSelect={() => setConfirmDelete(r)}>Delete</MenuItem>
                  </PopoverContent>
                </Popover>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        tone="danger"
        title="Delete this release?"
        description={confirmDelete ? `“${confirmDelete.title || "Untitled release"}” will be permanently deleted. Its source activity becomes available for new releases.` : ""}
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDelete) releaseService.remove(confirmDelete.id);
          toast.success("Release deleted");
          setConfirmDelete(null);
        }}
      />
    </Page>
  );
}
