"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { publishingService } from "@/lib/services/mock";
import { useHydrated, usePublicReleases } from "@/lib/store";
import { ChangelogFrame, ChangelogProvider } from "./context";
import { ChangelogIndex, ReleaseArticle } from "./release-view";

function PublicSkeleton() {
  return (
    <div className="changelog min-h-dvh" aria-busy="true" aria-label="Loading changelog">
      <div className="mx-auto max-w-[1080px] px-8 pt-28">
        <div className="h-3 w-24 rounded bg-[var(--cl-line)]" />
        <div className="mt-6 h-14 w-[min(560px,90%)] rounded bg-[var(--cl-line)]" />
        <div className="mt-5 h-4 w-[min(420px,80%)] rounded bg-[var(--cl-line)]" />
      </div>
    </div>
  );
}

function NotFound({ message }: { message: string }) {
  return (
    <div className="changelog flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="font-serif text-4xl">Not found</p>
      <p className="mt-2 max-w-sm text-[15px] text-[var(--cl-muted)]">{message}</p>
      <Link href="/app/overview" className="mt-6 text-sm font-medium underline underline-offset-4">
        Go to Shiplog
      </Link>
    </div>
  );
}

function usePublicData(slug: string) {
  const data = usePublicReleases(slug);
  const activity = useMemo(() => new Map(data.activity.map((a) => [a.id, a])), [data.activity]);
  const users = useMemo(() => new Map(data.users.map((u) => [u.id, u])), [data.users]);
  return { ...data, activityMap: activity, userMap: users };
}

export function PublicChangelogPage({ slug }: { slug: string }) {
  const hydrated = useHydrated();
  const { workspace, releases, appearance, activityMap, userMap } = usePublicData(slug);

  useEffect(() => {
    if (appearance) document.title = `Changelog · ${appearance.productName}`;
  }, [appearance]);

  if (!hydrated) return <PublicSkeleton />;
  if (!workspace || !appearance) return <NotFound message={`There's no changelog at /changelog/${slug}.`} />;

  return (
    <ChangelogProvider value={{ appearance, activity: activityMap, users: userMap, basePath: `/changelog/${slug}` }}>
      <ChangelogFrame appearance={appearance} className="min-h-dvh">
        <ChangelogIndex releases={releases} />
      </ChangelogFrame>
    </ChangelogProvider>
  );
}

export function PublicReleasePage({ slug, releaseSlug }: { slug: string; releaseSlug: string }) {
  const hydrated = useHydrated();
  const { workspace, releases, appearance, activityMap, userMap } = usePublicData(slug);
  const index = releases.findIndex((r) => r.slug === releaseSlug);
  const release = releases[index];

  useEffect(() => {
    if (release && appearance) document.title = `${release.title} · ${appearance.productName} Changelog`;
  }, [release, appearance]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [releaseSlug]);

  if (!hydrated) return <PublicSkeleton />;
  if (!workspace || !appearance) return <NotFound message={`There's no changelog at /changelog/${slug}.`} />;
  if (!release) return <NotFound message="This update doesn't exist or hasn't been published yet." />;

  return (
    <ChangelogProvider value={{ appearance, activity: activityMap, users: userMap, basePath: `/changelog/${slug}` }}>
      <ChangelogFrame appearance={appearance} className="min-h-dvh">
        <ReleaseArticle
          release={release}
          next={releases[index - 1]}
          prev={releases[index + 1]}
          shareUrl={publishingService.publicUrl(slug, release)}
        />
      </ChangelogFrame>
    </ChangelogProvider>
  );
}
