"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../ui/dialog";

/**
 * Unsaved-change protection. An editor registers itself as dirty; in-app
 * navigation through GuardedLink / useGuardedNavigate asks for confirmation,
 * and closing the tab triggers the browser's native prompt.
 */
interface GuardCtx {
  setDirty: (dirty: boolean) => void;
  navigate: (href: string) => void;
  request: (proceed: () => void) => void;
}

const Ctx = createContext<GuardCtx | null>(null);

export function NavGuardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dirty = useRef(false);
  const [pending, setPending] = useState<(() => void) | null>(null);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const request = useCallback((proceed: () => void) => {
    if (dirty.current) setPending(() => proceed);
    else proceed();
  }, []);

  const navigate = useCallback((href: string) => request(() => router.push(href)), [request, router]);

  const setDirty = useCallback((d: boolean) => {
    dirty.current = d;
  }, []);

  return (
    <Ctx.Provider value={{ setDirty, navigate, request }}>
      {children}
      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={() => {
          const go = pending;
          dirty.current = false;
          setPending(null);
          go?.();
        }}
        title="Discard unsaved changes?"
        description="You have edits that haven't been saved. Leaving now will discard them."
        confirmLabel="Discard and leave"
        tone="danger"
      />
    </Ctx.Provider>
  );
}

export function useNavGuard() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useNavGuard must be used inside NavGuardProvider");
  return c;
}

/** Register the current view's dirty state. */
export function useDirtyGuard(dirty: boolean) {
  const { setDirty } = useNavGuard();
  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
}

export function GuardedLink({ href, onClick, ...props }: React.ComponentProps<typeof Link> & { href: string }) {
  const { navigate } = useNavGuard();
  return (
    <Link
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(href);
      }}
      {...props}
    />
  );
}
