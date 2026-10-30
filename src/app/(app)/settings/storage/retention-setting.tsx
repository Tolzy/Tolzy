"use client";

import { Switch } from "@/components/ui/controls";
import { SettingsRow } from "@/components/shell/settings-rows";

export function RetentionSetting() {
  return (
    <SettingsRow
      label={<label htmlFor="keep-photos">Keep my photographs</label>}
      description="Keep source photographs after generation so you can regenerate later. Off by default."
    >
      <Switch id="keep-photos" checked={false} onChange={() => {}} disabled />
    </SettingsRow>
  );
}
