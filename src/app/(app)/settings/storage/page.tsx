import type { Metadata } from "next";
import { SettingsGroup, SettingsRow } from "@/components/shell/settings-rows";
import { StorageOverview } from "./storage-overview";

export const metadata: Metadata = { title: "Storage & privacy" };

export default function StoragePage() {
  return (
    <>
      <StorageOverview />

      <SettingsGroup title="How your data is used">
        <SettingsRow
          label="External processing"
          description="Photographs are sent securely to the 3D reconstruction provider named before you generate, then deleted from their systems where supported."
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
