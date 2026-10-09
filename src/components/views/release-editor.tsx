"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  Eye,
  FileQuestion,
  Link2,
  MoreHorizontal,
  PenLine,
  Rocket,
  Trash2,
  Undo2,
  Wand2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCopy, useNow } from "@/components/app/hooks";
import { GuardedLink, useDirtyGuard, useNavGuard } from "@/components/app/nav-guard";
import { Page } from "@/components/app/page";
import { BlockEditor } from "@/components/release/block-editor";
import { MediaPicker } from "@/components/release/media-picker";
import { CategoryPicker, PublishDialog, ReleasePreview, SourcesPanel, StoryHeader } from "@/components/release/parts";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { MenuItem, MenuSeparator, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { EmptyState, Segmented } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { publishingService, releaseService } from "@/lib/services/mock";
import { generateStory } from "@/lib/story";
import { effectiveStatus, unreleased, useActivity, useActivityIndex, useActivityReleaseMap, useRelease, useUsers, useWorkspace } from "@/lib/store";
import type { Release, ReleaseDraft } from "@/lib/types";
import { cn, formatDateTime, relativeTimeLong } from "@/lib/utils";

export function pickDraft(r: Release): ReleaseDraft {
  return {
    title: r.title,
    summary: r.summary,
    category: r.category,
    blocks: r.blocks,
    activityIds: r.activityIds,
    cover: r.cover,
    releaseDate: r.releaseDate,
    version: r.version,
  };
}

function SaveStatus({ dirty, saving, updatedAt, now }: { dirty: boolean; saving: boolean; updatedAt: string; now: number }) {
  const state = saving ? "saving" : dirty ? "dirty" : "saved";
  return (
    <div className="relative h-5 min-w-[150px] overflow-hidden text-xs" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state}
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -8, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={cn("absolute inset-0 flex items-center gap-1.5", state === "dirty" ? "text-warning" : "text-fg-subtle")}
        >
          {state === "saving" && "Saving…"}
          {state === "dirty" && (
            <>
              <span className="size-1.5 rounded-full bg-warning" aria-hidden /> Unsaved changes
            </>
          )}
          {state === "saved" && (
            <>
              <Check className="size-3 text-success" aria-hidden /> Saved {relativeTimeLong(updatedAt, now)}
            </>
          )}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export function ReleaseEditorView({ id }: { id: string }) {
  const release = useRelease(id);
  if (!release) {
    return (
      <Page>
        <EmptyState
          icon={<FileQuestion />}
          title="Release not found"
          description="It may have been deleted, or it belongs to another workspace."
          action={<GuardedLink href="/app/releases" className="text-sm font-medium text-accent hover:underline">Back to releases</GuardedLink>}
        />
      </Page>
    );
  }
  return <Editor key={release.id} release={release} />;
}

function Editor({ release }: { release: Release }) {
  const now = useNow(15_000);
  const toast = useToast();
  const copy = useCopy();
  const { navigate, setDirty } = useNavGuard();
  const { workspace, appearance, repository } = useWorkspace();
  const users = useUsers();
  const activityIndex = useActivityIndex();
  const repoActivity = useActivity(repository?.id ?? null);
  const releaseMap = useActivityReleaseMap();

  const [draft, setDraft] = useState<ReleaseDraft>(() => pickDraft(release));
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [publishOpen, setPublishOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "unpublish" | "delete" | "regenerate">(null);
  const [busy, setBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(!!release.version);

  const saved = useMemo(() => JSON.stringify(pickDraft(release)), [release]);
  const dirty = JSON.stringify(draft) !== saved;
  useDirtyGuard(dirty);

  const status = effectiveStatus(release, now);
  const isPublished = status === "published";
  const sources = useMemo(() => draft.activityIds.map((id) => activityIndex.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof activityIndex.get>>[], [draft.activityIds, activityIndex]);
  const candidates = useMemo(() => unreleased(repoActivity, releaseMap), [repoActivity, releaseMap]);
  const patch = useCallback((p: Partial<ReleaseDraft>) => setDraft((d) => ({ ...d, ...p })), []);

  const save = useCallback(async () => {
    if (!draft.title.trim()) {
      toast.error("Add a title", "Every release needs a title before it can be saved.");
      return false;
    }
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 280));
      releaseService.update(release.id, draft);
      toast.success(isPublished ? "Changes are live" : "Draft saved", isPublished ? "The public changelog has been updated." : undefined);
      return true;
    } catch (e) {
      toast.error("Couldn't save", (e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [draft, release.id, toast, isPublished]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty) void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, save]);

  const previewRelease: Release = { ...release, ...draft };
  const publicUrl = publishingService.publicUrl(workspace.slug, { slug: release.slug });

  const regenerate = () => {
    const before = draft;
    const items = sources;
    if (!items.length) {
      toast.error("No source activity", "Add commits or pull requests to generate a story.");
      return;
    }
    const variant = Math.floor(Date.now() / 1000) % 3;
    const story = generateStory(items, variant);
    setDraft((d) => ({ ...d, title: story.title, summary: story.summary, category: story.category, blocks: story.blocks }));
    toast.info("Story regenerated from sources", "Title, summary and body were replaced.", { label: "Undo", onClick: () => setDraft(before) });
  };

  return (
    <div className="min-h-dvh">
      {/* Top bar */}
      <div className="sticky top-12 z-20 border-b border-line bg-canvas/92 backdrop-blur lg:top-0">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-10">
          <GuardedLink href="/app/releases" className="flex items-center gap-1.5 text-sm text-fg-subtle transition-colors hover:text-fg">
            <ArrowLeft className="size-4" aria-hidden />
            <span className="hidden sm:inline">Releases</span>
          </GuardedLink>
          <span className="text-fg-faint" aria-hidden>/</span>
          <span className="hidden min-w-0 max-w-[260px] truncate text-sm font-medium md:block">{draft.title || "Untitled release"}</span>
          <StatusBadge status={status} />
          <div className="hidden md:block">
            <SaveStatus dirty={dirty} saving={saving} updatedAt={release.updatedAt} now={now} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Segmented
              size="sm"
              label="Editor mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: "write", label: <span className="max-sm:sr-only">Write</span>, icon: <PenLine /> },
                { value: "preview", label: <span className="max-sm:sr-only">Preview</span>, icon: <Eye /> },
              ]}
            />
            <Popover>
              <PopoverTrigger aria-label="More actions" className="inline-flex size-8 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg">
                <MoreHorizontal className="size-4" />
              </PopoverTrigger>
              <PopoverContent role="menu" label="Release actions" align="end" className="w-60">
                <MenuItem icon={<Wand2 />} onSelect={() => setConfirm("regenerate")}>Regenerate from sources</MenuItem>
                <MenuItem icon={<Copy />} onSelect={() => { const c = releaseService.duplicate(release.id); toast.success("Release duplicated"); navigate(`/app/releases/${c.id}`); }}>Duplicate</MenuItem>
                {isPublished && <MenuItem icon={<Link2 />} onSelect={() => copy(publicUrl)}>Copy public link</MenuItem>}
                {isPublished && <MenuItem icon={<ArrowUpRight />} onSelect={() => window.open(publicUrl, "_blank")}>View on changelog</MenuItem>}
                <MenuSeparator />
                {status !== "draft" && <MenuItem icon={<Undo2 />} onSelect={() => setConfirm("unpublish")}>{status === "scheduled" ? "Cancel schedule" : "Unpublish"}</MenuItem>}
                <MenuItem icon={<Trash2 />} tone="danger" onSelect={() => setConfirm("delete")}>Delete release</MenuItem>
              </PopoverContent>
            </Popover>
            {(dirty || !isPublished) && (
              <Button onClick={save} loading={saving} disabled={!dirty}>
                {isPublished ? "Update" : <>Save<span className="max-sm:hidden"> draft</span></>}
              </Button>
            )}
            {!isPublished && (
              <Button variant="accent" icon={<Rocket className="size-3.5" />} onClick={() => setPublishOpen(true)} aria-label="Publish">
                <span className="max-sm:hidden">Publish</span>
              </Button>
            )}
            {isPublished && !dirty && (
              <Button icon={<ArrowUpRight className="size-3.5" />} onClick={() => window.open(publicUrl, "_blank")} aria-label="View live">
                <span className="max-sm:hidden">View live</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-6 lg:px-10">
        <AnimatePresence mode="wait" initial={false}>
          {mode === "preview" ? (
            <motion.div key="preview" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <ReleasePreview release={previewRelease} activity={activityIndex} users={users} />
            </motion.div>
          ) : (
            <motion.div key="write" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
              {/* Canvas */}
              <article className="mx-auto w-full max-w-[720px] lg:pl-10">
                {status === "scheduled" && release.scheduledFor && (
                  <p className="mb-6 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">Scheduled to go live {formatDateTime(release.scheduledFor)}.</p>
                )}
                <StoryHeader draft={draft} onChange={patch} />
                <div className="my-8 h-px bg-line" />
                <BlockEditor
                  blocks={draft.blocks}
                  onChange={(blocks) => patch({ blocks })}
                  accent={appearance.accent}
                  sources={sources}
                  onRemoveBlock={(b, i) => {
                    toast.info("Block removed", undefined, {
                      label: "Undo",
                      onClick: () => setDraft((d) => {
                        const blocks = [...d.blocks];
                        blocks.splice(i, 0, b);
                        return { ...d, blocks };
                      }),
                    });
                  }}
                />
              </article>

              {/* Inspector */}
              <aside className="flex flex-col gap-7 lg:sticky lg:top-24 lg:self-start" aria-label="Release details">
                <section className="space-y-4">
                  <h3 className="text-xs font-semibold text-fg">Details</h3>
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-fg-muted">Category</p>
                    <CategoryPicker value={draft.category} onChange={(category) => patch({ category })} />
                  </div>
                  <Field label="Release date" htmlFor="rel-date" hint="Shown on the public changelog.">
                    <Input id="rel-date" type="date" value={draft.releaseDate} onChange={(e) => e.target.value && patch({ releaseDate: e.target.value })} />
                  </Field>
                  <button onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen} className="flex items-center gap-1 text-xs font-medium text-fg-subtle hover:text-fg">
                    <ChevronDown className={cn("size-3.5 transition-transform", !moreOpen && "-rotate-90")} aria-hidden /> More options
                  </button>
                  <AnimatePresence initial={false}>
                    {moreOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-4 overflow-hidden">
                        <Field label="Version" htmlFor="rel-version" hint="Optional, e.g. 2.8">
                          <Input id="rel-version" value={draft.version ?? ""} onChange={(e) => patch({ version: e.target.value || undefined })} placeholder="—" className="font-mono" />
                        </Field>
                        <div>
                          <p className="text-xs font-medium text-fg-muted">Public URL</p>
                          <p className="mt-1 break-all font-mono text-2xs text-fg-subtle">/changelog/{workspace.slug}/{release.slug}</p>
                          {isPublished && <p className="mt-1 text-2xs text-fg-faint">Published URLs stay stable when the title changes.</p>}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
                <section>
                  <h3 className="mb-2 text-xs font-semibold text-fg">Cover image</h3>
                  <MediaPicker compact label="Cover" value={draft.cover} onChange={(cover) => patch({ cover })} accent={appearance.accent} />
                </section>
                <SourcesPanel
                  sources={sources}
                  candidates={candidates}
                  users={users}
                  onAdd={(aid) => patch({ activityIds: [...draft.activityIds, aid] })}
                  onRemove={(aid) => patch({ activityIds: draft.activityIds.filter((x) => x !== aid) })}
                />
              </aside>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <PublishDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title={draft.title}
        publicUrl={publicUrl}
        onCopy={(u) => copy(u)}
        onPublish={async () => {
          if (!draft.title.trim()) throw new Error("Add a title before publishing.");
          releaseService.update(release.id, draft);
          await publishingService.publish(release.id);
        }}
        onSchedule={async (at) => {
          if (!draft.title.trim()) throw new Error("Add a title before scheduling.");
          releaseService.update(release.id, draft);
          await publishingService.schedule(release.id, at);
        }}
      />

      <ConfirmDialog
        open={confirm === "unpublish"}
        onClose={() => setConfirm(null)}
        loading={busy}
        title={status === "scheduled" ? "Cancel the schedule?" : "Unpublish this release?"}
        description={status === "scheduled" ? "The release returns to draft and won't go live." : "It will be removed from the public changelog and return to draft. Shared links will stop working."}
        confirmLabel={status === "scheduled" ? "Cancel schedule" : "Unpublish"}
        onConfirm={async () => {
          setBusy(true);
          try {
            await publishingService.unpublish(release.id);
            toast.success("Returned to draft");
          } catch (e) {
            toast.error("Couldn't unpublish", (e as Error).message);
          } finally {
            setBusy(false);
            setConfirm(null);
          }
        }}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        tone="danger"
        title="Delete this release?"
        description={`“${release.title || "Untitled release"}” will be permanently deleted${isPublished ? " and removed from the public changelog" : ""}. Its source activity becomes available again.`}
        confirmLabel="Delete release"
        onConfirm={() => {
          setConfirm(null);
          setDirty(false);
          releaseService.remove(release.id);
          toast.success("Release deleted");
          navigate("/app/releases");
        }}
      />
      <ConfirmDialog
        open={confirm === "regenerate"}
        onClose={() => setConfirm(null)}
        title="Regenerate the story?"
        description="The title, summary and body will be rewritten from the linked activity. You can undo this."
        confirmLabel="Regenerate"
        onConfirm={() => {
          setConfirm(null);
          regenerate();
        }}
      />
    </div>
  );
}
