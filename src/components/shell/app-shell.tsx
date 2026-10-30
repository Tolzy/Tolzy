"use client";

import { Dialog as D } from "radix-ui";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Brand } from "./brand";
import { SearchDialog } from "./search-dialog";
import { SidebarContent } from "./sidebar";

/** Authenticated application frame: sidebar + inset content sheet. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-bg flex h-dvh">
      <aside className="hidden w-[240px] shrink-0 md:block">
        <SidebarContent />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col md:py-2 md:pr-2">
        <MobileBar />
        <main
          id="main"
          className="bg-surface md:border-line md:shadow-soft min-h-0 flex-1 overflow-y-auto md:rounded-xl md:border"
        >
          {children}
        </main>
      </div>

      <SearchDialog />
    </div>
  );
}

function MobileBar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Close the drawer after navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="border-line bg-bg flex h-12 shrink-0 items-center justify-between border-b px-3 md:hidden">
      <Brand />
      <D.Root open={open} onOpenChange={setOpen}>
        <D.Trigger asChild>
          <Button variant="ghost" iconOnly aria-label="Open navigation">
            <Menu />
          </Button>
        </D.Trigger>
        <D.Portal>
          <D.Overlay className="bg-overlay fixed inset-0 z-40" />
          <D.Content className="bg-bg shadow-dialog fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] outline-none">
            <D.Title className="sr-only">Navigation</D.Title>
            <D.Description className="sr-only">Main navigation</D.Description>
            <D.Close asChild>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label="Close navigation"
                className="absolute top-2.5 right-2.5"
              >
                <X />
              </Button>
            </D.Close>
            <SidebarContent />
          </D.Content>
        </D.Portal>
      </D.Root>
    </div>
  );
}
