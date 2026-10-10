// Demo implementations of the Shiplog services. They operate on the local
// db and add realistic latency so loading states are real, not decorative.

import { AVAILABLE_REPOSITORIES, DEFAULT_APPEARANCE, pendingSyncActivity } from "../demo-data";
import { suggestGroups } from "../story";
import type { Release, Repository } from "../types";
import { sleep, toDay, uid, uniqueSlug } from "../utils";
import type {
  ActivityService,
  AppearanceService,
  PublishingService,
  ReleaseService,
  RepositoryService,
} from "./contracts";
import { db } from "./db";

const latency = (factor = 1) => sleep(db.get().demo.latency * factor);

export const repositoryService: RepositoryService = {
  async listAvailable(workspaceId) {
    await latency(0.8);
    const s = db.get();
    const integ = s.integrations[workspaceId];
    if (integ.status === "disconnected") throw new Error("GitHub is not connected.");
    const connected = new Set(
      s.repositories.filter((r) => integ.connectedRepoIds.includes(r.id)).map((r) => r.fullName),
    );
    return AVAILABLE_REPOSITORIES.map((r) => ({ ...r, connected: connected.has(r.fullName) }));
  },

  async connectAccount(workspaceId) {
    await latency(2);
    db.update((s) => ({
      ...s,
      integrations: {
        ...s.integrations,
        [workspaceId]: { ...s.integrations[workspaceId], status: "connected", account: "orbit-labs", lastError: null },
      },
    }));
  },

  async disconnectAccount(workspaceId) {
    await latency();
    db.update((s) => ({
      ...s,
      activeRepoId: { ...s.activeRepoId, [workspaceId]: null },
      integrations: {
        ...s.integrations,
        [workspaceId]: { ...s.integrations[workspaceId], status: "disconnected", account: null, connectedRepoIds: [], lastSyncedAt: null, lastError: null },
      },
    }));
  },

  async setConnectedRepositories(workspaceId, fullNames) {
    await latency();
    let connected: Repository[] = [];
    db.update((s) => {
      const repos = [...s.repositories];
      for (const name of fullNames) {
        if (!repos.some((r) => r.workspaceId === workspaceId && r.fullName === name)) {
          const remote = AVAILABLE_REPOSITORIES.find((r) => r.fullName === name);
          if (remote) repos.push({ ...remote, id: uid("repo"), workspaceId });
        }
      }
      connected = repos.filter((r) => r.workspaceId === workspaceId && fullNames.includes(r.fullName));
      const ids = connected.map((r) => r.id);
      const active = s.activeRepoId[workspaceId];
      return {
        ...s,
        repositories: repos,
        activeRepoId: { ...s.activeRepoId, [workspaceId]: active && ids.includes(active) ? active : ids[0] ?? null },
        integrations: {
          ...s.integrations,
          [workspaceId]: { ...s.integrations[workspaceId], connectedRepoIds: ids, lastSyncedAt: new Date().toISOString() },
        },
      };
    });
    return connected;
  },

  async sync(workspaceId) {
    db.update((s) => ({
      ...s,
      integrations: { ...s.integrations, [workspaceId]: { ...s.integrations[workspaceId], status: "syncing" } },
    }));
    await latency(3);
    const s = db.get();
    if (s.demo.failNextSync) {
      const message = "GitHub returned 502 Bad Gateway (simulated). Your data is unchanged.";
      db.update((st) => ({
        ...st,
        demo: { ...st.demo, failNextSync: false },
        integrations: { ...st.integrations, [workspaceId]: { ...st.integrations[workspaceId], status: "error", lastError: message } },
      }));
      throw new Error(message);
    }
    const cursor = s.syncCursor[workspaceId] ?? 0;
    const batches = workspaceId === "ws_orbit" ? pendingSyncActivity(Date.now()) : [];
    const batch = batches[cursor] ?? [];
    const syncedAt = new Date().toISOString();
    db.update((st) => ({
      ...st,
      activity: [...st.activity, ...batch.filter((b) => !st.activity.some((a) => a.id === b.id))],
      syncCursor: { ...st.syncCursor, [workspaceId]: cursor + 1 },
      integrations: { ...st.integrations, [workspaceId]: { ...st.integrations[workspaceId], status: "connected", lastSyncedAt: syncedAt, lastError: null } },
    }));
    return { newItems: batch.length, syncedAt };
  },

  setActiveRepository(workspaceId, repoId) {
    db.update((s) => ({ ...s, activeRepoId: { ...s.activeRepoId, [workspaceId]: repoId } }));
  },
};

