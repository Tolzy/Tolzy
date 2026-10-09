"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Link2, Mail } from "lucide-react";
import { useMemo, useState } from "react";
import type { Category, Release } from "@/lib/types";
import { cn, formatDay, parseDay } from "@/lib/utils";
import { CATEGORY_META } from "../ui/badge";
import { MediaFigure, ReleaseBlocks } from "./blocks";
import { CLink, ProductLogo, useChangelog } from "./context";

export function PublicCategory({ category, className }: { category: Category; className?: string }) {
  const meta = CATEGORY_META[category];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--cl-muted)]", className)}>
      <span className="size-[7px] rounded-[2px]" style={{ background: meta.color }} aria-hidden />
      {meta.label}
    </span>
  );
}

function ReleaseDate({ release, className }: { release: Pick<Release, "releaseDate">; className?: string }) {
  return (
    <time dateTime={release.releaseDate} className={cn("tabular text-[13px] text-[var(--cl-muted)]", className)}>
      {formatDay(release.releaseDate)}
    </time>
  );
}

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.5, delay, ease: [0.25, 1, 0.5, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function CopyLinkButton({ url, className, label = "Copy link" }: { url: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const { preview } = useChangelog();
  return (
    <button
      type="button"
      onClick={() => {
        if (preview) return;
        navigator.clipboard?.writeText(url).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          },
          () => setCopied(false),
        );
      }}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--cl-line)] px-3 text-[13px] font-medium text-[var(--cl-fg)] transition-colors hover:bg-[var(--cl-surface-2)]",
        className,
      )}
    >
      <motion.span key={copied ? "y" : "n"} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.15 }}>
        {copied ? <Check className="size-3.5 text-[var(--cl-accent)]" aria-hidden /> : <Link2 className="size-3.5" aria-hidden />}
      </motion.span>
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}

function SubscribeForm({ compact }: { compact?: boolean }) {
  const { appearance, preview } = useChangelog();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "error" | "done">("idle");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setState("error");
      return;
    }
    try {
      const key = `shiplog:subscribers:${appearance.productName}`;
      const list = JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
      localStorage.setItem(key, JSON.stringify([...new Set([...list, email])]));
    } catch {
      /* non-critical */
    }
    setState("done");
  };
  if (state === "done") {
    return (
      <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} role="status" className="flex items-center gap-2 text-sm text-[var(--cl-fg)]">
        <Check className="size-4 text-[var(--cl-accent)]" aria-hidden /> You&apos;re subscribed. (Demo — no email will be sent.)
      </motion.p>
    );
  }
  return (
    <form onSubmit={submit} noValidate className={cn("flex w-full max-w-md flex-col gap-1.5", compact && "max-w-sm")}>
      <div className="flex gap-2">
        <label htmlFor="cl-email" className="sr-only">
          Email address
        </label>
        <div className="relative flex-1">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cl-faint)]" aria-hidden />
          <input
            id="cl-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (state === "error") setState("idle");
            }}
            placeholder="you@company.com"
            aria-invalid={state === "error"}
            aria-describedby={state === "error" ? "cl-email-error" : undefined}
            className="h-10 w-full rounded-full border border-[var(--cl-line)] bg-[var(--cl-surface)] pl-9 pr-3 text-sm text-[var(--cl-fg)] placeholder:text-[var(--cl-faint)] focus:border-[var(--cl-accent)] focus:outline-none aria-[invalid=true]:border-red-500"
          />
        </div>
        <button
          type="submit"
          className="h-10 shrink-0 rounded-full px-4 text-sm font-medium text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.97]"
          style={{ background: appearance.accent }}
        >
          Subscribe
        </button>
      </div>
      {state === "error" && (
        <p id="cl-email-error" role="alert" className="pl-3 text-xs text-red-600">
          Enter a valid email address.
        </p>
      )}
    </form>
  );
}

