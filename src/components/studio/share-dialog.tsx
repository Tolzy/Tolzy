"use client";

import { RadioGroup } from "radix-ui";
import { Globe, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose } from "@/components/ui/overlays";

function VisibilityTile({
  value,
  icon,
  title,
  description,
  disabled,
}: {
  value: string;
  icon: ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <RadioGroup.Item
      value={value}
      disabled={disabled}
      className={cn(
        "group ring-line flex flex-col items-start gap-3 rounded-lg p-3.5 text-left ring-1 ring-inset",
        "hover:ring-line-strong disabled:hover:ring-line transition-shadow duration-[120ms] disabled:cursor-not-allowed disabled:opacity-55",
        "data-[state=checked]:ring-accent data-[state=checked]:ring-2",
      )}
    >
      <span className="bg-sunken text-muted ring-line group-data-[state=checked]:text-accent flex size-8 items-center justify-center rounded-md ring-1 [&_svg]:size-4">
        {icon}
      </span>
      <span>
        <span className="text-fg block text-sm font-medium">{title}</span>
        <span className="text-muted mt-0.5 block text-xs">{description}</span>
      </span>
    </RadioGroup.Item>
  );
}

/** Visibility and embed controls. Publishing requires a generated portrait. */
export function ShareDialog({ trigger }: { trigger: ReactNode }) {
  return (
    <Dialog
      trigger={trigger}
      title="Share portrait"
      description="Portraits are private until you publish them. You can unpublish at any time."
      footer={
        <DialogClose asChild>
          <Button variant="primary">Done</Button>
        </DialogClose>
      }
    >
      <RadioGroup.Root defaultValue="private" aria-label="Visibility" className="grid gap-3 sm:grid-cols-2">
        <VisibilityTile value="private" icon={<Lock />} title="Private" description="Only you can see this portrait." />
        <VisibilityTile
          value="public"
          icon={<Globe />}
          title="Public embed"
          description="Anyone with the link or embed can view and rotate it."
          disabled
        />
      </RadioGroup.Root>
      <p className="text-muted mt-4 text-xs">
        Public embeds are coming in Milestone 12, for generated portraits. Everything stays private until then.
      </p>
    </Dialog>
  );
}
