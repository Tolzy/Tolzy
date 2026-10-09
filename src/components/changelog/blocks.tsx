"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, GitPullRequest, Play } from "lucide-react";
import { useId, useState } from "react";
import type { MediaAsset, ReleaseContentBlock } from "@/lib/types";
import { cn, hostname, isSafeUrl } from "@/lib/utils";
import { humanizeSubject, parseTitle } from "@/lib/story";
import { MediaView } from "../release/illustration";
import { useChangelog } from "./context";

/** Shared typographic rhythm for release prose. */
export const prose = "text-[17px] leading-[1.7] text-[var(--cl-fg)]/85 @3xl:text-[17.5px]";

function Figure({ children, caption, className }: { children: React.ReactNode; caption?: string; className?: string }) {
  return (
    <figure className={cn("my-8", className)}>
      <div className="overflow-hidden rounded-xl border border-[var(--cl-line)] bg-[var(--cl-surface)]">{children}</div>
      {caption && <figcaption className="mt-3 text-sm text-[var(--cl-muted)]">{caption}</figcaption>}
    </figure>
  );
}

export function MediaFigure({ media, caption, className }: { media: MediaAsset | null; caption?: string; className?: string }) {
  const { appearance } = useChangelog();
  if (!media) return null;
  return (
    <Figure caption={caption} className={className}>
      <motion.div whileHover={{ scale: 1.012 }} transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}>
        <MediaView media={media} accent={appearance.accent} />
      </motion.div>
    </Figure>
  );
}

/** Before/after slider. Keyboard accessible via a native range input. */
export function Comparison({ before, after, beforeLabel, afterLabel, caption }: { before: MediaAsset | null; after: MediaAsset | null; beforeLabel: string; afterLabel: string; caption: string }) {
  const { appearance } = useChangelog();
  const [pos, setPos] = useState(50);
  const id = useId();
  if (!before || !after) return null;
  return (
    <Figure caption={caption}>
      <div className="relative select-none">
        <MediaView media={after} accent={appearance.accent} />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <MediaView media={before} accent={appearance.accent} />
        </div>
        <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
          <div className="absolute inset-y-0 -ml-px w-0.5 bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.15)]" />
          <div className="absolute top-1/2 -ml-4 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#171717] shadow-[0_2px_8px_rgb(0_0_0/0.25)]">
            <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
              <path d="M6 4 2 8l4 4M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/65 px-2 py-1 text-xs font-medium text-white backdrop-blur">{beforeLabel}</span>
        <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/65 px-2 py-1 text-xs font-medium text-white backdrop-blur">{afterLabel}</span>
        <label htmlFor={id} className="sr-only">
          Compare {beforeLabel} and {afterLabel}
        </label>
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>
    </Figure>
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

/** Video facade: an attractive poster until the reader chooses to play. */
export function Video({ url, title, caption }: { url: string; title: string; caption: string }) {
  const { appearance, preview } = useChangelog();
  const [playing, setPlaying] = useState(false);
  const parsed = parseVideo(url);
  if (!url) return null;
  if (!parsed) return <LinkCard url={url} label={title || "Watch the video"} description={caption} />;
  return (
    <Figure caption={caption}>
      <div className="relative aspect-video">
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
            className="group absolute inset-0 flex flex-col justify-between overflow-hidden p-5 text-left text-white @lg:p-7"
            style={{
              background: `radial-gradient(120% 90% at 85% 10%, color-mix(in srgb, ${appearance.accent} 75%, transparent) 0%, transparent 55%), linear-gradient(160deg, #1b1b1a 0%, #0d0d0c 100%)`,
            }}
            aria-label={`Play video: ${title || "video"} (${parsed.provider})`}
          >
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-white/60">{parsed.provider} · Video</span>
            <span className="flex items-end justify-between gap-4">
              <span className="max-w-[70%] font-serif text-2xl leading-tight text-balance @2xl:text-3xl">{title || "Watch the walkthrough"}</span>
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-[#111] shadow-lg transition-transform duration-200 group-hover:scale-105 @2xl:size-14">
                <Play className="ml-0.5 size-5 fill-current" aria-hidden />
              </span>
            </span>
          </button>
        )}
      </div>
    </Figure>
  );
}

export function LinkCard({ url, label, description }: { url: string; label: string; description: string }) {
  const { preview } = useChangelog();
  const safe = isSafeUrl(url);
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-[var(--cl-fg)]">{label || hostname(url)}</span>
        {description && <span className="mt-0.5 block text-sm text-[var(--cl-muted)]">{description}</span>}
        <span className="mt-1.5 block font-mono text-xs text-[var(--cl-faint)]">{hostname(url)}</span>
      </span>
      <ArrowUpRight className="size-4 shrink-0 text-[var(--cl-muted)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
    </>
  );
  const cls = "group my-6 flex items-start gap-4 rounded-xl border border-[var(--cl-line)] bg-[var(--cl-surface)] p-4 transition-colors hover:border-[var(--cl-faint)]";
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
    <div className="my-8">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.1em] text-[var(--cl-muted)]">Pull requests</h3>
      <ul className="divide-y divide-[var(--cl-line)] border-y border-[var(--cl-line)]">
        {items.map((a) => {
          const author = users.get(a!.authorId);
          const content = (
            <>
              <GitPullRequest className="mt-0.5 size-4 shrink-0 text-[var(--cl-accent)]" aria-hidden />
              <span className="min-w-0 flex-1 text-[15px] text-[var(--cl-fg)]">{humanizeSubject(parseTitle(a!.title).subject)}</span>
              <span className="shrink-0 font-mono text-xs text-[var(--cl-faint)]">
                #{a!.number}
                {author && <span className="hidden @md:inline"> · @{author.handle}</span>}
              </span>
            </>
          );
          return (
            <li key={a!.id}>
              {preview ? (
                <div className="flex items-start gap-3 py-2.5">{content}</div>
              ) : (
                <a href={a!.url} target="_blank" rel="noreferrer noopener" className="flex items-start gap-3 py-2.5 transition-opacity hover:opacity-70">
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
              <h2 key={b.id} className="mb-3 mt-10 font-serif text-[26px] font-medium leading-tight tracking-[-0.01em] text-[var(--cl-fg)]">
                {b.text}
              </h2>
            ) : null;
          case "paragraph":
            return b.text.trim() ? (
              <p key={b.id} className="my-5 whitespace-pre-line text-pretty">
                {b.text}
              </p>
            ) : null;
          case "list": {
            const items = b.items.filter((i) => i.trim());
            return items.length ? (
              <ul key={b.id} className="my-5 space-y-2">
                {items.map((item, i) => (
                  <li key={i} className="relative pl-6 text-pretty">
                    <span className="absolute left-0 top-[0.72em] h-px w-3 bg-[var(--cl-accent)]" aria-hidden />
                    {item}
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
