"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, ChevronRight, FileText, GitPullRequest, RefreshCw, Rocket, Sparkles, Wand2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityRow } from "@/components/app/activity-row";
import { useCopy, useNow } from "@/components/app/hooks";
import { useDirtyGuard, useNavGuard } from "@/components/app/nav-guard";
import { RepoSelector } from "@/components/app/page";
import { BlockEditor } from "@/components/release/block-editor";
import { MediaPicker } from "@/components/release/media-picker";
import { CategoryPicker, PublishDialog, ReleasePreview, SourcesPanel, StoryHeader } from "@/components/release/parts";
import { CategoryBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/form";
import { EmptyState, SectionHeader } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { publishingService, releaseService } from "@/lib/services/mock";
import { generateStory, suggestGroups } from "@/lib/story";
import { unreleased, useActivity, useActivityIndex, useActivityReleaseMap, useRelease, useUsers, useWorkspace } from "@/lib/store";
import type { ActivityItem, Release, ReleaseDraft } from "@/lib/types";
import { cn, pluralize, slugify, toDay } from "@/lib/utils";

const STEPS = [
  { key: "select", label: "Select changes" },
  { key: "story", label: "Generate story" },
  { key: "enrich", label: "Enrich" },
  { key: "preview", label: "Preview" },
  { key: "publish", label: "Publish" },
] as const;

function Stepper({ step, maxStep, onGo }: { step: number; maxStep: number; onGo: (i: number) => void }) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto" aria-label="Release steps">
      {STEPS.map((s, i) => {
        const done = i < step;
        const current = i === step;
        const reachable = i <= maxStep;
        return (
          <li key={s.key} className="flex items-center gap-1">
            <button
              onClick={() => reachable && onGo(i)}
              disabled={!reachable}
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors disabled:cursor-not-allowed",
                current ? "text-fg" : reachable ? "text-fg-subtle hover:bg-surface-2 hover:text-fg" : "text-fg-faint",
              )}
            >
              <span
                className={cn(
                  "relative flex size-5 shrink-0 items-center justify-center rounded-full border text-[10.5px] font-semibold tabular transition-colors",
                  current ? "border-fg bg-invert text-invert-fg" : done ? "border-success bg-success text-white" : "border-line-strong",
                )}
              >
                {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              <span className="hidden whitespace-nowrap font-medium md:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="relative h-px w-4 bg-line lg:w-8" aria-hidden>
                <motion.span className="absolute inset-0 origin-left bg-success" initial={false} animate={{ scaleX: i < step ? 1 : 0 }} transition={{ duration: 0.3 }} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function SelectStep({
  items,
  selected,
  setSelected,
}: {
  items: ActivityItem[];
  selected: Set<string>;
  setSelected: (fn: (s: Set<string>) => Set<string>) => void;
}) {
  const users = useUsers();
  const now = useNow();
  const groups = useMemo(() => suggestGroups(items), [items]);
  const grouped = new Set(groups.flatMap((g) => g.activityIds));
  const ungrouped = items.filter((i) => !grouped.has(i.id));
  const [open, setOpen] = useState<Set<string>>(() => new Set([...groups.map((g) => g.id), "ungrouped"]));
  const byId = new Map(items.map((i) => [i.id, i]));
  const sections = [
    ...groups.map((g) => ({ key: g.id, title: g.title, meta: <CategoryBadge category={g.category} />, sub: g.rationale, items: g.activityIds.map((id) => byId.get(id)!).filter(Boolean) })),
    ...(ungrouped.length ? [{ key: "ungrouped", title: "Other changes", meta: null, sub: "Housekeeping and changes without a clear group", items: ungrouped }] : []),
  ];
  const toggle = (ids: string[], v: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      ids.forEach((id) => (v ? n.add(id) : n.delete(id)));
      return n;
    });

  if (!items.length) {
    return (
      <EmptyState
        icon={<GitPullRequest />}
        title="No unreleased activity in this repository"
        description="Everything has already been included in a release. Switch repository or sync to pull in new work."
        action={<RepoSelector />}
      />
    );
  }

  return (
    <div className="space-y-3">
      {sections.map((sec) => {
        const ids = sec.items.map((i) => i.id);
        const count = ids.filter((id) => selected.has(id)).length;
        const all = count === ids.length;
        const isOpen = open.has(sec.key);
        return (
          <section key={sec.key} className={cn("rounded-xl border bg-surface transition-colors", count ? "border-accent/40" : "border-line")}>
            <div className="flex items-center gap-3 px-4 py-3">
              <Checkbox checked={all} indeterminate={count > 0 && !all} onChange={(v) => toggle(ids, v)} label={`Select all in ${sec.title}`} />
              <button
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                aria-expanded={isOpen}
                onClick={() =>
                  setOpen((o) => {
                    const n = new Set(o);
                    if (n.has(sec.key)) n.delete(sec.key);
                    else n.add(sec.key);
                    return n;
                  })
                }
              >
                <ChevronRight className={cn("size-3.5 shrink-0 text-fg-faint transition-transform duration-200", isOpen && "rotate-90")} aria-hidden />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{sec.title}</span>
                    {sec.meta}
                  </span>
                  <span className="mt-0.5 block text-xs text-fg-subtle">{sec.sub}</span>
                </span>
              </button>
              <span className="tabular text-xs text-fg-faint">
                {count}/{ids.length}
              </span>
            </div>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }} className="overflow-hidden">
                  <div className="divide-y divide-line/70 border-t border-line">
                    {sec.items.map((a) => (
                      <ActivityRow key={a.id} item={a} author={users.get(a.authorId)} selected={selected.has(a.id)} onToggle={(v) => toggle([a.id], v)} now={now} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        );
      })}
    </div>
  );
}

export function NewReleaseView() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const copy = useCopy();
  const { navigate, setDirty } = useNavGuard();
  const { workspace, appearance, repository } = useWorkspace();
  const users = useUsers();
  const activityIndex = useActivityIndex();
  const repoActivity = useActivity(repository?.id ?? null);
  const releaseMap = useActivityReleaseMap();
  const candidates = useMemo(() => unreleased(repoActivity, releaseMap), [repoActivity, releaseMap]);

  const [selected, setSelectedState] = useState<Set<string>>(() => {
    const ids = (params.get("items") ?? "").split(",").filter(Boolean);
    return new Set(ids.filter((id) => activityIndex.has(id)));
  });
  const [step, setStep] = useState(() => (params.get("items") ? 1 : 0));
  const [dir, setDir] = useState<1 | -1>(1);
  const [maxStep, setMaxStep] = useState(step);
  const [variant, setVariant] = useState(0);
  const [draft, setDraft] = useState<ReleaseDraft | null>(null);
  const [genKey, setGenKey] = useState("");
  const [generating, setGenerating] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const publishedRef = useRef(false);
  const created = useRelease(createdId ?? undefined);

  // Items chosen via ?items= might belong to another connected repo: include them.
  const pool = useMemo(() => {
    const extra = [...selected].map((id) => activityIndex.get(id)).filter((a): a is ActivityItem => !!a && !candidates.some((c) => c.id === a.id));
    return [...candidates, ...extra];
  }, [candidates, selected, activityIndex]);

  const selectedItems = useMemo(() => pool.filter((a) => selected.has(a.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [pool, selected]);
  const selKey = selectedItems.map((s) => s.id).join(",");
  const setSelected = (fn: (s: Set<string>) => Set<string>) => setSelectedState(fn);

  useDirtyGuard(!createdId && (selected.size > 0 || !!draft));

  const runGenerate = (v: number, announce = false) => {
    setGenerating(true);
    const before = draft;
    // Brief, honest delay: generation is deterministic and local.
    setTimeout(() => {
      const story = generateStory(selectedItems, v);
      setDraft((d) => ({
        title: story.title,
        summary: story.summary,
        category: story.category,
        blocks: story.blocks,
        activityIds: selectedItems.map((s) => s.id),
        cover: d?.cover ?? null,
        releaseDate: d?.releaseDate ?? toDay(new Date()),
        version: d?.version,
      }));
      setGenKey(selKey);
      setGenerating(false);
      if (announce && before) toast.info("Story regenerated", `Variation ${(v % 3) + 1} of 3`, { label: "Undo", onClick: () => setDraft(before) });
    }, 420);
  };

  // Generate on entering the story step, or when the selection changed.
  useEffect(() => {
    if (step >= 1 && selectedItems.length && genKey !== selKey && !generating) {
      if (draft && genKey) toast.info("Selection changed", "The story was regenerated for the new selection.");
      runGenerate(variant);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selKey]);

  const go = (i: number) => {
    if (i >= 1 && selectedItems.length === 0) {
      toast.error("Select at least one change", "Pick the commits and pull requests this release is about.");
      return;
    }
    setDir(i >= step ? 1 : -1);
    setStep(i);
    setMaxStep((m) => Math.max(m, i));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const patch = (p: Partial<ReleaseDraft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const sources = useMemo(() => (draft?.activityIds ?? []).map((id) => activityIndex.get(id)).filter(Boolean) as ActivityItem[], [draft, activityIndex]);

  const ensureCreated = (): string => {
    if (!draft) throw new Error("Nothing to save yet.");
    if (!draft.title.trim()) throw new Error("Add a title first.");
    if (createdId) {
      releaseService.update(createdId, draft);
      return createdId;
    }
    const r = releaseService.create(workspace.id, draft);
    setCreatedId(r.id);
    return r.id;
  };

  const saveDraft = () => {
    try {
      const id = ensureCreated();
      setDirty(false);
      toast.success("Draft saved", "You can keep editing it from Releases.");
      router.push(`/app/releases/${id}`);
    } catch (e) {
      toast.error("Couldn't save draft", (e as Error).message);
    }
  };

  const previewRelease: Release | null = draft
    ? { ...draft, id: "preview", workspaceId: workspace.id, slug: created?.slug ?? slugify(draft.title), status: "draft", createdAt: "", updatedAt: "" }
    : null;
  const createdSlug = created ? publishingService.publicUrl(workspace.slug, created) : null;

  return (
    <div className="min-h-dvh">
      <div className="sticky top-12 z-20 border-b border-line bg-canvas/92 backdrop-blur lg:top-0">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-4 px-4 sm:px-6 lg:px-10">
          <button onClick={() => navigate("/app/releases")} aria-label="Cancel and close" className="rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg">
            <X className="size-4" />
          </button>
          <span className="hidden text-sm font-semibold lg:inline">New release</span>
          <div className="mx-auto">
            <Stepper step={step} maxStep={maxStep} onGo={go} />
          </div>
          <span className="hidden min-w-[90px] text-right text-xs text-fg-subtle tabular sm:inline" aria-live="polite">
            {pluralize(selected.size, "item")} selected
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-[1240px] px-4 pb-32 pt-8 sm:px-6 lg:px-10">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={{ enter: (d: number) => ({ opacity: 0, x: 16 * d }), center: { opacity: 1, x: 0, pointerEvents: "auto" }, exit: (d: number) => ({ opacity: 0, x: -16 * d, pointerEvents: "none" }) }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
          >
            {step === 0 && (
              <div className="mx-auto max-w-[860px]">
                <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h1 className="text-[22px] font-semibold tracking-[-0.02em]">What does this release cover?</h1>
                    <p className="mt-1 text-sm text-fg-subtle">Unreleased activity, grouped by likely feature. Select everything that belongs in one story.</p>
                  </div>
                  <RepoSelector compact />
                </header>
                <SelectStep items={pool} selected={selected} setSelected={setSelected} />
              </div>
            )}

            {step === 1 && (
              <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="mx-auto w-full max-w-[720px] md:pl-14">
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-xs text-fg-subtle">
                      <Sparkles className="size-3.5 text-accent" aria-hidden />
                      Drafted from {pluralize(selectedItems.length, "change")}. Every field is yours to edit.
                    </p>
                    <Button
                      size="sm"
                      icon={<RefreshCw className={cn("size-3.5", generating && "animate-[spin_0.8s_linear_infinite]")} />}
                      disabled={generating}
                      onClick={() => {
                        const v = variant + 1;
                        setVariant(v);
                        runGenerate(v, true);
                      }}
                    >
                      Regenerate
                    </Button>
                  </div>
                  {!draft || generating ? (
                    <div aria-busy="true" aria-label="Generating story" className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-fg-subtle">
                        <Wand2 className="size-4 animate-pulse text-accent" aria-hidden /> Reading {pluralize(selectedItems.length, "change")}…
                      </div>
                      <div className="skeleton h-10 w-3/4 rounded" />
                      <div className="skeleton h-5 w-2/3 rounded" />
                      <div className="skeleton mt-8 h-24 w-full rounded" />
                    </div>
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
                      <StoryHeader draft={draft} onChange={patch} />
                      <div className="mt-6">
                        <p className="mb-1.5 text-xs font-medium text-fg-muted">Category</p>
                        <CategoryPicker value={draft.category} onChange={(category) => patch({ category })} />
                      </div>
                      <div className="my-8 h-px bg-line" />
                      <SectionHeader title="Body" description="Edit freely, or add media in the next step." className="mb-5" />
                      <BlockEditor blocks={draft.blocks} onChange={(blocks) => patch({ blocks })} accent={appearance.accent} sources={sources} />
                    </motion.div>
                  )}
                </div>
                <aside className="scrollbar-thin lg:sticky lg:top-24 lg:-mr-2 lg:max-h-[calc(100dvh-7.5rem)] lg:self-start lg:overflow-y-auto lg:pr-2 lg:pb-6">
                  <SourcesPanel
                    sources={sources}
                    candidates={pool}
                    users={users}
                    onAdd={(id) => {
                      setSelectedState((s) => new Set(s).add(id));
                    }}
                    onRemove={(id) => {
                      setSelectedState((s) => {
                        const n = new Set(s);
                        n.delete(id);
                        return n;
                      });
                    }}
                  />
                  <p className="mt-4 text-2xs leading-relaxed text-fg-faint">
                    Shiplog reads conventional-commit types and scopes plus PR descriptions to infer the category, headline and highlights. Changing sources regenerates the story.
                  </p>
                </aside>
              </div>
            )}

            {step === 2 && draft && (
              <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="mx-auto w-full max-w-[720px] md:pl-14">
                  <StoryHeader draft={draft} onChange={patch} />
                  <div className="my-8 h-px bg-line" />
                  <BlockEditor blocks={draft.blocks} onChange={(blocks) => patch({ blocks })} accent={appearance.accent} sources={sources} />
                </div>
                <aside className="space-y-6 scrollbar-thin lg:sticky lg:top-24 lg:-mr-2 lg:max-h-[calc(100dvh-7.5rem)] lg:self-start lg:overflow-y-auto lg:pr-2 lg:pb-6">
                  <section>
                    <SectionHeader title="Cover image" className="mb-3" />
                    <MediaPicker compact label="Cover" value={draft.cover} onChange={(cover) => patch({ cover })} accent={appearance.accent} />
                  </section>
                  <section className="rounded-lg border border-line bg-surface p-3.5 text-xs text-fg-subtle">
                    <p className="font-medium text-fg">Make it visual</p>
                    <p className="mt-1">Releases with a screenshot or short video get read more. Try a before-and-after block for visual changes.</p>
                  </section>
                </aside>
              </div>
            )}

            {step === 3 && previewRelease && <ReleasePreview release={previewRelease} activity={activityIndex} users={users} />}

            {step === 4 && draft && (
              <div className="mx-auto max-w-[620px]">
                <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Ready to ship?</h1>
                <p className="mt-1 text-sm text-fg-subtle">Publish now, schedule it, or keep it as a draft for review.</p>
                <div className="mt-6 rounded-xl border border-line bg-surface p-5">
                  <div className="flex items-center gap-2">
                    <CategoryBadge category={draft.category} />
                    <span className="text-xs text-fg-subtle">{pluralize(sources.length, "source")} · {pluralize(draft.blocks.length, "block")}</span>
                  </div>
                  <p className="mt-3 text-[20px] font-semibold leading-snug tracking-[-0.02em]">{draft.title || "Untitled release"}</p>
                  {draft.summary && <p className="mt-1.5 text-sm text-fg-muted">{draft.summary}</p>}
                  <p className="mt-4 font-mono text-2xs text-fg-faint">/changelog/{workspace.slug}/{previewRelease?.slug}</p>
                </div>
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  <Button size="lg" variant="accent" icon={<Rocket className="size-4" />} onClick={() => setPublishOpen(true)} disabled={!draft.title.trim()}>
                    Publish or schedule…
                  </Button>
                  <Button size="lg" icon={<FileText className="size-4" />} onClick={saveDraft} disabled={!draft.title.trim()}>
                    Save as draft
                  </Button>
                </div>
                {!draft.title.trim() && <p role="alert" className="mt-2 text-xs text-danger">Add a title before publishing.</p>}
                <button onClick={() => go(2)} className="mt-4 text-sm text-fg-subtle hover:text-fg">
                  ← Back to editing
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer navigation */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-canvas/92 backdrop-blur lg:left-[248px]">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
          <Button variant="ghost" icon={<ArrowLeft className="size-3.5" />} onClick={() => (step === 0 ? navigate("/app/releases") : go(step - 1))}>
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          <div className="flex items-center gap-2">
            {step >= 1 && draft && (
              <Button onClick={saveDraft} className="max-sm:hidden">
                Save draft
              </Button>
            )}
            {step < 4 && (
              <Button variant="primary" trailing={<ArrowRight className="size-3.5" />} onClick={() => go(step + 1)} disabled={(step === 0 && selected.size === 0) || (step >= 1 && (!draft || generating))}>
                {step === 0 ? (selected.size ? `Continue with ${pluralize(selected.size, "item")}` : "Select changes to continue") : `Continue to ${STEPS[step + 1].label.toLowerCase()}`}
              </Button>
            )}
          </div>
        </div>
      </div>

      {draft && (
        <PublishDialog
          open={publishOpen}
          onClose={() => {
            setPublishOpen(false);
            if (publishedRef.current && createdId) {
              setDirty(false);
              router.push(`/app/releases/${createdId}`);
            }
          }}
          title={draft.title}
          publicUrl={createdSlug}
          onCopy={(u) => copy(u)}
          onPublish={async () => {
            const id = ensureCreated();
            const r = await publishingService.publish(id);
            publishedRef.current = true;
            setCreatedId(r.id);
          }}
          onSchedule={async (at) => {
            const id = ensureCreated();
            await publishingService.schedule(id, at);
            publishedRef.current = true;
          }}
        />
      )}
    </div>
  );
}
