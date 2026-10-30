"use client";

import { RadioGroup } from "radix-ui";
import { cn } from "@/lib/cn";
import type { ThemePreference } from "@/lib/theme";
import { setThemePreference, useThemePreference } from "@/components/theme/use-theme";

const OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: "dark", label: "Dark", hint: "Default" },
  { value: "light", label: "Light", hint: "Bright interface" },
  { value: "system", label: "System", hint: "Match your device" },
];

/** Miniature of the app chrome in a given palette. */
function Preview({ tone }: { tone: ThemePreference }) {
  const dark = { bg: "#0e0e10", panel: "#151517", line: "#26262a", text: "#ededec", muted: "#3a3a3f" };
  const light = { bg: "#f7f7f5", panel: "#ffffff", line: "#e7e6e2", text: "#19191b", muted: "#d6d5d0" };
  const half = (c: typeof dark) => (
    <span className="flex size-full gap-1.5 p-2" style={{ background: c.bg }}>
      <span className="flex w-1/4 flex-col gap-1 pt-1">
        <span className="h-1 w-3/4 rounded-full" style={{ background: c.text }} />
        <span className="h-1 w-1/2 rounded-full" style={{ background: c.muted }} />
        <span className="h-1 w-2/3 rounded-full" style={{ background: c.muted }} />
      </span>
      <span className="flex-1 rounded-[4px] border p-1.5" style={{ background: c.panel, borderColor: c.line }}>
        <span className="block h-1.5 w-1/3 rounded-full" style={{ background: c.text }} />
        <span className="mt-2 flex gap-1">
          <span className="size-5 rounded-[3px] bg-[#141416]" />
          <span className="size-5 rounded-[3px]" style={{ background: c.muted }} />
        </span>
      </span>
    </span>
  );
  if (tone === "system")
    return (
      <span className="flex size-full">
        <span className="w-1/2 overflow-hidden">{half(light)}</span>
        <span className="w-1/2 overflow-hidden">{half(dark)}</span>
      </span>
    );
  return half(tone === "dark" ? dark : light);
}

export function ThemePicker() {
  const pref = useThemePreference();
  return (
    <RadioGroup.Root
      aria-label="Theme"
      value={pref}
      onValueChange={(v) => setThemePreference(v as ThemePreference)}
      className="grid grid-cols-3 gap-3 sm:max-w-[520px]"
    >
      {OPTIONS.map((o) => (
        <RadioGroup.Item
          key={o.value}
          value={o.value}
          className="group flex flex-col gap-2 rounded-lg text-left outline-offset-4"
        >
          <span
            className={cn(
              "ring-line block aspect-[4/3] w-full overflow-hidden rounded-lg ring-1 transition-shadow duration-[120ms]",
              "group-hover:ring-line-strong group-data-[state=checked]:ring-accent group-data-[state=checked]:ring-2",
            )}
          >
            <Preview tone={o.value} />
          </span>
          <span>
            <span className="text-fg block text-sm font-medium">{o.label}</span>
            <span className="text-muted block text-xs">{o.hint}</span>
          </span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
