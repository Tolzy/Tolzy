"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Folder, HardDrive, LayoutGrid, Plus, Search, Settings, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip } from "@/components/ui/tooltip";
import { Brand } from "./brand";
import { useSearch } from "./search-dialog";

function NavItem({
  href,
  icon,
  children,
  exact,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors duration-[120ms] [&_svg]:size-4",
        active ? "bg-active text-fg" : "text-muted hover:bg-hover hover:text-fg",
      )}
    >
      <span className={active ? "text-fg" : "text-subtle"}>{icon}</span>
      {children}
    </Link>
  );
}

export function SidebarContent() {
  const openSearch = useSearch((s) => s.setOpen);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center px-3">
        <Link href="/dashboard" className="rounded-md" aria-label="Portrait Studio home">
          <Brand />
        </Link>
      </div>

      <div className="px-2 pt-1">
        <button
          type="button"
          onClick={() => openSearch(true)}
          className="text-muted ring-line hover:bg-hover hover:text-fg flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-sm ring-1 ring-inset [&_svg]:size-4"
        >
          <Search className="text-subtle" />
          <span className="flex-1 text-left">Search</span>
          <Kbd keys={["⌘", "K"]} />
        </button>
      </div>

      <nav aria-label="Main" className="mt-4 space-y-px px-2">
        <NavItem href="/dashboard" icon={<LayoutGrid />} exact>
          Portraits
        </NavItem>
        <NavItem href="/projects" icon={<Folder />}>
          Projects
        </NavItem>
      </nav>

      <div className="mt-6 px-2">
        <div className="flex h-7 items-center justify-between pr-0.5 pl-2">
          <span className="text-2xs text-muted font-medium tracking-[0.04em] uppercase">Projects</span>
          <Tooltip content="Sign in to create projects" side="right">
            <Button variant="ghost" size="sm" iconOnly aria-label="New project" aria-disabled="true" className="size-6">
              <Plus />
            </Button>
          </Tooltip>
        </div>
        <p className="text-muted px-2 py-1 text-xs">No projects yet</p>
      </div>

      <div className="mt-auto space-y-px px-2 pb-2">
        <NavItem href="/settings/storage" icon={<HardDrive />}>
          Storage
        </NavItem>
        <NavItem href="/settings" icon={<Settings />} exact>
          Settings
        </NavItem>
      </div>

      <div className="border-line border-t px-3 py-3">
        <Tooltip
          side="right"
          content={
            <span className="block max-w-[220px] leading-4">
              Preview build. Accounts, photo upload and generation are not enabled yet.
            </span>
          }
        >
          <button type="button" className="flex w-full items-center gap-2.5 rounded-md text-left">
            <span className="bg-sunken text-subtle ring-line flex size-7 items-center justify-center rounded-full ring-1 [&_svg]:size-4">
              <UserRound />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-fg block truncate text-sm">Not signed in</span>
            </span>
            <Badge tone="outline">Preview</Badge>
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
