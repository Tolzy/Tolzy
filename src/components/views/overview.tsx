"use client";

import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, FileText, GitPullRequest, Plus, RefreshCw, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { ActivityRow } from "@/components/app/activity-row";
import { useNow, useSync } from "@/components/app/hooks";
import { GuardedLink, useNavGuard } from "@/components/app/nav-guard";
import { DemoTag, Page, PageHeader, RepoSelector } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { CategoryBadge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { CURRENT_USER_ID } from "@/lib/demo-data";
import { suggestGroups } from "@/lib/story";
import {
  effectiveStatus,
  sortByReleaseDate,
  unreleased,
  useActivity,
  useActivityReleaseMap,
  useReleases,
  useUsers,
  useWorkspace,
} from "@/lib/store";
import type { Release } from "@/lib/types";
import { cn, formatDay, pluralize, relativeTime, relativeTimeLong } from "@/lib/utils";

function greeting(now: number) {
  const h = new Date(now).getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Weekly activity with release markers: shows the rhythm of shipping. */
function CadenceChart({ releases, now }: { releases: Release[]; now: number }) {
  const { repositories } = useWorkspace();
  const all = useActivity();
  const repoIds = new Set(repositories.map((r) => r.id));
  const weeks = 10;
  const WEEK = 7 * 864e5;
  const data = useMemo(() => {
    const start = now - weeks * WEEK;
    const buckets = Array.from({ length: weeks }, (_, i) => ({ i, count: 0, releases: [] as Release[], from: start + i * WEEK }));
    for (const a of all) {
      if (!repoIds.has(a.repoId)) continue;
      const t = new Date(a.createdAt).getTime();
      const idx = Math.floor((t - start) / WEEK);
      if (idx >= 0 && idx < weeks) buckets[idx].count++;
    }
    for (const r of releases) {
      if (effectiveStatus(r, now) !== "published" || !r.publishedAt) continue;
      const idx = Math.floor((new Date(r.publishedAt).getTime() - start) / WEEK);
      if (idx >= 0 && idx < weeks) buckets[idx].releases.push(r);
    }
    return buckets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, releases, now, repositories]);
  const max = Math.max(4, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  const shipped = data.reduce((s, d) => s + d.releases.length, 0);

  return (
    <figure>
      <div
        role="img"
        aria-label={`${total} changes and ${shipped} published releases over the last ${weeks} weeks.`}
        className="flex h-24 items-end gap-1.5"
      >
        {data.map((d) => {
          const shippedWeek = d.releases.length > 0;
          return (
            <div key={d.i} className="group relative flex h-full flex-1 flex-col items-center justify-end" title={`${formatDay(new Date(d.from).toISOString().slice(0, 10), "short")}: ${pluralize(d.count, "change")}${shippedWeek ? ` · shipped “${d.releases.map((r) => r.title).join("”, “")}”` : ""}`}>
              {shippedWeek && <span className="mb-1 size-1.5 rounded-full bg-accent" aria-hidden />}
              <motion.span
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
                transition={{ duration: 0.5, delay: d.i * 0.03, ease: [0.25, 1, 0.5, 1] }}
                className={cn("w-full rounded-[3px] transition-colors", d.i === weeks - 1 ? "bg-fg" : "bg-surface-3 group-hover:bg-line-strong")}
              />
            </div>
          );
        })}
      </div>
      <figcaption className="mt-3 flex items-center justify-between text-2xs text-fg-faint">
        <span>{weeks} weeks ago</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-accent" aria-hidden /> Release</span>
          <span>This week</span>
        </span>
      </figcaption>
    </figure>
  );
}

function ReleaseLine({ release, now }: { release: Release; now: number }) {
  const status = effectiveStatus(release, now);
  return (
    <li>
      <GuardedLink
        href={`/app/releases/${release.id}`}
        className="group flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-surface-2/70"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">{release.title || "Untitled release"}</span>
          <span className="mt-0.5 block truncate text-xs text-fg-subtle">
            {status === "published"
              ? `Published ${formatDay(release.releaseDate, "short")}`
              : status === "scheduled" && release.scheduledFor
                ? `Scheduled ${relativeTimeLong(release.scheduledFor, now)}`
                : `Edited ${relativeTimeLong(release.updatedAt, now)}`}
            {" · "}
            {pluralize(release.activityIds.length, "source")}
          </span>
        </span>
        <CategoryBadge category={release.category} className="hidden sm:inline-flex" />
        <StatusBadge status={status} />
        <ArrowRight className="hidden size-3.5 text-fg-faint opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 sm:block" aria-hidden />
      </GuardedLink>
    </li>
  );
}

export function OverviewView() {
  const now = useNow();
  const { workspace, integration, repository } = useWorkspace();
  const users = useUsers();
  const releases = useReleases();
  const activity = useActivity(repository?.id ?? null);
  const releaseMap = useActivityReleaseMap();
  const { sync, syncing, disabled } = useSync();
  const { navigate } = useNavGuard();

  const pending = useMemo(() => unreleased(activity, releaseMap), [activity, releaseMap]);
  const groups = useMemo(() => suggestGroups(pending), [pending]);
  const drafts = releases.filter((r) => effectiveStatus(r, now) !== "published");
  const published = sortByReleaseDate(releases.filter((r) => effectiveStatus(r, now) === "published"));
  const last = published[0];
  const me = users.get(CURRENT_USER_ID);
  const disconnected = integration.status === "disconnected";

  const subtitle = disconnected
    ? "Connect GitHub to start turning your work into release stories."
    : [
        pending.length ? `${pluralize(pending.length, "change")} since your last release${last ? ` on ${formatDay(last.releaseDate, "short")}` : ""}.` : "Every change has a home in a release.",
        drafts.length ? `${pluralize(drafts.length, "draft")} waiting for review.` : "",
      ].join(" ");

  return (
    <Page>
      <PageHeader
        eyebrow={
          <>
            <RepoSelector />
            {integration.lastSyncedAt && (
              <span className="flex items-center gap-1.5">
                <span className={cn("size-1.5 rounded-full", integration.status === "error" ? "bg-danger" : syncing ? "animate-pulse bg-warning" : "bg-success")} aria-hidden />
                {syncing ? "Syncing…" : `Synced ${relativeTime(integration.lastSyncedAt, now)}`}
              </span>
            )}
            {integration.mode === "demo" && !disconnected && <DemoTag />}
          </>
        }
        title={`${greeting(now)}, ${me?.name.split(" ")[0]}`}
        description={subtitle}
        actions={
          <>
            <Button icon={<RefreshCw className={cn("size-3.5", syncing && "animate-[spin_0.8s_linear_infinite]")} />} onClick={sync} disabled={disabled || syncing}>
              {syncing ? "Syncing" : "Sync now"}
            </Button>
            <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => navigate("/app/releases/new")}>
              Create release
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* ── What to publish next ─────────────────────────────── */}
        <section aria-labelledby="next-heading" className="min-w-0">
          <div className="flex items-end justify-between gap-4 border-b border-line pb-3">
            <div>
              <h2 id="next-heading" className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-3.5 text-accent" aria-hidden /> Ready to become stories
              </h2>
              <p className="mt-0.5 text-xs text-fg-subtle">Unreleased work in {repository?.fullName ?? "your repositories"}, grouped by feature.</p>
            </div>
            <GuardedLink href="/app/activity" className="text-xs font-medium text-fg-subtle transition-colors hover:text-fg">
              All activity →
            </GuardedLink>
          </div>
          {disconnected ? (
            <EmptyState
              icon={<GitPullRequest />}
              title="No repository connected"
              description="Shiplog reads commits and pull requests to suggest release stories. Connect GitHub (demo mode works without credentials)."
              action={<Button variant="primary" onClick={() => navigate("/app/integrations")}>Connect GitHub</Button>}
            />
          ) : groups.length === 0 ? (
            <EmptyState icon={<Sparkles />} title="You're all caught up" description="New pull requests will be grouped into suggested stories after the next sync." action={<Button onClick={sync} loading={syncing} disabled={disabled}>Sync now</Button>} />
          ) : (
            <ol className="divide-y divide-line">
              {groups.map((g, i) => {
                const items = g.activityIds.map((id) => activity.find((a) => a.id === id)!).filter(Boolean);
                const authors = [...new Set(items.map((a) => a.authorId))].map((id) => users.get(id));
                return (
                  <motion.li
                    key={g.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.05 }}
                    className="group flex flex-col gap-3 py-5 sm:flex-row sm:items-center"
                  >
                    <span className="hidden w-6 font-mono text-xs text-fg-faint sm:block">{String(i + 1).padStart(2, "0")}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{g.title}</h3>
                        <CategoryBadge category={g.category} />
                      </div>
                      <p className="mt-1 text-xs text-fg-subtle">{g.rationale}</p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                        {items.slice(0, 3).map((a) => (
                          <span key={a.id} className="max-w-full truncate font-mono text-[11px] text-fg-faint">
                            {a.type === "pull_request" ? `#${a.number}` : a.sha.slice(0, 7)} {a.title.replace(/^\w+(\([^)]*\))?:\s*/, "")}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:pl-4">
                      <span className="flex -space-x-1.5" aria-label={`${authors.length} contributors`}>
                        {authors.map((u) => u && (
                          <span key={u.id} className="inline-flex size-5 items-center justify-center rounded-full text-[8px] font-semibold ring-2 ring-canvas" style={{ background: `oklch(0.9 0.05 ${u.hue})`, color: `oklch(0.38 0.09 ${u.hue})` }} title={u.name}>
                            {u.name.split(" ").map((x) => x[0]).join("")}
                          </span>
                        ))}
                      </span>
                      <Button size="sm" variant={i === 0 ? "accent" : "secondary"} onClick={() => navigate(`/app/releases/new?items=${g.activityIds.join(",")}`)}>
                        Draft story
                      </Button>
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          )}

          {/* ── Drafts & published ──────────────────────────────── */}
          <div className="mt-10 grid gap-10 xl:grid-cols-2">
            <section aria-labelledby="drafts-heading">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <h2 id="drafts-heading" className="text-sm font-semibold">Drafts <span className="ml-1 tabular font-normal text-fg-faint">{drafts.length}</span></h2>
                <GuardedLink href="/app/releases" className="text-xs font-medium text-fg-subtle hover:text-fg">View all</GuardedLink>
              </div>
              {drafts.length ? (
                <ul className="-mx-3 mt-1">{drafts.slice(0, 4).map((r) => <ReleaseLine key={r.id} release={r} now={now} />)}</ul>
              ) : (
                <p className="py-6 text-sm text-fg-subtle">No drafts. Pick a suggested story above to start one.</p>
              )}
            </section>
            <section aria-labelledby="published-heading">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <h2 id="published-heading" className="text-sm font-semibold">Recently published</h2>
                <a href={`/changelog/${workspace.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-medium text-fg-subtle hover:text-fg">
                  Changelog <ArrowUpRight className="size-3" aria-hidden />
                </a>
              </div>
              {published.length ? (
                <ul className="-mx-3 mt-1">{published.slice(0, 4).map((r) => <ReleaseLine key={r.id} release={r} now={now} />)}</ul>
              ) : (
                <p className="py-6 text-sm text-fg-subtle">Nothing published yet. Your first release will appear on the public changelog.</p>
              )}
            </section>
          </div>
        </section>

        {/* ── Right rail ─────────────────────────────────────── */}
        <aside className="flex flex-col gap-10">
          <section aria-labelledby="pulse-heading">
            <h2 id="pulse-heading" className="text-sm font-semibold">Shipping rhythm</h2>
            <dl className="mb-5 mt-3 grid grid-cols-3 gap-3">
              {[
                { label: "Unreleased", value: pending.length },
                { label: "Drafts", value: drafts.length },
                { label: "Published", value: published.length },
              ].map((s) => (
                <div key={s.label}>
                  <dt className="text-2xs text-fg-subtle">{s.label}</dt>
                  <dd className="mt-0.5 text-xl font-semibold tabular tracking-tight">{s.value}</dd>
                </div>
              ))}
            </dl>
            <CadenceChart releases={releases} now={now} />
          </section>

          <section aria-labelledby="recent-heading">
            <div className="flex items-center justify-between">
              <h2 id="recent-heading" className="text-sm font-semibold">Recent activity</h2>
              <span className="font-mono text-2xs text-fg-faint">{repository?.defaultBranch}</span>
            </div>
            {activity.length ? (
              <div className="-mx-4 mt-2">
                {activity.slice(0, 6).map((a) => (
                  <ActivityRow key={a.id} item={a} author={users.get(a.authorId)} compact now={now} />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-fg-subtle">No activity yet.</p>
            )}
          </section>

          {last && (
            <section className="rounded-lg border border-line bg-surface p-4">
              <p className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-[0.06em] text-fg-faint">
                <FileText className="size-3" aria-hidden /> Live on your changelog
              </p>
              <p className="mt-2 font-serif text-lg leading-snug">{last.title}</p>
              <p className="mt-1 text-xs text-fg-subtle">{formatDay(last.releaseDate)}</p>
              <a href={`/changelog/${workspace.slug}/${last.slug}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                View public page <ArrowUpRight className="size-3" aria-hidden />
              </a>
            </section>
          )}
        </aside>
      </div>
    </Page>
  );
}
