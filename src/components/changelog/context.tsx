"use client";

import Link from "next/link";
import { createContext, useContext } from "react";
import type { ActivityItem, Appearance, User } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ChangelogContextValue {
  appearance: Appearance;
  activity: Map<string, ActivityItem>;
  users: Map<string, User>;
  /** /changelog/[slug] */
  basePath: string;
  /** In preview mode, links are inert so the editor isn't navigated away. */
  preview?: boolean;
}

const Ctx = createContext<ChangelogContextValue | null>(null);

export function ChangelogProvider({ value, children }: { value: ChangelogContextValue; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChangelog() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useChangelog must be used inside ChangelogProvider");
  return c;
}

/** Internal changelog link that becomes inert in preview mode. */
export function CLink({ href, className, children, ...rest }: { href: string; className?: string; children: React.ReactNode } & Omit<React.ComponentProps<typeof Link>, "href">) {
  const { preview } = useChangelog();
  if (preview) {
    return (
      <span className={cn(className, "cursor-default")} title="Links are disabled in preview">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}

/** Root wrapper that applies public theme, accent, and density tokens. */
export function ChangelogFrame({ appearance, children, className }: { appearance: Appearance; children: React.ReactNode; className?: string }) {
  return (
    <div
      data-public-theme={appearance.theme}
      data-density={appearance.density}
      className={cn("changelog @container font-sans", className)}
      style={{ ["--cl-accent" as string]: appearance.accent }}
    >
      {children}
    </div>
  );
}

export function ProductLogo({ appearance, size = 28 }: { appearance: Appearance; size?: number }) {
  if (appearance.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={appearance.logo} alt={`${appearance.productName} logo`} width={size} height={size} className="shrink-0 rounded-md object-contain" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-[28%] font-semibold text-white"
      style={{ width: size, height: size, background: appearance.accent, fontSize: size * 0.46 }}
    >
      {appearance.productName.trim().charAt(0).toUpperCase() || "•"}
    </span>
  );
}
