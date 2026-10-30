import type { Metadata } from "next";
import Link from "next/link";
import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { CreatePortraitForm } from "./create-form";

export const metadata: Metadata = { title: "New portrait" };

export default function CreatePage() {
  return (
    <div className="bg-surface min-h-dvh">
      <header className="border-line bg-surface/95 sticky top-0 z-10 flex h-14 items-center gap-3 border-b px-3 sm:px-5">
        <Tooltip content="Close">
          <Button variant="ghost" iconOnly asChild>
            <Link href="/dashboard" aria-label="Close and return to portraits">
              <X />
            </Link>
          </Button>
        </Tooltip>
        <h1 className="text-sm font-medium">New portrait</h1>
        <ol
          aria-label="Steps"
          className="ml-auto flex items-center gap-3 text-xs sm:absolute sm:left-1/2 sm:ml-0 sm:-translate-x-1/2"
        >
          <li aria-current="step" className="text-fg flex items-center gap-2 font-medium">
            <span className="bg-fg text-2xs text-inverse flex size-5 items-center justify-center rounded-full">1</span>
            Photo
          </li>
          <li aria-hidden="true" className="bg-line-strong h-px w-6" />
          <li className="text-muted flex items-center gap-2">
            <span className="text-2xs ring-line-strong flex size-5 items-center justify-center rounded-full ring-1 ring-inset">
              2
            </span>
            Generate
          </li>
        </ol>
      </header>

      <div className="border-line bg-sunken/70 border-b">
        <p className="text-muted mx-auto flex max-w-[1080px] items-center gap-2 px-5 py-2.5 text-xs sm:px-8">
          <Info className="size-3.5 shrink-0" aria-hidden="true" />
          Preview build — photo upload and generation are not enabled yet. You’ll need to sign in to create portraits.
        </p>
      </div>

      <main className="mx-auto max-w-[1080px] px-5 pt-10 pb-20 sm:px-8 md:pt-14">
        <CreatePortraitForm />
      </main>
    </div>
  );
}
