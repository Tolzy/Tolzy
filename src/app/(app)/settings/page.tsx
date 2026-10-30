import type { Metadata } from "next";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice, SettingsGroup, SettingsRow } from "@/components/shell/settings-rows";

export const metadata: Metadata = { title: "Account" };

export default function AccountSettingsPage() {
  return (
    <>
      <Notice icon={<Info />}>
        You are not signed in. Account settings become available once accounts are enabled.
      </Notice>

      <SettingsGroup title="Profile">
        <SettingsRow label="Display name" description="Shown on portraits you publish.">
          <span className="text-muted text-sm">Not set</span>
        </SettingsRow>
        <SettingsRow label="Email" description="Used to sign in. Never shown publicly.">
          <span className="text-muted text-sm">Not set</span>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Danger zone">
        <SettingsRow
          label="Delete account"
          description="Permanently deletes your account, photographs, 3D models, exports and published embeds."
        >
          <Button variant="secondary" aria-disabled="true" className="text-danger">
            Delete account
          </Button>
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}
