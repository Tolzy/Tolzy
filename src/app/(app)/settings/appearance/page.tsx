import type { Metadata } from "next";
import { SettingsGroup } from "@/components/shell/settings-rows";
import { ThemePicker } from "./theme-picker";

export const metadata: Metadata = { title: "Appearance" };

export default function AppearancePage() {
  return (
    <SettingsGroup
      title="Theme"
      description="Dark is the default. Your choice is saved on this device. The 3D viewport stays dark in every theme."
    >
      <div className="py-5">
        <ThemePicker />
      </div>
    </SettingsGroup>
  );
}
