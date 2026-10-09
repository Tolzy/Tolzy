"use client";

import { useCallback, useEffect, useState } from "react";
import { publishingService, repositoryService } from "@/lib/services/mock";
import { useWorkspace } from "@/lib/store";
import { pluralize } from "@/lib/utils";
import { useToast } from "../ui/toast";

export function useSync() {
  const { workspace, integration } = useWorkspace();
  const toast = useToast();
  const syncing = integration.status === "syncing";
  const sync = useCallback(async () => {
    try {
      const res = await repositoryService.sync(workspace.id);
      toast.success(
        "Sync complete (simulated)",
        res.newItems ? `${pluralize(res.newItems, "new item")} found in demo data.` : "No new activity — you're up to date.",
      );
    } catch (e) {
      toast.error("Sync failed", (e as Error).message);
    }
  }, [workspace.id, toast]);
  return { sync, syncing, disabled: integration.status === "disconnected" };
}

/** Re-render every `ms` so relative timestamps stay fresh. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function useCopy() {
  const toast = useToast();
  return useCallback(
    (text: string, title = "Link copied") => {
      if (!navigator.clipboard) {
        toast.error("Clipboard unavailable", text);
        return;
      }
      navigator.clipboard.writeText(text).then(
        () => toast.success(title, text),
        () => toast.error("Couldn't copy", "Your browser blocked clipboard access."),
      );
    },
    [toast],
  );
}

export function usePublicUrl() {
  const { workspace } = useWorkspace();
  return useCallback((slug?: string) => publishingService.publicUrl(workspace.slug, slug ? { slug } : undefined), [workspace.slug]);
}
