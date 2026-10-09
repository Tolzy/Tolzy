// Service interfaces. UI code talks to these; the demo implementations in
// ./mock.ts can be replaced by real GitHub/API-backed implementations.

import type {
  ActivityItem,
  Appearance,
  ID,
  Release,
  ReleaseDraft,
  Repository,
  SuggestedGroup,
} from "../types";

export interface RemoteRepository {
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  private: boolean;
  description: string;
  language: string;
  connected: boolean;
}

export interface SyncResult {
  newItems: number;
  syncedAt: string;
}

export interface RepositoryService {
  /** Repositories visible to the connected GitHub account. */
  listAvailable(workspaceId: ID): Promise<RemoteRepository[]>;
  connectAccount(workspaceId: ID): Promise<void>;
  disconnectAccount(workspaceId: ID): Promise<void>;
  setConnectedRepositories(workspaceId: ID, fullNames: string[]): Promise<Repository[]>;
  sync(workspaceId: ID): Promise<SyncResult>;
  setActiveRepository(workspaceId: ID, repoId: ID | null): void;
}

export interface ActivityQuery {
  repoId: ID;
}

export interface ActivityService {
  /** Fetch activity for a repository (simulates network latency/errors). */
  load(query: ActivityQuery): Promise<void>;
  suggestGroups(items: ActivityItem[]): SuggestedGroup[];
}

export interface ReleaseService {
  create(workspaceId: ID, draft: ReleaseDraft): Release;
  update(id: ID, patch: Partial<ReleaseDraft>): Release;
  remove(id: ID): void;
  duplicate(id: ID): Release;
}

export interface PublishingService {
  publish(id: ID): Promise<Release>;
  schedule(id: ID, at: string): Promise<Release>;
  unpublish(id: ID): Promise<Release>;
  publicUrl(workspaceSlug: string, release?: Pick<Release, "slug">): string;
}

export interface AppearanceService {
  update(workspaceId: ID, patch: Partial<Appearance>): void;
  reset(workspaceId: ID): void;
}
