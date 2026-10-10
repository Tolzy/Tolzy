"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Columns2, GitPullRequest, Play, SplitSquareHorizontal } from "lucide-react";
import { Fragment, useId, useState } from "react";
import type { MediaAsset, ReleaseContentBlock } from "@/lib/types";
import { cn, hostname, isSafeUrl } from "@/lib/utils";
import { humanizeSubject, parseTitle } from "@/lib/story";
import { MediaView } from "../release/illustration";
import { useChangelog } from "./context";

/** Shared typographic rhythm for release prose. */
export const prose = "text-[15.5px] leading-[1.85] text-[var(--cl-body)] @2xl:text-[16px]";

/** Renders `inline code` spans; everything else stays plain text. */
export function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`\n]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("`") && p.endsWith("`") && p.length > 2 ? <code key={i}>{p.slice(1, -1)}</code> : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  );
}

/** Section heading with a hairline that runs to the edge of the column. */
export function SectionHeading({ children, as: Tag = "h2", className, id }: { children: React.ReactNode; as?: "h2" | "h3"; className?: string; id?: string }) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <Tag id={id} className="shrink-0 text-[15.5px] font-semibold tracking-[-0.011em] text-[var(--cl-fg)] @2xl:text-[16px]">
        {children}
      </Tag>
      <span aria-hidden className="h-px flex-1 bg-[var(--cl-line)]" />
    </div>
  );
}

/** A bordered frame for media, with a centred caption beneath. */
export function Frame({ children, caption, className, footer, inset = true }: { children: React.ReactNode; caption?: string; className?: string; footer?: React.ReactNode; inset?: boolean }) {
  return (
    <figure className={cn("my-10", className)}>
      <div className="overflow-hidden rounded-2xl border border-[var(--cl-line)] bg-[var(--cl-surface)]">
        <div className={cn(inset && "p-2 @lg:p-3")}>{children}</div>
        {footer}
      </div>
      {caption && <figcaption className="mt-3.5 text-center text-[13px] leading-relaxed text-[var(--cl-muted)] text-pretty">{caption}</figcaption>}
    </figure>
  );
}

function Media({ media, className }: { media: MediaAsset; className?: string }) {
  const { appearance } = useChangelog();
  return (
    <div className={cn("overflow-hidden rounded-[10px] border border-[var(--cl-line)]", className)}>
      <MediaView media={media} accent={appearance.accent} />
    </div>
  );
}

export function MediaFigure({ media, caption, className }: { media: MediaAsset | null; caption?: string; className?: string }) {
  if (!media) return null;
  return (
    <Frame caption={caption} className={className}>
      <Media media={media} />
    </Frame>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full border border-[var(--cl-line)] bg-[var(--cl-surface-2)] px-2.5 font-mono text-[11.5px] text-[var(--cl-muted)] @max-lg:h-5 @max-lg:px-2 @max-lg:text-[10px]", className)}>
      {children}
    </span>
  );
}

/**
 * Before/after block. Readers can drag a reveal slider or switch to a
 * side-by-side view. Both modes are keyboard accessible.
 */
export function Comparison({ before, after, beforeLabel, afterLabel, caption }: { before: MediaAsset | null; after: MediaAsset | null; beforeLabel: string; afterLabel: string; caption: string }) {
  const { appearance } = useChangelog();
  const [pos, setPos] = useState(50);
  const [mode, setMode] = useState<"slider" | "split">("slider");
  const id = useId();
  if (!before || !after) return null;

  const footer = (
    <div className="flex items-center gap-4 border-t border-[var(--cl-line)] px-4 py-3">
      {mode === "slider" ? (
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between text-[13px]">
            <label htmlFor={id} className="text-[var(--cl-muted)]">Reveal</label>
            <span className="font-mono text-[12px] tabular text-[var(--cl-fg)]">{pos}%</span>
          </div>
          <input
            id={id}
            type="range"
            min={0}
            max={100}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            aria-valuetext={`${pos}% ${beforeLabel}`}
            className="cl-range w-full"
            style={{ ["--pos" as string]: `${pos}%` }}
          />
        </div>
      ) : (
        <p className="flex-1 text-[13px] text-[var(--cl-muted)]">
          {beforeLabel} and {afterLabel}, side by side.
        </p>
      )}
      <span aria-hidden className="h-8 w-px bg-[var(--cl-line)]" />
      <button
        type="button"
        onClick={() => setMode((m) => (m === "slider" ? "split" : "slider"))}
        aria-pressed={mode === "split"}
        className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-[var(--cl-line)] px-3.5 text-[13px] font-medium text-[var(--cl-fg)] transition-colors hover:bg-[var(--cl-surface-2)] active:scale-[0.97]"
      >
        {mode === "slider" ? <Columns2 className="size-3.5" aria-hidden /> : <SplitSquareHorizontal className="size-3.5" aria-hidden />}
        {mode === "slider" ? "Side by side" : "Slider"}
      </button>
    </div>
  );

  return (
    <Frame caption={caption} footer={footer}>
      <AnimatePresence mode="wait" initial={false}>
        {mode === "slider" ? (
          <motion.div key="slider" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="relative select-none overflow-hidden rounded-[10px] border border-[var(--cl-line)]">
            <MediaView media={after} accent={appearance.accent} />
            <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
              <MediaView media={before} accent={appearance.accent} />
            </div>
            <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
              <div className="absolute inset-y-0 -ml-px w-0.5 bg-white/90 shadow-[0_0_0_1px_rgb(0_0_0/0.12)]" />
              <div className="absolute top-1/2 -ml-[15px] flex size-[30px] -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#111] shadow-[0_2px_10px_rgb(0_0_0/0.25)]">
                <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
                  <path d="M6 4 2 8l4 4M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <Chip className="pointer-events-none absolute left-2 top-2 border-white/10 @lg:left-3 @lg:top-3 bg-black/60 text-white/85 backdrop-blur">{beforeLabel}</Chip>
            <Chip className="pointer-events-none absolute right-2 top-2 border-white/10 @lg:right-3 @lg:top-3 bg-black/60 text-white/85 backdrop-blur">{afterLabel}</Chip>
            {/* Drag directly on the image; the footer slider is the accessible control. */}
            <input
              type="range"
              min={0}
              max={100}
              value={pos}
              onChange={(e) => setPos(Number(e.target.value))}
              tabIndex={-1}
              aria-hidden
              className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
            />
          </motion.div>
        ) : (
          <motion.div key="split" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="grid gap-3 p-1 @xl:grid-cols-2">
            {[
              { m: before, l: beforeLabel },
              { m: after, l: afterLabel },
            ].map((x) => (
              <div key={x.l} className="flex flex-col gap-2.5">
                <Chip className="self-start">{x.l}</Chip>
                <Media media={x.m} />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </Frame>
  );
}

export function parseVideo(url: string): { provider: string; embed: string } | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return { provider: "YouTube", embed: `https://www.youtube-nocookie.com/embed/${v}?autoplay=1&rel=0` };
    }
    if (host === "youtu.be") return { provider: "YouTube", embed: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}?autoplay=1&rel=0` };
    if (host === "vimeo.com") {
      const vid = u.pathname.split("/").filter(Boolean)[0];
      if (vid && /^\d+$/.test(vid)) return { provider: "Vimeo", embed: `https://player.vimeo.com/video/${vid}?autoplay=1` };
    }
    if (host === "loom.com") {
      const vid = u.pathname.split("/").pop();
      if (vid) return { provider: "Loom", embed: `https://www.loom.com/embed/${vid}?autoplay=1` };
    }
  } catch {
    /* fall through */
  }
  return null;
}

