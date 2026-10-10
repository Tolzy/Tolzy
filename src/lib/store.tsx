"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { db } from "./services/db";
import type { DbState } from "./services/storage";
import type { ActivityItem, Release, ReleaseStatus } from "./types";

const subscribe = (l: () => void) => db.subscribe(l);
const getSnapshot = () => db.get();
const getHydrated = () => db.hydrated;
const getServerHydrated = () => false;

/** Whole-store snapshot. */
export function useDb(): DbState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Hydrates from local storage once on the client. */
export function useHydrated() {
  const hydrated = useSyncExternalStore(subscribe, getHydrated, getServerHydrated);
  useEffect(() => {
    db.hydrate();
  }, []);
  return hydrated;
}

export function useWorkspace() {
  const s = useDb();
  const workspace = s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? s.workspaces[0];
  const integration = s.integrations[workspace.id];
  const repositories = s.repositories.filter(
    (r) => r.workspaceId === workspace.id && integration.connectedRepoIds.includes(r.id),
  );
  const activeRepoId = s.activeRepoId[workspace.id];
  const repository = repositories.find((r) => r.id === activeRepoId) ?? repositories[0] ?? null;
  return { workspace, workspaces: s.workspaces, integration, repositories, repository, appearance: s.appearance[workspace.id] };
}

export function useSwitchWorkspace() {
  return useCallback((id: string) => db.update((s) => ({ ...s, activeWorkspaceId: id })), []);
}

export function useAppTheme() {
  const s = useDb();
  const set = useCallback((t: "light" | "dark") => db.update((st) => ({ ...st, appTheme: t })), []);
  return [s.appTheme, set] as const;
}

export function useUsers() {
  const s = useDb();
  return useMemo(() => new Map(s.users.map((u) => [u.id, u])), [s.users]);
}

export function useReleases(workspaceId?: string) {
  const s = useDb();
  const wsId = workspaceId ?? s.activeWorkspaceId;
  return useMemo(
    () => s.releases.filter((r) => r.workspaceId === wsId),
    [s.releases, wsId],
  );
}

export function useRelease(id: string | undefined) {
  const s = useDb();
  return s.releases.find((r) => r.id === id) ?? null;
}

/** A release is live on the public changelog when published, or when its scheduled time has passed. */
export function isLive(r: Release, now = Date.now()) {
  return r.status === "published" || (r.status === "scheduled" && !!r.scheduledFor && new Date(r.scheduledFor).getTime() <= now);
}

export function effectiveStatus(r: Release, now = Date.now()): ReleaseStatus {
  return isLive(r, now) ? "published" : r.status;
}

export function sortByReleaseDate(list: Release[]) {
  return [...list].sort((a, b) =>
    b.releaseDate.localeCompare(a.releaseDate) ||
    (b.publishedAt ?? b.updatedAt).localeCompare(a.publishedAt ?? a.updatedAt),
  );
}

export function usePublicReleases(workspaceSlug: string) {
  const s = useDb();
  const workspace = s.workspaces.find((w) => w.slug === workspaceSlug) ?? null;
  const releases = useMemo(
    () => (workspace ? sortByReleaseDate(s.releases.filter((r) => r.workspaceId === workspace.id && isLive(r))) : []),
    [s.releases, workspace],
  );
  return { workspace, releases, appearance: workspace ? s.appearance[workspace.id] : null, activity: s.activity, users: s.users };
}

/**
 * Activity newest first. Omit `repoId` for every repository; pass `null`
 * (no repository connected) for an empty list.
 */
export function useActivity(repoId?: string | null) {
  const s = useDb();
  return useMemo(() => {
    if (repoId === null) return [];
    const list = repoId ? s.activity.filter((a) => a.repoId === repoId) : s.activity;
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [s.activity, repoId]);
}

export function useActivityIndex() {
  const s = useDb();
  return useMemo(() => new Map(s.activity.map((a) => [a.id, a])), [s.activity]);
}

/** Map activity id → release that includes it (for "in release" badges). */
export function useActivityReleaseMap(workspaceId?: string) {
  const releases = useReleases(workspaceId);
  return useMemo(() => {
    const m = new Map<string, Release>();
    for (const r of releases) for (const id of r.activityIds) {
      const prev = m.get(id);
      // Prefer showing the published release over a draft.
      if (!prev || (prev.status !== "published" && r.status === "published")) m.set(id, r);
    }
    return m;
  }, [releases]);
}

export function unreleased(items: ActivityItem[], map: Map<string, Release>) {
  return items.filter((i) => !map.has(i.id));
}
