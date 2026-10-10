// A tiny observable store over StorageService. Services mutate it; React
// subscribes via useSyncExternalStore.

import { createSeedState, localStorageService, type DbState, type StorageService } from "./storage";

type Listener = () => void;

export interface Db {
  get(): DbState;
  subscribe(listener: Listener): () => void;
  update(fn: (draft: DbState) => DbState): void;
  reset(): void;
  hydrate(): void;
  /** Replace in-memory state without persisting (cross-tab sync). */
  replace(next: DbState): void;
  readonly hydrated: boolean;
}

export function createDb(storage: StorageService): Db {
  let state: DbState = createSeedState();
  let hydrated = false;
  const listeners = new Set<Listener>();
  const emit = () => listeners.forEach((l) => l());

  return {
    get: () => state,
    get hydrated() {
      return hydrated;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(fn) {
      const next = fn(state);
      if (next === state) return;
      // Persist first so a quota failure doesn't leave memory and disk diverged.
      storage.save(next);
      state = next;
      emit();
    },
    reset() {
      storage.clear();
      state = createSeedState();
      storage.save(state);
      emit();
    },
    replace(next) {
      state = next;
      emit();
    },
    hydrate() {
      if (hydrated) return;
      const loaded = storage.load();
      if (loaded) state = loaded;
      else {
        state = createSeedState();
        try {
          storage.save(state);
        } catch {
          /* storage unavailable — run in memory */
        }
      }
      hydrated = true;
      emit();
    },
  };
}

export const db = createDb(localStorageService);

// Keep tabs in sync: a change in one tab (e.g. publishing) shows up in a
// public changelog open in another.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "shiplog:v1" && e.newValue) {
      const loaded = localStorageService.load();
      if (loaded) db.replace(loaded);
    }
  });
}