/** Video facade: a quiet poster until the reader chooses to play. */
export function Video({ url, title, caption }: { url: string; title: string; caption: string }) {
  const { preview } = useChangelog();
  const [playing, setPlaying] = useState(false);
  const parsed = parseVideo(url);
  if (!url) return null;
  if (!parsed) return <LinkCard url={url} label={title || "Watch the video"} description={caption} />;
  return (
    <Frame caption={caption}>
      <div className="relative aspect-video overflow-hidden rounded-[10px] border border-[var(--cl-line)] bg-[#0c0c0c]">
        {playing ? (
          <iframe
            src={parsed.embed}
            title={title || "Video"}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <button
            onClick={() => !preview && setPlaying(true)}
            className="group absolute inset-0 flex flex-col items-center justify-center gap-4 text-white"
            style={{ backgroundImage: "linear-gradient(rgb(255 255 255 / 0.04) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.04) 1px, transparent 1px)", backgroundSize: "32px 32px" }}
            aria-label={`Play video: ${title || "video"} (${parsed.provider})`}
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-white text-[#111] shadow-[0_8px_30px_rgb(0_0_0/0.4)] transition-transform duration-200 group-hover:scale-[1.06] group-active:scale-95">
              <Play className="ml-0.5 size-5 fill-current" aria-hidden />
            </span>
            <span className="px-6 text-center">
              <span className="block text-[15px] font-medium tracking-[-0.01em]">{title || "Watch the walkthrough"}</span>
              <span className="mt-1 block font-mono text-[11.5px] text-white/50">{parsed.provider}</span>
            </span>
          </button>
        )}
      </div>
    </Frame>
  );
}

export function LinkCard({ url, label, description }: { url: string; label: string; description: string }) {
  const { preview } = useChangelog();
  const safe = isSafeUrl(url);
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium tracking-[-0.01em] text-[var(--cl-fg)]">{label || hostname(url)}</span>
        {description && <span className="mt-0.5 block text-[14px] leading-relaxed text-[var(--cl-muted)]">{description}</span>}
        <span className="mt-2 block font-mono text-[11.5px] text-[var(--cl-faint)]">{hostname(url)}</span>
      </span>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--cl-line)] text-[var(--cl-muted)] transition-colors group-hover:text-[var(--cl-fg)]">
        <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-px" aria-hidden />
      </span>
    </>
  );
  const cls = "group my-8 flex items-start gap-4 rounded-2xl border border-[var(--cl-line)] bg-[var(--cl-surface)] p-4 transition-colors hover:border-[var(--cl-faint)]/50 @lg:p-5";
  if (!safe || preview) return <div className={cls}>{inner}</div>;
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" className={cls}>
      {inner}
    </a>
  );
}

