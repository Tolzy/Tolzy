// StorageService — persistence boundary. The prototype persists to
// localStorage; a real deployment would swap this for an API client.

import type {
  ActivityItem,
  Appearance,
  ID,
  Integration,
  Release,
  Repository,
  User,
  Workspace,
} from "../types";
import {
  DEFAULT_APPEARANCE,
  REPOSITORIES,
  USERS,
  WORKSPACES,
  demoActivity,
  demoIntegrations,
  demoReleases,
} from "../demo-data";

export const SCHEMA_VERSION = 4;

export interface DbState {
  version: number;
  seededAt: number;
  activeWorkspaceId: ID;
  activeRepoId: Record<ID, ID | null>;
  appTheme: "light" | "dark";
  users: User[];
  workspaces: Workspace[];
  repositories: Repository[];
  activity: ActivityItem[];
  releases: Release[];
  integrations: Record<ID, Integration>;
  appearance: Record<ID, Appearance>;
  /** How many simulated sync batches have been consumed per workspace. */
  syncCursor: Record<ID, number>;
  demo: {
    /** Make the next sync fail so the error state can be explored. */
    failNextSync: boolean;
    /** Make the activity feed fail to load. */
    activityError: boolean;
    /** Extra simulated network latency in ms. */
    latency: number;
  };
}

export interface StorageService {
  load(): DbState | null;
  save(state: DbState): void;
  clear(): void;
}

const KEY = "shiplog:v1";

export const localStorageService: StorageService = {
  load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as DbState;
      if (parsed.version !== SCHEMA_VERSION) return null;
      return parsed;
    } catch {
      return null;
    }
  },
  save(state) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      // Quota exceeded (large uploads) — surface to the caller.
      throw new Error(
        err instanceof DOMException && err.name === "QuotaExceededError"
          ? "Browser storage is full. Try a smaller image or remove an upload."
          : "Couldn't save to browser storage.",
      );
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};

export function createSeedState(now = Date.now()): DbState {
  return {
    version: SCHEMA_VERSION,
    seededAt: now,
    activeWorkspaceId: "ws_orbit",
    activeRepoId: { ws_orbit: "repo_orbit", ws_sandbox: null },
    appTheme: "dark",
    users: USERS,
    workspaces: WORKSPACES,
    repositories: REPOSITORIES,
    activity: demoActivity(now),
    releases: demoReleases(now),
    integrations: demoIntegrations(now),
    appearance: structuredClone(DEFAULT_APPEARANCE),
    syncCursor: {},
    demo: { failNextSync: false, activityError: false, latency: 450 },
  };
}
