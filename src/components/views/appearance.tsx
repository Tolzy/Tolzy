"use client";

import { ArrowUpRight, Check, ImagePlus, Monitor, Moon, RotateCcw, Smartphone, Sun, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Page, PageHeader } from "@/components/app/page";
import { ChangelogFrame, ChangelogProvider, ProductLogo } from "@/components/changelog/context";
import { ChangelogIndex } from "@/components/changelog/release-view";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Switch, Textarea } from "@/components/ui/form";
import { Segmented } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { appearanceService } from "@/lib/services/mock";
import { usePublicReleases, useWorkspace } from "@/lib/store";
import type { Appearance } from "@/lib/types";
import { cn } from "@/lib/utils";

const SWATCHES = ["#2856C5", "#267447", "#B42318", "#946200", "#6A4BC4", "#0F766E", "#C2410C", "#171717"];

function luminance(hex: string) {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m) return 0;
  const [r, g, b] = m.map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastWithWhite(hex: string) {
  return 1.05 / (luminance(hex) + 0.05);
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-6 first:border-t-0 first:pt-0">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.06em] text-fg-subtle">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function AppearanceView() {
  const { workspace, appearance } = useWorkspace();
  const { releases, activity, users } = usePublicReleases(workspace.slug);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [confirmReset, setConfirmReset] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const activityMap = useMemo(() => new Map(activity.map((a) => [a.id, a])), [activity]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const set = (patch: Partial<Appearance>) => {
    try {
      appearanceService.update(workspace.id, patch);
    } catch (e) {
      toast.error("Couldn't save", (e as Error).message);
    }
  };

  const contrast = contrastWithWhite(appearance.accent);
  const validHex = /^#[0-9a-fA-F]{6}$/.test(appearance.accent);

  return (
    <Page wide>
      <PageHeader
        title="Changelog appearance"
        description="Shape how your public changelog looks. Changes apply instantly and are saved in this browser."
        actions={
          <>
            <Button variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => setConfirmReset(true)}>
              Reset
            </Button>
            <Button icon={<ArrowUpRight className="size-3.5" />} onClick={() => window.open(`/changelog/${workspace.slug}`, "_blank")}>
              Open changelog
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div>
          <Group title="Identity">
            <div className="flex items-center gap-3">
              <ProductLogo appearance={appearance} size={44} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon={<ImagePlus className="size-3.5" />} onClick={() => fileRef.current?.click()}>
                  {appearance.logo ? "Replace logo" : "Upload logo"}
                </Button>
                {appearance.logo && (
                  <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => set({ logo: null })}>
                    Remove
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  setLogoError(null);
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  if (f.size > 300 * 1024) return setLogoError("Logos must be under 300 KB.");
                  const reader = new FileReader();
                  reader.onload = () => set({ logo: String(reader.result) });
                  reader.readAsDataURL(f);
                }}
              />
            </div>
            {logoError ? <p role="alert" className="text-xs text-danger">{logoError}</p> : <p className="text-xs text-fg-faint">Without a logo, a monogram in your accent colour is used.</p>}
            <Field label="Product name" htmlFor="ap-name">
              <Input id="ap-name" value={appearance.productName} onChange={(e) => set({ productName: e.target.value })} maxLength={40} />
            </Field>
            <Field label="Short description" htmlFor="ap-desc" hint={`${appearance.description.length}/160`}>
              <Textarea id="ap-desc" value={appearance.description} onChange={(e) => set({ description: e.target.value.slice(0, 160) })} />
            </Field>
            <Field label="Website" htmlFor="ap-web" hint="Linked from the changelog header.">
              <Input id="ap-web" value={appearance.websiteUrl} onChange={(e) => set({ websiteUrl: e.target.value })} placeholder="https://" />
            </Field>
          </Group>

          <Group title="Colour & theme">
            <div>
              <p className="mb-2 text-xs font-medium text-fg-muted">Accent colour</p>
              <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Accent colour">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    role="radio"
                    aria-checked={appearance.accent.toLowerCase() === c.toLowerCase()}
                    aria-label={c}
                    onClick={() => set({ accent: c })}
                    className="relative flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-canvas transition-transform hover:scale-110 aria-checked:ring-2 aria-checked:ring-fg"
                    style={{ background: c }}
                  >
                    {appearance.accent.toLowerCase() === c.toLowerCase() && <Check className="size-3.5 text-white" strokeWidth={3} />}
                  </button>
                ))}
                <label className="relative flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface pl-1 pr-2.5 text-xs">
                  <input
                    type="color"
                    value={validHex ? appearance.accent : "#2856C5"}
                    onChange={(e) => set({ accent: e.target.value.toUpperCase() })}
                    className="size-5 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
                    aria-label="Custom accent colour"
                  />
                  <span className="font-mono text-fg-muted">{appearance.accent}</span>
                </label>
              </div>
              {contrast < 3 && (
                <p className="mt-2 text-xs text-warning">This colour has low contrast ({contrast.toFixed(1)}:1) with white text. Buttons may be hard to read.</p>
              )}
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-medium text-fg-muted">Public theme</span>
              <Segmented
                size="sm"
                label="Public theme"
                value={appearance.theme}
                onChange={(theme) => set({ theme })}
                options={[
                  { value: "light", label: "Light", icon: <Sun /> },
                  { value: "dark", label: "Dark", icon: <Moon /> },
                ]}
              />
            </div>
          </Group>

          <Group title="Layout">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-fg-muted">Style</p>
                <p className="text-2xs text-fg-faint">{appearance.layout === "timeline" ? "Dates in a column beside each entry." : "Single column, grouped by month."}</p>
              </div>
              <Segmented
                size="sm"
                label="Layout style"
                value={appearance.layout}
                onChange={(layout) => set({ layout })}
                options={[
                  { value: "timeline", label: "Timeline" },
                  { value: "journal", label: "Journal" },
                ]}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-fg-muted">Density</p>
                <p className="text-2xs text-fg-faint">{appearance.density === "compact" ? "Titles and summaries only." : "Covers and highlights in the list."}</p>
              </div>
              <Segmented
                size="sm"
                label="Display density"
                value={appearance.density}
                onChange={(density) => set({ density })}
                options={[
                  { value: "comfortable", label: "Comfortable" },
                  { value: "compact", label: "Compact" },
                ]}
              />
            </div>
            <Switch checked={appearance.showFeatured} onChange={(showFeatured) => set({ showFeatured })} label="Feature the latest release" description="Give the newest update a larger editorial treatment." />
          </Group>
        </div>

        {/* Live preview */}
        <div className="min-w-0 xl:sticky xl:top-8 xl:self-start">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-xs text-fg-subtle">
              <span className="size-1.5 rounded-full bg-success" aria-hidden /> Live preview
            </p>
            <Segmented
              size="sm"
              label="Preview device"
              value={device}
              onChange={setDevice}
              options={[
                { value: "desktop", label: "Desktop", icon: <Monitor /> },
                { value: "mobile", label: "Mobile", icon: <Smartphone /> },
              ]}
            />
          </div>
          <div
            className={cn(
              "mx-auto overflow-hidden border bg-surface shadow-pop transition-[max-width] duration-300",
              device === "mobile" ? "max-w-[390px] rounded-[28px] border-[6px] border-invert" : "max-w-none rounded-xl border-line",
            )}
          >
            <div className="scrollbar-thin h-[min(78vh,820px)] overflow-y-auto">
              <ChangelogProvider value={{ appearance, activity: activityMap, users: userMap, basePath: `/changelog/${workspace.slug}`, preview: true }}>
                <ChangelogFrame appearance={appearance}>
                  <ChangelogIndex releases={releases} />
                </ChangelogFrame>
              </ChangelogProvider>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset appearance?"
        description="Restore the default name, colours and layout for this workspace's changelog."
        confirmLabel="Reset"
        onConfirm={() => {
          appearanceService.reset(workspace.id);
          setConfirmReset(false);
          toast.success("Appearance reset");
        }}
      />
    </Page>
  );
}