export function PullRequests({ ids }: { ids: string[] }) {
  const { activity, users, preview } = useChangelog();
  const items = ids.map((id) => activity.get(id)).filter(Boolean);
  if (!items.length) return null;
  return (
    <div className="mt-12">
      <SectionHeading as="h3">Pull requests</SectionHeading>
      <ul className="mt-4 divide-y divide-[var(--cl-line)]">
        {items.map((a) => {
          const author = users.get(a!.authorId);
          const content = (
            <>
              <GitPullRequest className="mt-[3px] size-4 shrink-0 text-[var(--cl-muted)]" aria-hidden />
              <span className="min-w-0 flex-1 text-[14.5px] leading-relaxed text-[var(--cl-body)]">{humanizeSubject(parseTitle(a!.title).subject)}</span>
              <span className="shrink-0 pt-[3px] font-mono text-[11.5px] text-[var(--cl-faint)]">
                #{a!.number}
                {author && <span className="hidden @md:inline"> · @{author.handle}</span>}
              </span>
            </>
          );
          return (
            <li key={a!.id}>
              {preview ? (
                <div className="flex items-start gap-3 py-3">{content}</div>
              ) : (
                <a href={a!.url} target="_blank" rel="noreferrer noopener" className="flex items-start gap-3 py-3 transition-opacity hover:opacity-70">
                  {content}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ReleaseBlocks({ blocks, limit }: { blocks: ReleaseContentBlock[]; limit?: number }) {
  const list = limit ? blocks.slice(0, limit) : blocks;
  return (
    <div className={prose}>
      {list.map((b) => {
        switch (b.type) {
          case "heading":
            return b.text.trim() ? (
              <SectionHeading key={b.id} className="mb-4 mt-14 first:mt-0">
                <Inline text={b.text} />
              </SectionHeading>
            ) : null;
          case "paragraph":
            return b.text.trim() ? (
              <p key={b.id} className="my-5 whitespace-pre-line text-pretty first:mt-0">
                <Inline text={b.text} />
              </p>
            ) : null;
          case "list": {
            const items = b.items.filter((i) => i.trim());
            return items.length ? (
              <ul key={b.id} className="my-5 space-y-2.5">
                {items.map((item, i) => (
                  <li key={i} className="relative pl-5 text-pretty">
                    <span className="absolute left-0 top-[0.92em] size-[5px] -translate-y-1/2 rounded-full bg-[var(--cl-faint)]" aria-hidden />
                    <Inline text={item} />
                  </li>
                ))}
              </ul>
            ) : null;
          }
          case "image":
            return <MediaFigure key={b.id} media={b.media} caption={b.caption} />;
          case "video":
            return <Video key={b.id} url={b.url} title={b.title} caption={b.caption} />;
          case "link":
            return b.url ? <LinkCard key={b.id} url={b.url} label={b.label} description={b.description} /> : null;
          case "comparison":
            return <Comparison key={b.id} {...b} />;
          case "pull_requests":
            return <PullRequests key={b.id} ids={b.activityIds} />;
        }
      })}
    </div>
  );
}