function PublicHeader() {
  const { appearance, basePath } = useChangelog();
  return (
    <header className="border-b border-[var(--cl-line)]">
      <div className="mx-auto flex h-16 max-w-[1080px] items-center justify-between px-5 @3xl:px-8">
        <CLink href={basePath} className="flex items-center gap-2.5">
          <ProductLogo appearance={appearance} size={26} />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">{appearance.productName}</span>
          <span className="text-[15px] text-[var(--cl-faint)]">/</span>
          <span className="text-[15px] text-[var(--cl-muted)]">Changelog</span>
        </CLink>
        {appearance.websiteUrl && (
          <a href={appearance.websiteUrl} target="_blank" rel="noreferrer" className="hidden items-center gap-1 text-sm text-[var(--cl-muted)] transition-colors hover:text-[var(--cl-fg)] @md:flex">
            {appearance.websiteUrl.replace(/^https?:\/\//, "")}
            <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
        )}
      </div>
    </header>
  );
}

function PublicFooter() {
  const { appearance } = useChangelog();
  return (
    <footer className="mt-24 border-t border-[var(--cl-line)]">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-8 px-5 py-12 @3xl:flex-row @3xl:items-center @3xl:justify-between @3xl:px-8">
        <div>
          <p className="font-serif text-2xl leading-tight">Get updates in your inbox</p>
          <p className="mt-1 text-sm text-[var(--cl-muted)]">One email when {appearance.productName} ships something worth knowing about.</p>
        </div>
        <SubscribeForm compact />
      </div>
      <div className="mx-auto flex max-w-[1080px] items-center justify-between px-5 pb-10 text-xs text-[var(--cl-faint)] @3xl:px-8">
        <span>© {new Date().getFullYear()} {appearance.productName}</span>
        <a href="/app/overview" className="transition-colors hover:text-[var(--cl-muted)]">
          Published with Shiplog
        </a>
      </div>
    </footer>
  );
}

const FILTERS: (Category | "all")[] = ["all", "feature", "improvement", "fix", "performance", "security"];

function Highlights({ release }: { release: Release }) {
  const list = release.blocks.find((b) => b.type === "list");
  if (!list || list.type !== "list") return null;
  const items = list.items.filter(Boolean).slice(0, 3);
  if (!items.length) return null;
  return (
    <ul className="mt-5 space-y-1.5 text-[15px] text-[var(--cl-fg)]/80">
      {items.map((it, i) => (
        <li key={i} className="relative pl-5">
          <span className="absolute left-0 top-[0.75em] h-px w-2.5 bg-[var(--cl-accent)]" aria-hidden />
          {it}
        </li>
      ))}
    </ul>
  );
}

function FeaturedRelease({ release }: { release: Release }) {
  const { basePath } = useChangelog();
  const href = `${basePath}/${release.slug}`;
  return (
    <Reveal>
      <article className="group relative">
        <div className="mb-5 flex items-center gap-3">
          <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white" style={{ background: "var(--cl-accent)" }}>
            Latest
          </span>
          <ReleaseDate release={release} />
          <PublicCategory category={release.category} />
        </div>
        <div className="grid grid-cols-1 gap-8 @4xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] @4xl:items-center @4xl:gap-12">
          <div className="order-2 @4xl:order-1">
            <h2 className="font-serif text-[40px] font-medium leading-[1.04] tracking-[-0.02em] text-balance @3xl:text-[54px]">
              <CLink href={href} className="decoration-[var(--cl-line)] decoration-1 underline-offset-[6px] hover:underline">
                {release.title}
              </CLink>
            </h2>
            {release.summary && <p className="mt-4 text-[18px] leading-relaxed text-[var(--cl-muted)] text-pretty">{release.summary}</p>}
            <Highlights release={release} />
            <CLink href={href} className="mt-7 inline-flex items-center gap-1.5 text-[15px] font-medium text-[var(--cl-accent)]">
              Read the full update <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </CLink>
          </div>
          {release.cover && (
            <CLink href={href} className="order-1 block @4xl:order-2" aria-label={release.title}>
              <MediaFigure media={release.cover} className="my-0" />
            </CLink>
          )}
        </div>
      </article>
    </Reveal>
  );
}

function TimelineEntry({ release, index }: { release: Release; index: number }) {
  const { basePath, appearance } = useChangelog();
  const href = `${basePath}/${release.slug}`;
  const compact = appearance.density === "compact";
  const timeline = appearance.layout === "timeline";
  // Restrained variation: alternate entries with covers place media differently.
  const mediaFirst = !!release.cover && index % 2 === 1 && !compact;
  return (
    <Reveal delay={Math.min(index, 3) * 0.04}>
      <article className={cn("group relative grid gap-x-12", timeline && "@3xl:grid-cols-[180px_minmax(0,1fr)]", compact ? "py-8" : "py-14")}>
        <div className={cn("mb-3 flex items-center gap-3", timeline && "@3xl:sticky @3xl:top-8 @3xl:mb-0 @3xl:flex-col @3xl:items-start @3xl:gap-1.5 @3xl:self-start")}>
          <ReleaseDate release={release} className={timeline ? "@3xl:text-[14px] @3xl:text-[var(--cl-fg)]" : undefined} />
          {release.version && <span className="font-mono text-[12px] text-[var(--cl-faint)]">v{release.version}</span>}
        </div>
        <div className="min-w-0">
          {mediaFirst && (
            <CLink href={href} className="mb-6 block" aria-label={release.title}>
              <MediaFigure media={release.cover} className="my-0" />
            </CLink>
          )}
          <PublicCategory category={release.category} />
          <h2 className={cn("mt-2.5 font-serif font-medium leading-[1.1] tracking-[-0.015em] text-balance", compact ? "text-[26px]" : "text-[32px] @3xl:text-[38px]")}>
            <CLink href={href} className="decoration-[var(--cl-line)] decoration-1 underline-offset-[5px] hover:underline">
              {release.title}
            </CLink>
          </h2>
          {release.summary && <p className={cn("mt-3 leading-relaxed text-[var(--cl-muted)] text-pretty", compact ? "text-[15px]" : "text-[17px]")}>{release.summary}</p>}
          {!compact && release.cover && !mediaFirst && (
            <CLink href={href} className="mt-7 block" aria-label={release.title}>
              <MediaFigure media={release.cover} className="my-0" />
            </CLink>
          )}
          {!compact && !release.cover && <Highlights release={release} />}
          <CLink href={href} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--cl-fg)] transition-colors hover:text-[var(--cl-accent)]">
            Read more <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </CLink>
        </div>
      </article>
    </Reveal>
  );
}

