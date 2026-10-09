"use client";

import { AnimatePresence, Reorder, motion, useDragControls } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Columns2,
  GitPullRequest,
  GripVertical,
  Heading2,
  Image as ImageIcon,
  Link2,
  List,
  Pilcrow,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import { useRef } from "react";
import { parseVideo } from "../changelog/blocks";
import type { ActivityItem, BlockType, ReleaseContentBlock } from "@/lib/types";
import { cn, isSafeUrl, uid } from "@/lib/utils";
import { IconButton } from "../ui/button";
import { Checkbox, Input, Textarea } from "../ui/form";
import { MenuItem, MenuLabel, Popover, PopoverContent, PopoverTrigger } from "../ui/menu";
import { MediaPicker } from "./media-picker";

/**
 * A compact block editor. Each block type owns a small editing surface; new
 * types are added by extending ReleaseContentBlock, BLOCK_TYPES and the
 * switch in BlockBody — the public renderer handles the same union.
 */

export const BLOCK_TYPES: { type: BlockType; label: string; description: string; icon: React.ReactNode }[] = [
  { type: "paragraph", label: "Paragraph", description: "Plain text", icon: <Pilcrow /> },
  { type: "heading", label: "Heading", description: "Section title", icon: <Heading2 /> },
  { type: "list", label: "Bulleted list", description: "Short highlights", icon: <List /> },
  { type: "image", label: "Image", description: "Screenshot or upload", icon: <ImageIcon /> },
  { type: "video", label: "Video", description: "YouTube, Vimeo or Loom", icon: <Video /> },
  { type: "comparison", label: "Before & after", description: "Drag-to-compare slider", icon: <Columns2 /> },
  { type: "link", label: "Link", description: "Docs, guides, resources", icon: <Link2 /> },
  { type: "pull_requests", label: "Pull requests", description: "Supporting GitHub PRs", icon: <GitPullRequest /> },
];

export function createBlock(type: BlockType, sourceIds: string[] = []): ReleaseContentBlock {
  const id = uid("blk");
  switch (type) {
    case "heading":
      return { id, type, text: "" };
    case "paragraph":
      return { id, type, text: "" };
    case "list":
      return { id, type, items: [""] };
    case "image":
      return { id, type, media: null, caption: "" };
    case "video":
      return { id, type, url: "", title: "", caption: "" };
    case "link":
      return { id, type, url: "", label: "", description: "" };
    case "comparison":
      return { id, type, before: null, after: null, beforeLabel: "Before", afterLabel: "After", caption: "" };
    case "pull_requests":
      return { id, type, activityIds: sourceIds };
  }
}

