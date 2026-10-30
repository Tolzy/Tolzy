import type { Metadata } from "next";
import { Box, Download, Image as ImageIcon, Info } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Notice, SettingsGroup, SettingsRow } from "@/components/shell/settings-rows";
import { RetentionSetting } from "./retention-setting";

export const metadata: Metadata = { title: "Storage & privacy" };

function AssetRow({
  icon,
  label,
  count,
  size,
  policy,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  size: string;
  policy: string;
}) {
  return (
    <SettingsRow
      label={
        <span className="[&_svg]:text-subtle flex items-center gap-2.5 [&_svg]:size-4">
          {icon}
          {label}
        </span>
      }
      description={policy}
    >
      <span className="tabular text-muted text-right text-xs">
        {count === 1 ? "1 file" : `${count} files`} · {size}
      </span>
      <Button size="sm" aria-disabled="true">
        Manage
      </Button>
    </SettingsRow>
  );
}

export default function StoragePage() {
  return (
    <>
      <Notice icon={<Info />}>
        Sign in to see and manage the files stored in your account. These are the rules that will apply to them.
      </Notice>

      <SettingsGroup
        title="Stored assets"
        description="Everything is private by default. Each type can be deleted on its own."
      >
        <AssetRow
          icon={<ImageIcon />}
          label="Source photographs"
          count={0}
          size="0 MB"
          policy="Deleted 30 days after your portrait is generated, unless you keep them."
        />
        <AssetRow icon={<Box />} label="3D models" count={0} size="0 MB" policy="Kept until you delete them." />
        <AssetRow
          icon={<Download />}
          label="Exports"
          count={0}
          size="0 MB"
          policy="PNG renders and styled GLBs. Kept until you delete them."
        />
      </SettingsGroup>

      <SettingsGroup title="Photograph retention">
        <RetentionSetting />
        <SettingsRow
          label="Delete all photographs now"
          description="Removes every source photograph immediately. Your 3D models are not affected."
        >
          <Button variant="secondary" aria-disabled="true" className="text-danger">
            Delete photographs
          </Button>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="How your data is used">
        <SettingsRow
          label="External processing"
          description="Photographs are sent securely to a 3D reconstruction partner to build your model, then deleted from their systems where supported."
        />
        <SettingsRow
          label="Never used for training"
          description="Your photographs and portraits are never used to train AI models."
        />
        <SettingsRow
          label="Publishing is always your choice"
          description="Nothing is public until you publish it, and you can unpublish at any time."
        />
      </SettingsGroup>
    </>
  );
}