/** The public changelog index page. */
export function ChangelogIndex({ releases }: { releases: Release[] }) {
  const { appearance } = useChangelog();
  const [filter, setFilter] = useState<Category | "all">("all");
  const featured = appearance.showFeatured ? releases[0] : undefined;
  const rest = useMemo(() => {
    const list = featured ? releases.slice(1) : releases;
    return filter === "all" ? list : list.filter((r) => r.category === filter);
  }, [releases, featured, filter]);
  const present = new Set(releases.map((r) => r.category));
  const filters = FILTERS.filter((f) => f === "all" || present.has(f));

  // Month dividers make long histories easier to scan.
  let lastMonth = "";

  return (
    <div className="min-h-full">
      <PublicHeader />
      <main className="mx-auto max-w-[1080px] px-5 @3xl:px-8">
        <section className="pb-12 pt-14 @3xl:pb-16 @3xl:pt-24">
          <Reveal>
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-[var(--cl-accent)]">Changelog</p>
            <h1 className="mt-4 max-w-3xl font-serif text-[44px] font-medium leading-[1.02] tracking-[-0.025em] text-balance @3xl:text-[68px]">
              What&apos;s new in {appearance.productName}
            </h1>
            {appearance.description && <p className="mt-5 max-w-xl text-[18px] leading-relaxed text-[var(--cl-muted)] text-pretty">{appearance.description}</p>}
            <div className="mt-8">
              <SubscribeForm />
            </div>
          </Reveal>
        </section>

        {releases.length === 0 ? (
          <section className="border-t border-[var(--cl-line)] py-24 text-center">
            <p className="font-serif text-3xl">Nothing published yet</p>
            <p className="mx-auto mt-2 max-w-sm text-[15px] text-[var(--cl-muted)]">The first update from the {appearance.productName} team will appear here.</p>
          </section>
        ) : (
          <>
            {featured && (
              <section aria-label="Latest release" className="border-t border-[var(--cl-line)] py-14 @3xl:py-20">
                <FeaturedRelease release={featured} />
              </section>
            )}
            <section aria-label="All releases" className="border-t border-[var(--cl-line)]">
              <div className="flex flex-wrap items-center justify-between gap-4 py-6">
                <h2 className="text-sm font-medium text-[var(--cl-fg)]">{featured ? "Earlier updates" : "All updates"}</h2>
                <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-1.5">
                  {filters.map((f) => (
                    <button
                      key={f}
                      aria-pressed={filter === f}
                      onClick={() => setFilter(f)}
                      className={cn(
                        "h-7 rounded-full border px-3 text-[12.5px] font-medium transition-colors",
                        filter === f
                          ? "border-[var(--cl-fg)] bg-[var(--cl-fg)] text-[var(--cl-bg)]"
                          : "border-[var(--cl-line)] text-[var(--cl-muted)] hover:border-[var(--cl-faint)] hover:text-[var(--cl-fg)]",
                      )}
                    >
                      {f === "all" ? "All" : CATEGORY_META[f].label}
                    </button>
                  ))}
                </div>
              </div>
              {rest.length === 0 && (
                <p className="border-t border-[var(--cl-line)] py-16 text-center text-[15px] text-[var(--cl-muted)]">No {filter !== "all" && CATEGORY_META[filter].label.toLowerCase()} updates yet.</p>
              )}
              <div className={cn(appearance.layout === "timeline" && "relative")}>
                {rest.map((r, i) => {
                  const month = parseDay(r.releaseDate).toLocaleDateString("en-US", { month: "long", year: "numeric" });
                  const showMonth = month !== lastMonth;
                  lastMonth = month;
                  return (
                    <div key={r.id} className="border-t border-[var(--cl-line)]">
                      {showMonth && appearance.layout === "journal" && (
                        <p className="pt-8 text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--cl-faint)]">{month}</p>
                      )}
                      <TimelineEntry release={r} index={i} />
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

/** A single release, used for detail pages and for the editor preview. */
export function ReleaseArticle({ release, prev, next, shareUrl }: { release: Release; prev?: Release; next?: Release; shareUrl?: string }) {
  const { basePath, appearance } = useChangelog();
  const reduce = useReducedMotion();
  return (
    <div className="min-h-full">
      <PublicHeader />
      <main className="mx-auto max-w-[1080px] px-5 @3xl:px-8">
        <motion.article
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
          className="mx-auto max-w-[720px] pt-10 @3xl:pt-14"
        >
          <CLink href={basePath} className="group inline-flex items-center gap-1.5 text-sm text-[var(--cl-muted)] transition-colors hover:text-[var(--cl-fg)]">
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden /> Back to all updates
          </CLink>
          <header className="mt-10 @3xl:mt-14">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <ReleaseDate release={release} />
              <PublicCategory category={release.category} />
              {release.version && <span className="font-mono text-[12px] text-[var(--cl-faint)]">v{release.version}</span>}
            </div>
            <h1 className="mt-5 font-serif text-[42px] font-medium leading-[1.04] tracking-[-0.025em] text-balance @3xl:text-[60px]">
              {release.title || "Untitled release"}
            </h1>
            {release.summary && <p className="mt-5 text-[20px] leading-relaxed text-[var(--cl-muted)] text-pretty">{release.summary}</p>}
            {shareUrl && (
              <div className="mt-7 flex items-center gap-2">
                <CopyLinkButton url={shareUrl} />
              </div>
            )}
          </header>
        </motion.article>
        {release.cover && (
          <div className="mx-auto mt-10 max-w-[920px]">
            <MediaFigure media={release.cover} className="my-0" />
          </div>
        )}
        <div className="mx-auto max-w-[720px] pt-4">
          <ReleaseBlocks blocks={release.blocks} />
        </div>
        {(prev || next) && (
          <nav aria-label="More updates" className="mx-auto mt-16 grid max-w-[720px] gap-3 border-t border-[var(--cl-line)] pt-8 @xl:grid-cols-2">
            {next ? (
              <CLink href={`${basePath}/${next.slug}`} className="group rounded-xl border border-[var(--cl-line)] p-4 transition-colors hover:border-[var(--cl-faint)]">
                <span className="flex items-center gap-1.5 text-xs text-[var(--cl-muted)]"><ArrowLeft className="size-3" aria-hidden /> Newer</span>
                <span className="mt-1.5 block font-serif text-lg leading-snug">{next.title}</span>
              </CLink>
            ) : <span />}
            {prev && (
              <CLink href={`${basePath}/${prev.slug}`} className="group rounded-xl border border-[var(--cl-line)] p-4 text-right transition-colors hover:border-[var(--cl-faint)]">
                <span className="flex items-center justify-end gap-1.5 text-xs text-[var(--cl-muted)]">Older <ArrowRight className="size-3" aria-hidden /></span>
                <span className="mt-1.5 block font-serif text-lg leading-snug">{prev.title}</span>
              </CLink>
            )}
          </nav>
        )}
        <span className="sr-only">{appearance.productName}</span>
      </main>
      <PublicFooter />
    </div>
  );
}