export const activityService: ActivityService = {
  async load() {
    await latency();
    if (db.get().demo.activityError) {
      throw new Error("Couldn't reach GitHub (simulated). Check the integration and try again.");
    }
  },
  suggestGroups,
};

function touch(r: Release): Release {
  return { ...r, updatedAt: new Date().toISOString() };
}

function patchRelease(id: string, fn: (r: Release) => Release): Release {
  let out: Release | undefined;
  db.update((s) => ({
    ...s,
    releases: s.releases.map((r) => (r.id === id ? (out = fn(r)) : r)),
  }));
  if (!out) throw new Error("Release not found.");
  return out;
}

export const releaseService: ReleaseService = {
  create(workspaceId, draft) {
    const now = new Date().toISOString();
    const taken = db.get().releases.filter((r) => r.workspaceId === workspaceId).map((r) => r.slug);
    const release: Release = {
      ...draft,
      id: uid("rel"),
      workspaceId,
      slug: uniqueSlug(draft.title, taken),
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    db.update((s) => ({ ...s, releases: [release, ...s.releases] }));
    return release;
  },

  update(id, patch) {
    return patchRelease(id, (r) => {
      const next = touch({ ...r, ...patch });
      // Drafts follow their title; published URLs stay stable once shared.
      if (patch.title !== undefined && r.status !== "published") {
        const taken = db.get().releases.filter((x) => x.workspaceId === r.workspaceId && x.id !== id).map((x) => x.slug);
        next.slug = uniqueSlug(patch.title, taken);
      }
      return next;
    });
  },

  remove(id) {
    db.update((s) => ({ ...s, releases: s.releases.filter((r) => r.id !== id) }));
  },

  duplicate(id) {
    const src = db.get().releases.find((r) => r.id === id);
    if (!src) throw new Error("Release not found.");
    return releaseService.create(src.workspaceId, {
      title: `${src.title} (copy)`,
      summary: src.summary,
      category: src.category,
      blocks: src.blocks.map((b) => ({ ...b, id: uid("blk") })),
      activityIds: [...src.activityIds],
      cover: src.cover,
      releaseDate: toDay(new Date()),
      version: src.version,
    });
  },
};

export const publishingService: PublishingService = {
  async publish(id) {
    await latency(1.6);
    const r = db.get().releases.find((x) => x.id === id);
    if (!r) throw new Error("Release not found.");
    if (!r.title.trim()) throw new Error("Add a title before publishing.");
    const now = new Date();
    return patchRelease(id, (x) => ({
      ...x,
      status: "published",
      publishedAt: now.toISOString(),
      scheduledFor: undefined,
      updatedAt: now.toISOString(),
    }));
  },

  async schedule(id, at) {
    await latency();
    if (new Date(at).getTime() <= Date.now()) throw new Error("Choose a time in the future.");
    return patchRelease(id, (x) => ({ ...x, status: "scheduled", scheduledFor: at, releaseDate: toDay(new Date(at)), updatedAt: new Date().toISOString() }));
  },

  async unpublish(id) {
    await latency(0.6);
    return patchRelease(id, (x) => ({ ...x, status: "draft", publishedAt: undefined, scheduledFor: undefined, updatedAt: new Date().toISOString() }));
  },

  publicUrl(workspaceSlug, release) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/changelog/${workspaceSlug}${release ? `/${release.slug}` : ""}`;
  },
};

export const appearanceService: AppearanceService = {
  update(workspaceId, patch) {
    db.update((s) => ({ ...s, appearance: { ...s.appearance, [workspaceId]: { ...s.appearance[workspaceId], ...patch } } }));
  },
  reset(workspaceId) {
    db.update((s) => ({ ...s, appearance: { ...s.appearance, [workspaceId]: structuredClone(DEFAULT_APPEARANCE[workspaceId] ?? DEFAULT_APPEARANCE.ws_orbit) } }));
  },
};
