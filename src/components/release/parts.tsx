"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  CalendarClock,
  Check,
  Copy,
  ExternalLink,
  Monitor,
  Plus,
  Rocket,
  Smartphone,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ActivityItem, Category, Release, ReleaseDraft, User } from "@/lib/types";
import { cn, formatDateTime, pluralize, relativeTime } from "@/lib/utils";
import { ActivityIcon, ConventionalTag } from "../app/activity-row";
import { ChangelogFrame, ChangelogProvider } from "../changelog/context";
import { ReleaseArticle } from "../changelog/release-view";
import { Avatar } from "../ui/avatar";
import { CATEGORIES, CATEGORY_META } from "../ui/badge";
import { Button, IconButton } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Input, Textarea } from "../ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/menu";
import { Segmented } from "../ui/misc";
import { useWorkspace } from "@/lib/store";

export function CategoryPicker({ value, onChange }: { value: Category; onChange: (c: Category) => void }) {
  return (
    <div role="radiogroup" aria-label="Category" className="flex flex-wrap gap-1.5">
      {CATEGORIES.map((c) => {
        const active = c === value;
        return (
          <button
            key={c}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(c)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-[background-color,border-color,color] active:scale-[0.97]",
              active ? "border-fg bg-invert text-invert-fg" : "border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg",
            )}
          >
            <span className="size-1.5 rounded-[2px]" style={{ background: CATEGORY_META[c].color }} aria-hidden />
            {CATEGORY_META[c].label}
          </button>
        );
      })}
    </div>
  );
}

/** Title + summary in an editorial, form-less style. */
export function StoryHeader({ draft, onChange, autoFocus }: { draft: Pick<ReleaseDraft, "title" | "summary">; onChange: (p: Partial<ReleaseDraft>) => void; autoFocus?: boolean }) {
  return (
    <div>
      <label htmlFor="release-title" className="sr-only">Title</label>
      <Textarea
        bare
        id="release-title"
        autoFocus={autoFocus}
        value={draft.title}
        onChange={(e) => onChange({ title: e.target.value.replace(/\n/g, "") })}
        placeholder="Release title"
        aria-invalid={!draft.title.trim()}
        className="font-serif text-[34px] font-medium leading-[1.1] tracking-[-0.02em] text-fg placeholder:text-fg-faint focus:outline-none sm:text-[40px]"
      />
      <label htmlFor="release-summary" className="sr-only">Summary</label>
      <Textarea
        bare
        id="release-summary"
        value={draft.summary}
        onChange={(e) => onChange({ summary: e.target.value })}
        placeholder="A one-sentence summary for the changelog list"
        className="mt-2 text-[17px] leading-relaxed text-fg-muted placeholder:text-fg-faint focus:outline-none"
      />
    </div>
  );
}