export function InsertBlockMenu({ onInsert, label = "Add block", align = "start", variant = "inline" }: { onInsert: (t: BlockType) => void; label?: string; align?: "start" | "end"; variant?: "inline" | "button" }) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex items-center gap-1.5 text-sm transition-colors",
          variant === "button"
            ? "h-8 rounded-md border border-dashed border-line-strong px-3 text-fg-subtle hover:border-fg-faint hover:text-fg"
            : "h-7 rounded-md px-2 text-fg-faint hover:bg-surface-2 hover:text-fg",
        )}
      >
        <Plus className="size-3.5" aria-hidden />
        {label}
      </PopoverTrigger>
      <PopoverContent role="menu" label="Insert block" align={align} className="w-64">
        <MenuLabel>Insert</MenuLabel>
        {BLOCK_TYPES.map((b) => (
          <MenuItem key={b.type} icon={b.icon} onSelect={() => onInsert(b.type)} hint={<span className="hidden sm:inline">{b.description}</span>}>
            {b.label}
          </MenuItem>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs text-warning">{children}</p>;
}

function BlockBody({
  block,
  onChange,
  accent,
  sources,
}: {
  block: ReleaseContentBlock;
  onChange: (b: ReleaseContentBlock) => void;
  accent?: string;
  sources: ActivityItem[];
}) {
  const listRefs = useRef<(HTMLInputElement | null)[]>([]);
  switch (block.type) {
    case "heading":
      return (
        <input
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          placeholder="Section heading"
          aria-label="Heading text"
          className="w-full bg-transparent font-serif text-[22px] font-medium tracking-[-0.01em] text-fg placeholder:text-fg-faint focus:outline-none"
        />
      );
    case "paragraph":
      return (
        <Textarea
          bare
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          placeholder="Write something your customers will care about…"
          aria-label="Paragraph text"
          className="text-[15px] leading-[1.7] text-fg"
        />
      );
    case "list":
      return (
        <ul className="space-y-1.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="h-px w-3 shrink-0 bg-accent" aria-hidden />
              <input
                ref={(el) => {
                  listRefs.current[i] = el;
                }}
                value={item}
                aria-label={`List item ${i + 1}`}
                placeholder="List item"
                onChange={(e) => {
                  const items = [...block.items];
                  items[i] = e.target.value;
                  onChange({ ...block, items });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const items = [...block.items];
                    items.splice(i + 1, 0, "");
                    onChange({ ...block, items });
                    requestAnimationFrame(() => listRefs.current[i + 1]?.focus());
                  } else if (e.key === "Backspace" && item === "" && block.items.length > 1) {
                    e.preventDefault();
                    onChange({ ...block, items: block.items.filter((_, j) => j !== i) });
                    requestAnimationFrame(() => listRefs.current[Math.max(0, i - 1)]?.focus());
                  }
                }}
                className="w-full bg-transparent text-[15px] text-fg placeholder:text-fg-faint focus:outline-none"
              />
            </li>
          ))}
          <li className="pl-6 text-2xs text-fg-faint">Enter for a new item · Backspace on an empty item to remove it</li>
        </ul>
      );
    case "image":
      return (
        <div className="space-y-2">
          <MediaPicker value={block.media} onChange={(media) => onChange({ ...block, media })} accent={accent} />
          <Input value={block.caption} onChange={(e) => onChange({ ...block, caption: e.target.value })} placeholder="Caption (optional)" aria-label="Image caption" />
        </div>
      );
    case "video": {
      const parsed = block.url ? parseVideo(block.url) : null;
      return (
        <div className="space-y-2">
          <Input leading={<Video />} value={block.url} onChange={(e) => onChange({ ...block, url: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" aria-label="Video URL" aria-invalid={!!block.url && !isSafeUrl(block.url)} />
          {block.url && !isSafeUrl(block.url) && <FieldError>Enter a full URL starting with https://</FieldError>}
          {block.url && isSafeUrl(block.url) && !parsed && <FieldError>We couldn&apos;t detect YouTube, Vimeo or Loom — it will show as a link card instead.</FieldError>}
          {parsed && <p className="text-xs text-success">{parsed.provider} video detected — readers see a poster until they press play.</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            <Input value={block.title} onChange={(e) => onChange({ ...block, title: e.target.value })} placeholder="Video title" aria-label="Video title" />
            <Input value={block.caption} onChange={(e) => onChange({ ...block, caption: e.target.value })} placeholder="Caption (optional)" aria-label="Video caption" />
          </div>
        </div>
      );
    }
    case "link":
      return (
        <div className="space-y-2">
          <Input leading={<Link2 />} value={block.url} onChange={(e) => onChange({ ...block, url: e.target.value })} placeholder="https://docs.example.com/guide" aria-label="Link URL" aria-invalid={!!block.url && !isSafeUrl(block.url)} />
          {block.url && !isSafeUrl(block.url) && <FieldError>Enter a full URL starting with https://</FieldError>}
          <div className="grid gap-2 sm:grid-cols-2">
            <Input value={block.label} onChange={(e) => onChange({ ...block, label: e.target.value })} placeholder="Link title" aria-label="Link title" />
            <Input value={block.description} onChange={(e) => onChange({ ...block, description: e.target.value })} placeholder="Short description" aria-label="Link description" />
          </div>
        </div>
      );
    case "comparison":
      return (
        <div className="space-y-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Input value={block.beforeLabel} onChange={(e) => onChange({ ...block, beforeLabel: e.target.value })} aria-label="Before label" placeholder="Before" />
              <MediaPicker compact label="Before" value={block.before} onChange={(before) => onChange({ ...block, before })} accent={accent} />
            </div>
            <div className="space-y-2">
              <Input value={block.afterLabel} onChange={(e) => onChange({ ...block, afterLabel: e.target.value })} aria-label="After label" placeholder="After" />
              <MediaPicker compact label="After" value={block.after} onChange={(after) => onChange({ ...block, after })} accent={accent} />
            </div>
          </div>
          <Input value={block.caption} onChange={(e) => onChange({ ...block, caption: e.target.value })} placeholder="Caption (optional)" aria-label="Comparison caption" />
        </div>
      );
    case "pull_requests": {
      const prs = sources.filter((s) => s.type === "pull_request");
      if (!prs.length) return <p className="text-sm text-fg-subtle">This release has no source pull requests yet. Add some from the Sources panel.</p>;
      return (
        <ul className="divide-y divide-line rounded-md border border-line">
          {prs.map((pr) => {
            const on = block.activityIds.includes(pr.id);
            return (
              <li key={pr.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                  <Checkbox
                    checked={on}
                    label={`Show ${pr.title}`}
                    onChange={(v) => onChange({ ...block, activityIds: v ? [...block.activityIds, pr.id] : block.activityIds.filter((x) => x !== pr.id) })}
                  />
                  <GitPullRequest className="size-3.5 text-success" aria-hidden />
                  <span className={cn("min-w-0 flex-1 truncate", !on && "text-fg-subtle")}>{pr.title}</span>
                  <span className="font-mono text-2xs text-fg-faint">#{pr.number}</span>
                </label>
              </li>
            );
          })}
        </ul>
      );
    }
  }
}

const TYPE_LABEL = Object.fromEntries(BLOCK_TYPES.map((b) => [b.type, b])) as Record<BlockType, (typeof BLOCK_TYPES)[number]>;

function BlockItem({
  block,
  index,
  count,
  onChange,
  onRemove,
  onMove,
  onInsertAfter,
  accent,
  sources,
}: {
  block: ReleaseContentBlock;
  index: number;
  count: number;
  onChange: (b: ReleaseContentBlock) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onInsertAfter: (t: BlockType) => void;
  accent?: string;
  sources: ActivityItem[];
}) {
  const controls = useDragControls();
  const meta = TYPE_LABEL[block.type];
  const isText = block.type === "paragraph" || block.type === "heading" || block.type === "list";
  return (
    <Reorder.Item
      as="div"
      value={block}
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.16 } }}
      transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
      className="group/block relative"
      whileDrag={{ scale: 1.01, boxShadow: "0 12px 32px -8px rgb(0 0 0 / 0.18)", zIndex: 10 }}
    >
      <div className={cn("relative -mx-3 rounded-lg px-3 transition-colors focus-within:bg-surface-2/40 hover:bg-surface-2/40", isText ? "py-1.5" : "py-3")}>
        {!isText && (
          <div className="mb-2 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-[0.06em] text-fg-faint [&>svg]:size-3">
            {meta.icon}
            {meta.label}
          </div>
        )}
        <BlockBody block={block} onChange={onChange} accent={accent} sources={sources} />
        {/* Block controls */}
        <div
          className="absolute -left-10 top-1.5 hidden flex-col items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover/block:opacity-100 md:flex"
        >
          <button
            onPointerDown={(e) => controls.start(e)}
            aria-label="Drag to reorder"
            className="flex size-6 cursor-grab touch-none items-center justify-center rounded text-fg-faint hover:bg-surface-2 hover:text-fg active:cursor-grabbing"
            tabIndex={-1}
          >
            <GripVertical className="size-4" />
          </button>
        </div>
        <div className="absolute -top-3 right-2 flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5 opacity-0 shadow-raised transition-opacity focus-within:opacity-100 group-hover/block:opacity-100">
          <IconButton size="sm" label="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUp className="size-3.5" />
          </IconButton>
          <IconButton size="sm" label="Move down" disabled={index === count - 1} onClick={() => onMove(1)}>
            <ArrowDown className="size-3.5" />
          </IconButton>
          <InsertAfter onInsert={onInsertAfter} />
          <IconButton size="sm" label="Delete block" onClick={onRemove} className="hover:!text-danger">
            <Trash2 className="size-3.5" />
          </IconButton>
        </div>
      </div>
    </Reorder.Item>
  );
}

function InsertAfter({ onInsert }: { onInsert: (t: BlockType) => void }) {
  return (
    <Popover>
      <PopoverTrigger aria-label="Insert block below" className="inline-flex size-6 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg">
        <Plus className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent role="menu" label="Insert block below" align="end" className="w-56">
        <MenuLabel>Insert below</MenuLabel>
        {BLOCK_TYPES.map((b) => (
          <MenuItem key={b.type} icon={b.icon} onSelect={() => onInsert(b.type)}>
            {b.label}
          </MenuItem>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function BlockEditor({
  blocks,
  onChange,
  accent,
  sources,
  onRemoveBlock,
}: {
  blocks: ReleaseContentBlock[];
  onChange: (blocks: ReleaseContentBlock[]) => void;
  accent?: string;
  sources: ActivityItem[];
  onRemoveBlock?: (block: ReleaseContentBlock, index: number) => void;
}) {
  const sourceIds = sources.filter((s) => s.type === "pull_request").map((s) => s.id);
  const update = (i: number, b: ReleaseContentBlock) => onChange(blocks.map((x, j) => (j === i ? b : x)));
  const insertAt = (i: number, t: BlockType) => {
    const next = [...blocks];
    next.splice(i, 0, createBlock(t, sourceIds));
    onChange(next);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      <Reorder.Group axis="y" values={blocks} onReorder={onChange} className="space-y-1" as="div">
        <AnimatePresence initial={false}>
          {blocks.map((b, i) => (
            <BlockItem
              key={b.id}
              block={b}
              index={i}
              count={blocks.length}
              onChange={(nb) => update(i, nb)}
              onRemove={() => {
                onRemoveBlock?.(b, i);
                onChange(blocks.filter((x) => x.id !== b.id));
              }}
              onMove={(d) => move(i, d)}
              onInsertAfter={(t) => insertAt(i + 1, t)}
              accent={accent}
              sources={sources}
            />
          ))}
        </AnimatePresence>
      </Reorder.Group>
      {blocks.length === 0 && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6 text-sm text-fg-faint">
          This release has no content yet. Add a paragraph, image or video to tell the story.
        </motion.p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-1">
        <InsertBlockMenu variant="button" onInsert={(t) => insertAt(blocks.length, t)} />
        <span className="ml-1 hidden text-2xs text-fg-faint sm:inline">or quick add:</span>
        {(["paragraph", "heading", "image", "video"] as BlockType[]).map((t) => (
          <button
            key={t}
            onClick={() => insertAt(blocks.length, t)}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg [&>svg]:size-3.5"
          >
            {TYPE_LABEL[t].icon}
            {TYPE_LABEL[t].label}
          </button>
        ))}
      </div>
    </div>
  );
}
