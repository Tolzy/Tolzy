"use client";

import { Dialog as D } from "radix-ui";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { Kbd } from "@/components/ui/kbd";

export const useSearch = create<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

/**
 * Global search (⌘K). Searches the signed-in user's portraits and projects;
 * results are wired up with the dashboard data in Milestone 7.
 */
export function SearchDialog() {
  const { open, setOpen } = useSearch();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        useSearch.getState().setOpen(!useSearch.getState().open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <D.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <D.Portal>
        <D.Overlay className="bg-overlay fixed inset-0 z-40" />
        <D.Content className="border-line bg-surface shadow-dialog fixed top-[18vh] left-1/2 z-50 w-[calc(100vw-32px)] max-w-[560px] -translate-x-1/2 overflow-hidden rounded-xl border outline-none">
          <D.Title className="sr-only">Search</D.Title>
          <D.Description className="sr-only">Search portraits and projects</D.Description>
          <div className="border-line flex h-12 items-center gap-3 border-b px-4">
            <Search className="text-subtle size-4" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search portraits and projects"
              aria-label="Search portraits and projects"
              className="text-fg placeholder:text-subtle h-full flex-1 bg-transparent text-base outline-none"
            />
            <Kbd keys={["Esc"]} />
          </div>
          <div className="px-4 py-10 text-center" role="status">
            <p className="text-fg text-sm">{query ? `No results for “${query}”` : "Nothing to search yet"}</p>
            <p className="text-muted mt-1 text-xs">Portraits and projects you create will appear here.</p>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