/** Associated activity with add/remove. */
export function SourcesPanel({
  sources,
  candidates,
  users,
  onAdd,
  onRemove,
}: {
  sources: ActivityItem[];
  candidates: ActivityItem[];
  users: Map<string, User>;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => candidates.filter((c) => !sources.some((s) => s.id === c.id) && c.title.toLowerCase().includes(q.toLowerCase())).slice(0, 12),
    [candidates, sources, q],
  );
  const prs = sources.filter((s) => s.type === "pull_request").length;
  return (
    <section aria-labelledby="sources-heading">
      <div className="flex items-center justify-between">
        <h3 id="sources-heading" className="text-xs font-semibold text-fg">
          Source activity
          <span className="ml-1.5 font-normal text-fg-faint">
            {pluralize(prs, "PR")} · {pluralize(sources.length - prs, "commit")}
          </span>
        </h3>
        <Popover>
          <PopoverTrigger aria-label="Add source activity" className="inline-flex size-6 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg">
            <Plus className="size-3.5" />
          </PopoverTrigger>
          <PopoverContent label="Add activity" align="end" className="w-[320px] p-2">
            <Input data-autofocus placeholder="Search unreleased activity…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search activity to add" />
            <ul className="scrollbar-thin mt-2 max-h-64 overflow-y-auto">
              {filtered.length === 0 && <li className="px-2 py-4 text-center text-xs text-fg-subtle">No unreleased activity to add.</li>}
              {filtered.map((c) => (
                <li key={c.id}>
                  <button onClick={() => onAdd(c.id)} className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-2">
                    <ActivityIcon item={c} className="mt-px size-3.5" />
                    <span className="min-w-0 flex-1 truncate text-fg">{c.title}</span>
                    <Plus className="size-3 shrink-0 text-fg-faint" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      </div>
      <ul className="mt-2 space-y-px">
        <AnimatePresence initial={false}>
          {sources.map((s) => (
            <motion.li
              key={s.id}
              layout
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 4, transition: { duration: 0.12 } }}
              className="group flex items-start gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-surface-2/70"
            >
              <ActivityIcon item={s} className="mt-0.5 size-3.5" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-fg">{s.title.replace(/^\w+(\([^)]*\))?!?:\s*/, "")}</p>
                <p className="mt-0.5 flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-2xs text-fg-faint">
                  <ConventionalTag title={s.title} className="text-[10px]" />
                  <span className="font-mono">{s.type === "pull_request" ? `#${s.number}` : s.sha.slice(0, 7)}</span>
                  <Avatar user={users.get(s.authorId)} size={12} />
                  {relativeTime(s.createdAt)}
                </p>
              </div>
              <a href={s.url} target="_blank" rel="noreferrer" aria-label="Open on GitHub" className="rounded p-0.5 text-fg-faint opacity-0 transition-opacity hover:text-fg focus-visible:opacity-100 group-hover:opacity-100">
                <ExternalLink className="size-3" />
              </a>
              <button onClick={() => onRemove(s.id)} aria-label={`Remove ${s.title} from release`} className="rounded p-0.5 text-fg-faint opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100">
                <X className="size-3" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {sources.length === 0 && <p className="mt-2 rounded-md border border-dashed border-line-strong p-3 text-xs text-fg-subtle">No linked activity. Add commits or pull requests so readers can trace the work.</p>}
    </section>
  );
}

/** Renders the draft with the same components as the public changelog. */
export function ReleasePreview({ release, activity, users, className }: { release: Release; activity: Map<string, ActivityItem>; users: Map<string, User>; className?: string }) {
  const { workspace, appearance } = useWorkspace();
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-xs text-fg-subtle">
          <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
          <span className="truncate font-mono">/changelog/{workspace.slug}/{release.slug}</span>
        </p>
        <Segmented
          size="sm"
          label="Preview device"
          value={device}
          onChange={setDevice}
          options={[
            { value: "desktop", label: "Desktop", icon: <Monitor /> },
            { value: "mobile", label: "Mobile", icon: <Smartphone /> },
          ]}
        />
      </div>
      <motion.div
        layout
        transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
        className={cn(
          "mx-auto w-full overflow-hidden border border-line bg-surface shadow-pop",
          device === "mobile" ? "max-w-[390px] rounded-[28px] border-[6px] border-invert" : "rounded-xl",
        )}
      >
        {device === "desktop" && (
          <div className="flex h-8 items-center gap-1.5 border-b border-line bg-surface-2 px-3">
            {[0, 1, 2].map((i) => <span key={i} className="size-2.5 rounded-full bg-line-strong" />)}
            <span className="mx-auto truncate rounded px-3 font-mono text-2xs text-fg-faint">{appearance.productName.toLowerCase()}.example/changelog</span>
          </div>
        )}
        <div className={cn("scrollbar-thin overflow-y-auto", device === "mobile" ? "h-[720px]" : "max-h-[78vh]")}>
          <ChangelogProvider value={{ appearance, activity, users, basePath: `/changelog/${workspace.slug}`, preview: true }}>
            <ChangelogFrame appearance={appearance}>
              <ReleaseArticle release={release} shareUrl="#" />
            </ChangelogFrame>
          </ChangelogProvider>
        </div>
      </motion.div>
    </div>
  );
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Publish flow: publish now or schedule, then a success state. */
export function PublishDialog({
  open,
  onClose,
  title,
  onPublish,
  onSchedule,
  publicUrl,
  onCopy,
  isUpdate,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  onPublish: () => Promise<void>;
  onSchedule: (at: string) => Promise<void>;
  publicUrl: string | null;
  onCopy: (url: string) => void;
  isUpdate?: boolean;
}) {
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [when, setWhen] = useState(() => {
    const d = new Date(Date.now() + 864e5);
    d.setHours(9, 0, 0, 0);
    return toLocalInput(d);
  });
  const [state, setState] = useState<"idle" | "working" | "done" | "scheduled">("idle");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    onClose();
    setTimeout(() => {
      setState("idle");
      setError(null);
    }, 200);
  };

  const submit = async () => {
    setError(null);
    setState("working");
    try {
      if (mode === "now") {
        await onPublish();
        setState("done");
      } else {
        const at = new Date(when);
        if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) throw new Error("Choose a date and time in the future.");
        await onSchedule(at.toISOString());
        setState("scheduled");
      }
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  };

  const done = state === "done" || state === "scheduled";

  return (
    <Dialog open={open} onClose={close} title={done ? "Release published" : isUpdate ? "Publish changes" : "Publish release"} bare={done} description={done ? undefined : `“${title || "Untitled release"}” will appear on your public changelog.`}>
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
              className={cn("flex size-12 items-center justify-center rounded-full", state === "done" ? "bg-success text-white" : "bg-warning-soft text-warning")}
            >
              {state === "done" ? (
                <svg viewBox="0 0 24 24" className="size-6" fill="none">
                  <motion.path d="M5 12.5 10 17 19 7.5" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.15, ease: "easeOut" }} />
                </svg>
              ) : (
                <CalendarClock className="size-5" />
              )}
            </motion.div>
            <h2 className="mt-4 text-md font-semibold">{state === "done" ? "It's live" : "Scheduled"}</h2>
            <p className="mt-1 max-w-xs text-sm text-fg-subtle">
              {state === "done" ? `“${title}” is now on your public changelog.` : `“${title}” will go live ${formatDateTime(new Date(when).toISOString())}.`}
            </p>
            {publicUrl && state === "done" && (
              <div className="mt-5 flex w-full items-center gap-2 rounded-md border border-line bg-surface-2 py-1 pl-3 pr-1">
                <span className="min-w-0 flex-1 truncate text-left font-mono text-xs text-fg-muted">{publicUrl}</span>
                <IconButton label="Copy link" size="sm" onClick={() => onCopy(publicUrl)}>
                  <Copy className="size-3.5" />
                </IconButton>
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <Button onClick={close}>Back to editor</Button>
              {publicUrl && state === "done" && (
                <Button variant="primary" icon={<ArrowUpRight className="size-3.5" />} onClick={() => window.open(publicUrl, "_blank")}>
                  View changelog
                </Button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="form" exit={{ opacity: 0 }}>
            <div role="radiogroup" aria-label="When to publish" className="grid gap-2">
              {[
                { v: "now" as const, icon: <Rocket className="size-4" />, label: "Publish now", desc: "Goes live on the changelog immediately." },
                { v: "schedule" as const, icon: <CalendarClock className="size-4" />, label: "Schedule", desc: "Pick a date and time to go live." },
              ].map((o) => (
                <button
                  key={o.v}
                  role="radio"
                  aria-checked={mode === o.v}
                  onClick={() => setMode(o.v)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-left transition-[border-color,background-color]",
                    mode === o.v ? "border-accent bg-accent-soft/50" : "border-line hover:border-line-strong",
                  )}
                >
                  <span className={cn("mt-0.5", mode === o.v ? "text-accent" : "text-fg-subtle")}>{o.icon}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{o.label}</span>
                    <span className="block text-xs text-fg-subtle">{o.desc}</span>
                  </span>
                  <span className={cn("mt-0.5 flex size-4 items-center justify-center rounded-full border", mode === o.v ? "border-accent bg-accent text-accent-fg" : "border-line-strong")}>
                    {mode === o.v && <Check className="size-2.5" strokeWidth={3} />}
                  </span>
                </button>
              ))}
            </div>
            <AnimatePresence initial={false}>
              {mode === "schedule" && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <label htmlFor="schedule-at" className="mt-4 block text-xs font-medium text-fg-muted">Go live at</label>
                  <Input id="schedule-at" type="datetime-local" value={when} min={toLocalInput(new Date())} onChange={(e) => setWhen(e.target.value)} className="mt-1.5" />
                  <p className="mt-1.5 text-2xs text-fg-faint">Prototype: scheduled releases appear on the changelog once this time passes while the page is open.</p>
                </motion.div>
              )}
            </AnimatePresence>
            {error && <p role="alert" className="mt-3 text-xs text-danger">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={close}>Cancel</Button>
              <Button variant="accent" loading={state === "working"} onClick={submit} icon={mode === "now" ? <Rocket className="size-3.5" /> : <CalendarClock className="size-3.5" />}>
                {state === "working" ? (mode === "now" ? "Publishing…" : "Scheduling…") : mode === "now" ? "Publish now" : "Schedule"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
