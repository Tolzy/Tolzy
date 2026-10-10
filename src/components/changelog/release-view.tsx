"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Link2, Mail } from "lucide-react";
import { useMemo, useState } from "react";
import type { Category, Release } from "@/lib/types";
import { cn, formatDay, parseDay } from "@/lib/utils";
import { CATEGORY_META } from "../ui/badge";
import { MediaView } from "../release/illustration";
import { Inline, MediaFigure, ReleaseBlocks, SectionHeading } from "./blocks";
import { CLink, ProductLogo, useChangelog } from "./context";

const EASE = [0.25, 1, 0.5, 1] as const;

export function PublicCategory({ category, className }: { category: Category; className?: string }) {
  const meta = CATEGORY_META[category];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] text-[var(--cl-muted)]", className)}>
      <span className="size-1.5 rounded-full" style={{ background: meta.color }} aria-hidden />
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

function Meta({ release, className }: { release: Release; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      <ReleaseDate release={release} />
      <span className="text-[var(--cl-faint)]" aria-hidden>·</span>
      <PublicCategory category={release.category} />
      {release.version && (
        <>
          <span className="text-[var(--cl-faint)]" aria-hidden>·</span>
          <span className="font-mono text-[12px] text-[var(--cl-faint)]">v{release.version}</span>
        </>
      )}
    </div>
  );
}

/** Gentle reveal for entries as they scroll into view. */
function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.45, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Round icon button, used for back / copy link on detail pages. */
function RoundButton({ children, label, onClick, href }: { children: React.ReactNode; label: string; onClick?: () => void; href?: string }) {
  const cls =
    "inline-flex size-10 items-center justify-center rounded-full bg-[var(--cl-surface-2)] text-[var(--cl-muted)] transition-[color,background-color,transform] hover:text-[var(--cl-fg)] active:scale-95";
  if (href)
    return (
      <CLink href={href} aria-label={label} className={cls}>
        {children}
      </CLink>
    );
  return (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const { preview } = useChangelog();
  return (
    <RoundButton
      label={copied ? "Link copied" : "Copy link to this update"}
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
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={copied ? "y" : "n"} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.14 }} className="flex">
          {copied ? <Check className="size-4 text-[var(--cl-fg)]" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
        </motion.span>
      </AnimatePresence>
      <span className="sr-only" aria-live="polite">{copied ? "Copied" : ""}</span>
    </RoundButton>
  );
}

function SubscribeForm({ id = "cl-email" }: { id?: string }) {
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
      <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} role="status" className="flex h-10 items-center gap-2 text-[14px] text-[var(--cl-fg)]">
        <Check className="size-4" aria-hidden /> Subscribed. <span className="text-[var(--cl-muted)]">Demo only — no email will be sent.</span>
      </motion.p>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="flex w-full max-w-[400px] flex-col gap-1.5">
      <div className="flex gap-2">
        <label htmlFor={id} className="sr-only">Email address</label>
        <div className="relative flex-1">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--cl-faint)]" aria-hidden />
          <input
            id={id}
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (state === "error") setState("idle");
            }}
            placeholder="you@company.com"
            aria-invalid={state === "error"}
            aria-describedby={state === "error" ? `${id}-error` : undefined}
            className="h-10 w-full rounded-full border border-[var(--cl-line)] bg-[var(--cl-surface)] pl-10 pr-3 text-[14px] text-[var(--cl-fg)] placeholder:text-[var(--cl-faint)] transition-colors focus:border-[var(--cl-faint)] focus:outline-none aria-[invalid=true]:border-red-500/70"
          />
        </div>
        <button
          type="submit"
          className="h-10 shrink-0 rounded-full bg-[var(--cl-fg)] px-4 text-[14px] font-medium text-[var(--cl-bg)] transition-[opacity,transform] hover:opacity-90 active:scale-[0.97]"
        >
          Subscribe
        </button>
      </div>
      {state === "error" && (
        <p id={`${id}-error`} role="alert" className="pl-4 text-[12.5px] text-red-500">
          Enter a valid email address.
        </p>
      )}
    </form>
  );
}

const WRAP = "mx-auto w-full max-w-[880px] px-5 @3xl:px-8";

