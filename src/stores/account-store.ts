import { create } from "zustand";

export interface AppStatus {
  backend: "local" | "none";
  provider: {
    id: string;
    name: string;
    processing: string;
    external: boolean;
    enabled: boolean;
    reason: string | null;
  } | null;
  consentVersion: string;
  user: { id: string; name: string; email: string } | null;
}

interface Account {
  status: AppStatus | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signIn: (email: string, name: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

/** What this build supports and who is signed in (from /api/status — never secrets). */
export const useAccount = create<Account>()((set, get) => ({
  status: null,
  loading: false,
  refresh: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      set({ status: (await res.json()) as AppStatus });
    } catch {
      set({ status: { backend: "none", provider: null, consentVersion: "", user: null } });
    } finally {
      set({ loading: false });
    }
  },
  signIn: async (email, name) => {
    const res = await fetch("/api/auth/local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    });
    if (!res.ok) return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Sign-in failed.";
    await get().refresh();
    return null;
  },
  signOut: async () => {
    await fetch("/api/auth/sign-out", { method: "POST" });
    await get().refresh();
  },
}));
