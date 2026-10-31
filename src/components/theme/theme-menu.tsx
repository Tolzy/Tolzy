"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import type { ThemePreference } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@/components/ui/overlays";
import { Tooltip } from "@/components/ui/tooltip";
import { setThemePreference, useThemePreference } from "./use-theme";

const LABELS: Record<ThemePreference, string> = { dark: "Dark", light: "Light", system: "System" };

const ICONS: Record<ThemePreference, React.ReactNode> = {
  dark: <Moon />,
  light: <Sun />,
  system: <Monitor />,
};

/**
 * Compact theme switch (Dark / Light / System) for the app shell, the Studio
 * and focused flows. Same preference as Settings → Appearance.
 */
export function ThemeMenu({ side = "bottom" }: { side?: "bottom" | "right" }) {
  const pref = useThemePreference();
  return (
    <Menu>
      <Tooltip content="Theme" side={side}>
        <MenuTrigger asChild>
          <Button variant="ghost" iconOnly aria-label={`Theme: ${LABELS[pref]}`}>
            {ICONS[pref]}
          </Button>
        </MenuTrigger>
      </Tooltip>
      <MenuContent>
        <MenuRadioGroup label="Theme" value={pref} onChange={setThemePreference}>
          <MenuRadioItem value="dark" icon={<Moon />}>
            Dark
          </MenuRadioItem>
          <MenuRadioItem value="light" icon={<Sun />}>
            Light
          </MenuRadioItem>
          <MenuRadioItem value="system" icon={<Monitor />}>
            System
          </MenuRadioItem>
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