function PublicHeader() {
  const { appearance, basePath } = useChangelog();
  return (
    <header className={cn(WRAP, "flex h-16 items-center justify-between")}>
      <CLink href={basePath} className="flex items-center gap-2.5 rounded-md">
        <ProductLogo appearance={appearance} size={24} />
        <span className="text-[14.5px] font-semibold tracking-[-0.011em]">{appearance.productName}</span>
        <span className="text-[14.5px] text-[var(--cl-faint)]">Changelog</span>
      </CLink>
      {appearance.websiteUrl && (
        <a href={appearance.websiteUrl} target="_blank" rel="noreferrer" className="hidden items-center gap-1 text-[13.5px] text-[var(--cl-muted)] transition-colors hover:text-[var(--cl-fg)] @md:flex">
          {appearance.websiteUrl.replace(/^https?:\/\//, "")}
          <ArrowUpRight className="size-3.5" aria-hidden />
        </a>
      )}
    </header>
  );
}

function PublicFooter() {
  const { appearance } = useChangelog();
  return (
    <footer className={cn(WRAP, "mt-28 pb-12")}>
      <SectionHeading as="h2">Stay in the loop</SectionHeading>
      <div className="mt-5 flex flex-col gap-5 @3xl:flex-row @3xl:items-center @3xl:justify-between">
        <p className="max-w-sm text-[15px] leading-relaxed text-[var(--cl-muted)]">One short email when {appearance.productName} ships something worth knowing about.</p>
        <SubscribeForm id="cl-footer-email" />
      </div>
      <div className="mt-16 flex items-center justify-between text-[12.5px] text-[var(--cl-faint)]">
        <span>© {new Date().getFullYear()} {appearance.productName}</span>
        <a href="/app/overview" className="transition-colors hover:text-[var(--cl-muted)]">Published with Shiplog</a>
      </div>
    </footer>
  );
}

const FILTERS: (Category | "all")[] = ["all", "feature", "improvement", "fix", "performance", "security"];

function Highlights({ release, max = 3 }: { release: Release; max?: number }) {
  const list = release.blocks.find((b) => b.type === "list");
  if (!list || list.type !== "list") return null;
  const items = list.items.filter(Boolean).slice(0, max);
  if (!items.length) return null;
  return (
    <ul className="mt-4 space-y-1.5 text-[15px] leading-relaxed text-[var(--cl-body)]">
      {items.map((it, i) => (
        <li key={i} className="relative pl-5">
          <span className="absolute left-0 top-[0.8em] size-[5px] -translate-y-1/2 rounded-full bg-[var(--cl-faint)]" aria-hidden />
          <Inline text={it} />
        </li>
      ))}
    </ul>
  );
}

function ReadMore({ href, label = "Read more" }: { href: string; label?: string }) {
  return (
    <CLink href={href} className="group/rm mt-5 inline-flex items-center gap-1.5 rounded text-[14px] font-medium text-[var(--cl-fg)]">
      {label}
      <ArrowRight className="size-3.5 text-[var(--cl-muted)] transition-transform duration-200 group-hover/rm:translate-x-0.5" aria-hidden />
    </CLink>
  );
}

function FeaturedRelease({ release }: { release: Release }) {
  const { basePath, appearance } = useChangelog();
  const href = `${basePath}/${release.slug}`;
  return (
    <Reveal>
      <article className="overflow-hidden rounded-2xl border border-[var(--cl-line)] bg-[var(--cl-surface)]">
        {release.cover && (
          <CLink href={href} aria-label={release.title} className="block border-b border-[var(--cl-line)] p-2 @lg:p-3">
            <motion.div whileHover={{ scale: 1.006 }} transition={{ duration: 0.35, ease: EASE }}>
              <div className="overflow-hidden rounded-[10px] border border-[var(--cl-line)]">
                <MediaView media={release.cover} accent={appearance.accent} />
              </div>
            </motion.div>
          </CLink>
        )}
        <div className="p-5 @lg:p-7">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[var(--cl-line)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--cl-fg)]">Latest</span>
            <Meta release={release} />
          </div>
          <h2 className="mt-4 text-[24px] font-semibold leading-[1.2] tracking-[-0.022em] text-balance @3xl:text-[28px]">
            <CLink href={href} className="rounded transition-opacity hover:opacity-75">{release.title}</CLink>
          </h2>
          {release.summary && <p className="mt-2.5 max-w-[60ch] text-[16px] leading-[1.75] text-[var(--cl-muted)] text-pretty">{release.summary}</p>}
          <Highlights release={release} />
          <ReadMore href={href} label="Read the full update" />
        </div>
      </article>
    </Reveal>
  );
}

function TimelineEntry({ release, index, last }: { release: Release; index: number; last: boolean }) {
  const { basePath, appearance } = useChangelog();
  const href = `${basePath}/${release.slug}`;
  const compact = appearance.density === "compact";
  const timeline = appearance.layout === "timeline";
  // Restrained variation: alternate entries with covers place media first.
  const mediaFirst = !!release.cover && index % 2 === 1 && !compact;
  return (
    <Reveal delay={Math.min(index, 3) * 0.03}>
      <article className={cn("relative grid", timeline && "@3xl:grid-cols-[148px_minmax(0,1fr)]")}>
        <div className={cn("mb-2.5", timeline && "@3xl:mb-0 @3xl:pt-[3px]")}>
          <div className={cn(timeline && "@3xl:sticky @3xl:top-8")}>
            <ReleaseDate release={release} />
            {release.version && <span className="ml-2 font-mono text-[12px] text-[var(--cl-faint)] @3xl:ml-0 @3xl:mt-0.5 @3xl:block">v{release.version}</span>}
          </div>
        </div>
        <div className={cn("relative min-w-0", timeline && "@3xl:border-l @3xl:border-[var(--cl-line)] @3xl:pl-10", compact ? "pb-10" : "pb-16", last && "pb-2")}>
          {timeline && <span aria-hidden className="absolute -left-[4px] top-[9px] hidden size-[7px] rounded-full border border-[var(--cl-faint)] bg-[var(--cl-bg)] @3xl:block" />}
          {mediaFirst && (
            <CLink href={href} className="block" aria-label={release.title}>
              <MediaFigure media={release.cover} className="mb-6 mt-0" />
            </CLink>
          )}
          <PublicCategory category={release.category} />
          <h2 className={cn("mt-1.5 font-semibold leading-[1.25] tracking-[-0.02em] text-balance", compact ? "text-[18px]" : "text-[20px] @3xl:text-[22px]")}>
            <CLink href={href} className="rounded transition-opacity hover:opacity-75">{release.title}</CLink>
          </h2>
          {release.summary && <p className={cn("mt-2 max-w-[62ch] leading-[1.75] text-[var(--cl-muted)] text-pretty", compact ? "text-[14.5px]" : "text-[15.5px]")}>{release.summary}</p>}
          {!compact && release.cover && !mediaFirst && (
            <CLink href={href} className="block" aria-label={release.title}>
              <MediaFigure media={release.cover} className="mb-0 mt-6" />
            </CLink>
          )}
          {!compact && !release.cover && <Highlights release={release} />}
          <ReadMore href={href} />
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
  const present = new Set((featured ? releases.slice(1) : releases).map((r) => r.category));
  const filters = FILTERS.filter((f) => f === "all" || present.has(f));
  const timeline = appearance.layout === "timeline";

  let lastMonth = "";

  return (
    <div className="min-h-full">
      <PublicHeader />
      <main className={WRAP}>
        <section className={cn("pb-14 pt-14 @3xl:pb-20 @3xl:pt-20", timeline && "@3xl:pl-[148px]")}>
          <Reveal>
            <h1 className="text-[30px] font-semibold leading-[1.15] tracking-[-0.028em] text-balance @3xl:text-[36px]">
              What&apos;s new in {appearance.productName}
            </h1>
            {appearance.description && <p className="mt-4 max-w-[52ch] text-[16px] leading-[1.8] text-[var(--cl-muted)] text-pretty">{appearance.description}</p>}
            <div className="mt-7">
              <SubscribeForm />
            </div>
          </Reveal>
        </section>

        {releases.length === 0 ? (
          <section className={cn("py-20", timeline && "@3xl:pl-[148px]")}>
            <SectionHeading>Nothing published yet</SectionHeading>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-[var(--cl-muted)]">The first update from the {appearance.productName} team will appear here.</p>
          </section>
        ) : (
          <>
            {featured && (
              <section aria-label="Latest release" className={cn("pb-20", timeline && "@3xl:pl-[148px]")}>
                <FeaturedRelease release={featured} />
              </section>
            )}
            {(rest.length > 0 || filter !== "all") && (
              <section aria-labelledby="all-updates">
                <div className={cn("mb-10 flex flex-col gap-4", timeline && "@3xl:pl-[148px]")}>
                  <SectionHeading id="all-updates">{featured ? "Earlier updates" : "All updates"}</SectionHeading>
                  {filters.length > 2 && (
                    <div role="group" aria-label="Filter by category" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
                      {filters.map((f) => (
                        <button
                          key={f}
                          aria-pressed={filter === f}
                          onClick={() => setFilter(f)}
                          className={cn(
                            "relative h-8 shrink-0 rounded-full px-3 text-[13px] transition-colors",
                            filter === f ? "text-[var(--cl-fg)]" : "text-[var(--cl-muted)] hover:text-[var(--cl-fg)]",
                          )}
                        >
                          {filter === f && <motion.span layoutId="cl-filter" className="absolute inset-0 rounded-full bg-[var(--cl-surface-2)]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                          <span className="relative">{f === "all" ? "All" : CATEGORY_META[f].label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {rest.length === 0 && (
                  <p className={cn("pb-10 text-[15px] text-[var(--cl-muted)]", timeline && "@3xl:pl-[148px]")}>
                    No {filter !== "all" && CATEGORY_META[filter].label.toLowerCase()} updates yet.
                  </p>
                )}
                <div>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {rest.map((r, i) => {
                      const month = parseDay(r.releaseDate).toLocaleDateString("en-US", { month: "long", year: "numeric" });
                      const showMonth = !timeline && month !== lastMonth;
                      lastMonth = month;
                      return (
                        <motion.div
                          key={r.id}
                          layout="position"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0, transition: { duration: 0.12 } }}
                          transition={{ duration: 0.25, ease: EASE }}
                        >
                          {showMonth && <p className="mb-6 text-[12.5px] font-medium uppercase tracking-[0.08em] text-[var(--cl-faint)]">{month}</p>}
                          <TimelineEntry release={r} index={i} last={i === rest.length - 1} />
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

/** A single release, used for detail pages and for the editor preview. */
export function ReleaseArticle({ release, prev, next, shareUrl }: { release: Release; prev?: Release; next?: Release; shareUrl?: string }) {
  const { basePath } = useChangelog();
  const reduce = useReducedMotion();
  return (
    <div className="min-h-full">
      <PublicHeader />
      <main className="mx-auto w-full max-w-[720px] px-5 @3xl:px-0">
        <div className="flex items-center justify-between pt-8 @3xl:pt-12">
          <RoundButton href={basePath} label="Back to all updates">
            <ArrowLeft className="size-4" aria-hidden />
          </RoundButton>
          {shareUrl && <CopyLinkButton url={shareUrl} />}
        </div>
        <motion.article
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="pt-12 @3xl:pt-16"
        >
          <header>
            <Meta release={release} />
            <h1 className="mt-4 text-[28px] font-semibold leading-[1.18] tracking-[-0.026em] text-balance @3xl:text-[34px]">
              {release.title || "Untitled release"}
            </h1>
            {release.summary && <p className="mt-4 text-[17px] leading-[1.75] text-[var(--cl-muted)] text-pretty">{release.summary}</p>}
          </header>
          {release.cover && <MediaFigure media={release.cover} className="mb-12 mt-10" />}
          <div className={cn(!release.cover && "mt-12")}>
            <ReleaseBlocks blocks={release.blocks} />
          </div>
        </motion.article>
        {(prev || next) && (
          <nav aria-label="More updates" className="mt-20">
            <SectionHeading as="h2">More updates</SectionHeading>
            <div className="mt-5 grid gap-3 @xl:grid-cols-2">
              {next ? (
                <CLink href={`${basePath}/${next.slug}`} className="group rounded-2xl border border-[var(--cl-line)] p-4 transition-colors hover:bg-[var(--cl-surface-2)]">
                  <span className="flex items-center gap-1.5 text-[12.5px] text-[var(--cl-muted)]">
                    <ArrowLeft className="size-3 transition-transform group-hover:-translate-x-0.5" aria-hidden /> Newer
                  </span>
                  <span className="mt-1.5 block text-[15px] font-medium leading-snug tracking-[-0.011em]">{next.title}</span>
                </CLink>
              ) : (
                <span className="hidden @xl:block" />
              )}
              {prev && (
                <CLink href={`${basePath}/${prev.slug}`} className="group rounded-2xl border border-[var(--cl-line)] p-4 text-right transition-colors hover:bg-[var(--cl-surface-2)]">
                  <span className="flex items-center justify-end gap-1.5 text-[12.5px] text-[var(--cl-muted)]">
                    Older <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                  <span className="mt-1.5 block text-[15px] font-medium leading-snug tracking-[-0.011em]">{prev.title}</span>
                </CLink>
              )}
            </div>
          </nav>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

