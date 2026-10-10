"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAppTheme, useHydrated, useWorkspace } from "@/lib/store";
import { IllustrationTheme } from "../release/illustration";
import { useFocusTrap } from "../ui/dialog";
import { Skeleton, ShiplogMark } from "../ui/misc";
import { CommandPalette } from "./command-palette";
import { NavGuardProvider, useNavGuard } from "./nav-guard";
import { NAV, Sidebar } from "./sidebar";

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
}

function useGlobalShortcuts(openCommand: () => void) {
  const { navigate } = useNavGuard();
  const [theme, setTheme] = useAppTheme();
  const pending = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openCommand();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setTheme(theme === "dark" ? "light" : "dark");
        return;
      }
      if (mod || e.altKey || isTyping(e) || document.querySelector('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if (pending.current && Date.now() - pending.current < 900) {
        pending.current = null;
        const target = NAV.find((n) => n.shortcut.endsWith(` ${k.toUpperCase()}`));
        if (target) {
          e.preventDefault();
          navigate(target.href);
        }
        return;
      }
      if (k === "g") pending.current = Date.now();
      else if (k === "c") {
        e.preventDefault();
        navigate("/app/releases/new");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, openCommand, setTheme, theme]);
}

function ThemeSync() {
  const [theme] = useAppTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return null;
}

function MobileDrawer({ open, onClose, onOpenCommand }: { open: boolean; onClose: () => void; onOpenCommand: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <motion.div className="absolute inset-0 bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
            className="absolute inset-y-0 left-0 w-[280px] border-r border-line bg-canvas"
          >
            <button onClick={onClose} aria-label="Close navigation" className="absolute right-3 top-3.5 z-10 rounded-md p-1.5 text-fg-subtle hover:bg-surface-2">
              <X className="size-4" />
            </button>
            <Sidebar onNavigate={onClose} onOpenCommand={() => { onClose(); onOpenCommand(); }} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const { workspace } = useWorkspace();
  useGlobalShortcuts(() => setCmdOpen((o) => !o));

  return (
    <div className="min-h-dvh lg:pl-[248px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-line bg-canvas lg:block">
        <Sidebar onOpenCommand={() => setCmdOpen(true)} />
      </aside>

      <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur lg:hidden">
        <button onClick={() => setDrawer(true)} aria-label="Open navigation" className="-ml-1.5 rounded-md p-1.5 text-fg-muted hover:bg-surface-2">
          <Menu className="size-4" />
        </button>
        <ShiplogMark className="size-5 text-fg" />
        <span className="truncate text-sm font-semibold">{workspace.name}</span>
      </header>
      <MobileDrawer open={drawer} onClose={() => setDrawer(false)} onOpenCommand={() => setCmdOpen(true)} />

      <main id="main" className="min-w-0 overflow-x-clip">
        <motion.div
          key={pathname.split("/").slice(0, 3).join("/") + workspace.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
        >
          {children}
        </motion.div>
      </main>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="min-h-dvh lg:pl-[248px]" aria-busy="true" aria-label="Loading workspace">
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] flex-col gap-3 border-r border-line p-4 lg:flex">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="mt-2 h-8 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-32" />
        ))}
      </aside>
      <div className="mx-auto max-w-[1180px] px-6 py-10 lg:px-10">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-3 h-8 w-80" />
        <Skeleton className="mt-10 h-48 w-full" />
      </div>
    </div>
  );
}

function ThemedShell({ children }: { children: React.ReactNode }) {
  const [theme] = useAppTheme();
  return (
    <IllustrationTheme.Provider value={theme}>
      <ShellInner>{children}</ShellInner>
    </IllustrationTheme.Provider>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  return (
    <NavGuardProvider>
      <a href="#main" className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-3 focus-visible:top-3 focus-visible:z-[100] focus-visible:rounded-md focus-visible:bg-surface focus-visible:px-3 focus-visible:py-2 focus-visible:text-sm focus-visible:shadow-pop">
        Skip to content
      </a>
      {hydrated ? (
        <>
          <ThemeSync />
          <ThemedShell>{children}</ThemedShell>
        </>
      ) : (
        <ShellSkeleton />
      )}
    </NavGuardProvider>
  );
}
