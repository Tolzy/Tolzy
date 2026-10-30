import Link from "next/link";
import { AlertCircle, Ellipsis, Loader, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/display";

/**
 * Flat bust silhouette used where no render exists yet. It is an
 * illustration, not a 3D render, and is never shown as generated output.
 */
export function BustSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 200" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="bust-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3a40" />
          <stop offset="1" stopColor="#1d1d21" />
        </linearGradient>
      </defs>
      <path
        fill="url(#bust-fill)"
        d="M80 34c-19 0-33 15.5-33 36.5 0 13 4.6 24.4 11.4 31.6 2.3 2.4 3.6 5.6 3.6 8.9v9.2c0 3.3-2 6.3-5.1 7.6-17.4 7.2-35.6 13.6-41.2 26.1C13 160 12 176 12 200h136c0-24-1-40-3.7-46.1-5.6-12.5-23.8-18.9-41.2-26.1-3.1-1.3-5.1-4.3-5.1-7.6V111c0-3.3 1.3-6.5 3.6-8.9 6.8-7.2 11.4-18.6 11.4-31.6C113 49.5 99 34 80 34Z"
      />
    </svg>
  );
}

const tileBase = "group flex flex-col gap-2.5 rounded-xl outline-offset-4";
const thumbBase = "relative aspect-[4/5] w-full overflow-hidden rounded-xl";

export function NewPortraitTile() {
  return (
    <Link href="/create" className={tileBase}>
      <span
        className={cn(
          thumbBase,
          "border-line-strong bg-bg flex flex-col items-center justify-center gap-3 border border-dashed",
          "group-hover:border-muted group-hover:bg-sunken transition-colors duration-[120ms]",
        )}
      >
        <span className="bg-surface text-fg ring-line shadow-soft flex size-10 items-center justify-center rounded-full ring-1">
          <Plus className="size-5" />
        </span>
        <span className="text-fg text-sm font-medium">New portrait</span>
      </span>
      <TileCaption title="Start from a photo" meta="One front-facing photo" />
    </Link>
  );
}

export function SamplePortraitTile() {
  return (
    <Link href="/studio/sample" className={tileBase}>
      <span className={cn(thumbBase, "bg-[radial-gradient(110%_80%_at_50%_30%,#26262b_0%,#0d0d0f_100%)]")}>
        {/* Rendered from the studio by scripts/sample-head/thumbnail.mjs */}
        {/* eslint-disable-next-line @next/next/no-img-element -- static 14 KB WebP, sized by CSS */}
        <img
          src="/models/sample-head/thumbnail.webp"
          alt=""
          width={640}
          height={800}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover transition-transform duration-[240ms] ease-out group-hover:scale-[1.02]"
        />
        <Badge tone="viewport" className="absolute top-3 left-3">
          Sample
        </Badge>
      </span>
      <TileCaption title="Sample head" meta="Explore the studio" />
    </Link>
  );
}

function TileCaption({ title, meta }: { title: string; meta: ReactNode }) {
  return (
    <span className="px-0.5">
      <span className="text-fg block truncate text-sm font-medium">{title}</span>
      <span className="text-muted block truncate text-xs">{meta}</span>
    </span>
  );
}

export type PortraitStatus = "ready" | "generating" | "failed";

export interface PortraitCardData {
  id: string;
  name: string;
  status: PortraitStatus;
  meta: string;
  /** Rendered PNG thumbnail URL, when available. */
  thumbnailUrl?: string;
}

/** Card for a user's portrait in the dashboard grid. */
export function PortraitCard({ portrait, menu }: { portrait: PortraitCardData; menu?: ReactNode }) {
  return (
    <div className="group relative flex flex-col gap-2.5">
      <Link
        href={`/studio/${portrait.id}`}
        className={cn(
          thumbBase,
          "block bg-[radial-gradient(110%_80%_at_50%_30%,#26262b_0%,#0d0d0f_100%)] outline-offset-4",
        )}
        aria-label={`Open ${portrait.name}`}
      >
        {portrait.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URLs, sized by CSS
          <img src={portrait.thumbnailUrl} alt="" className="size-full object-cover" />
        ) : (
          <BustSilhouette className="absolute inset-x-[14%] bottom-0 w-[72%] opacity-60" />
        )}
        {portrait.status !== "ready" && (
          <span className="absolute inset-x-3 bottom-3 flex">
            {portrait.status === "generating" ? (
              <Badge tone="viewport">
                <Loader className="animate-spin" /> Generating
              </Badge>
            ) : (
              <Badge tone="viewport" className="text-[#f0675e]">
                <AlertCircle /> Failed
              </Badge>
            )}
          </span>
        )}
      </Link>
      <div className="flex items-start gap-2 px-0.5">
        <div className="min-w-0 flex-1">
          <p className="text-fg truncate text-sm font-medium">{portrait.name}</p>
          <p className="text-muted truncate text-xs">{portrait.meta}</p>
        </div>
        {menu}
      </div>
    </div>
  );
}

export function PortraitMenuButton(props: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label="Portrait actions"
      className="text-muted hover:bg-hover hover:text-fg -mr-1 flex size-6 items-center justify-center rounded-md opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
      {...props}
    >
      <Ellipsis className="size-4" />
    </button>
  );
}
