"use client";

import { RadioGroup } from "radix-ui";
import { Download, Info, Share2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { BACKGROUND_SWATCHES, LIGHTING_PRESETS, MATERIAL_PRESETS } from "@/lib/studio/presets";
import { DEFAULT_SETTINGS, MATERIAL_DEFAULTS, type Background } from "@/lib/studio/settings";
import { useStudioStore } from "@/stores/studio-store";
import { Button } from "@/components/ui/button";
import { ColorField, Field, Segmented, SliderField, SwitchRow } from "@/components/ui/controls";
import { DisclosureSection, PresetGroup, PresetTile, Section } from "@/components/ui/display";
import { usePrefersReducedMotion, useSection } from "./use-studio";
import { ShareDialog } from "./share-dialog";

function Sphere({ background, className }: { background: string; className?: string }) {
  return (
    <span
      className={cn("block size-[62%] rounded-full shadow-[0_6px_14px_-4px_rgb(0_0_0/0.6)]", className)}
      style={{ background }}
    />
  );
}

function PanelNote({ children }: { children: ReactNode }) {
  return <p className="text-2xs text-muted leading-4">{children}</p>;
}

/* ───────────────────────── Material ───────────────────────── */

/** Quiet banner for settings that the renderer does not apply yet. */
function PreviewNote({ children }: { children: ReactNode }) {
  return (
    <div className="border-line bg-sunken/60 text-2xs text-muted flex gap-2 border-b px-4 py-3 leading-4">
      <Info className="mt-px size-3 shrink-0" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

export function MaterialPanel() {
  const { value, set, drag, commit } = useSection("material");
  const active = MATERIAL_PRESETS.find((p) => p.id === value.preset)!;

  return (
    <>
      <PreviewNote>
        Material presets aren’t applied to the model yet. The viewport shows the original textures.
      </PreviewNote>
      <Section title="Preset">
        <PresetGroup
          label="Material preset"
          value={value.preset}
          onChange={(preset) => set({ preset, ...MATERIAL_DEFAULTS[preset] })}
        >
          {MATERIAL_PRESETS.map((p) => (
            <PresetTile key={p.id} value={p.id} label={p.label} preview={<Sphere background={p.swatch} />} />
          ))}
        </PresetGroup>
        <p className="text-muted pt-2 text-xs" aria-live="polite">
          {active.description}
        </p>
      </Section>

      <DisclosureSection title="Adjust">
        {value.preset === "original" ? (
          <PanelNote>
            Original keeps the reconstructed skin and hair textures. Choose another material to adjust its surface.
          </PanelNote>
        ) : (
          <>
            <SliderField
              label="Roughness"
              value={value.roughness}
              min={0}
              max={1}
              step={0.01}
              format={(v) => v.toFixed(2)}
              onChange={(roughness) => drag({ roughness })}
              onCommit={commit}
            />
            <ColorField label="Tint" value={value.tint} onChange={(tint) => set({ tint })} />
            <div className="flex justify-end pt-1">
              <Button variant="ghost" size="sm" onClick={() => set(MATERIAL_DEFAULTS[value.preset])}>
                Reset to preset
              </Button>
            </div>
          </>
        )}
      </DisclosureSection>
    </>
  );
}

/* ───────────────────────── Light ───────────────────────── */

export function LightPanel() {
  const { value, set, drag, commit } = useSection("lighting");
  const active = LIGHTING_PRESETS.find((p) => p.id === value.preset)!;

  return (
    <>
      <PreviewNote>
        Lighting presets aren’t applied yet. Shadow, intensity and rotation update the viewport.
      </PreviewNote>
      <Section title="Preset">
        <PresetGroup label="Lighting preset" value={value.preset} onChange={(preset) => set({ preset })}>
          {LIGHTING_PRESETS.map((p) => (
            <PresetTile key={p.id} value={p.id} label={p.label} preview={<Sphere background={p.swatch} />} />
          ))}
        </PresetGroup>
        <p className="text-muted pt-2 text-xs" aria-live="polite">
          {active.description}
        </p>
      </Section>

      <Section title="Shadows">
        <SwitchRow
          label="Contact shadow"
          description="Grounds the bust in the scene."
          checked={value.shadows}
          onChange={(shadows) => set({ shadows })}
        />
      </Section>

      <DisclosureSection title="Adjust">
        <SliderField
          label="Intensity"
          value={value.intensity}
          min={0}
          max={3}
          step={0.05}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(intensity) => drag({ intensity })}
          onCommit={commit}
        />
        <SliderField
          label="Rotation"
          value={value.rotation}
          min={-180}
          max={180}
          format={(v) => `${v}°`}
          onChange={(rotation) => drag({ rotation })}
          onCommit={commit}
        />
      </DisclosureSection>
    </>
  );
}

/* ───────────────────────── Scene ───────────────────────── */

function ColorSwatches({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <RadioGroup.Root
      aria-label="Background colour"
      value={value}
      onValueChange={onChange}
      className="flex flex-wrap gap-2 py-1"
    >
      {BACKGROUND_SWATCHES.map((s) => (
        <RadioGroup.Item
          key={s.color}
          value={s.color}
          aria-label={s.label}
          title={s.label}
          className={cn(
            "size-6 rounded-full ring-1 ring-black/10 transition-shadow duration-[120ms] ring-inset",
            "data-[state=checked]:shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--accent)]",
          )}
          style={{ background: s.color }}
        />
      ))}
    </RadioGroup.Root>
  );
}

export function ScenePanel() {
  const background = useStudioStore((s) => s.settings.background);
  const apply = useStudioStore((s) => s.apply);
  const setBg = (bg: Background) => apply((s) => ({ ...s, background: bg }));

  const changeType = (type: Background["type"]) => {
    if (type === background.type) return;
    if (type === "solid") setBg({ type, color: "#161618" });
    else if (type === "gradient") setBg(DEFAULT_SETTINGS.background);
    else setBg({ type: "transparent" });
  };

  return (
    <Section title="Background">
      <Segmented
        ariaLabel="Background type"
        value={background.type}
        onChange={changeType}
        options={[
          { value: "gradient", label: "Gradient" },
          { value: "solid", label: "Solid" },
          { value: "transparent", label: "None" },
        ]}
      />
      <div className="pt-2">
        {background.type === "solid" && (
          <>
            <ColorSwatches value={background.color} onChange={(color) => setBg({ type: "solid", color })} />
            <ColorField label="Colour" value={background.color} onChange={(color) => setBg({ type: "solid", color })} />
          </>
        )}
        {background.type === "gradient" && (
          <>
            <ColorField label="Centre" value={background.from} onChange={(from) => setBg({ ...background, from })} />
            <ColorField label="Edge" value={background.to} onChange={(to) => setBg({ ...background, to })} />
          </>
        )}
        {background.type === "transparent" && (
          <PanelNote>
            The checkerboard marks transparency. PNG exports and embeds will show whatever is behind them.
          </PanelNote>
        )}
      </div>
    </Section>
  );
}

/* ───────────────────────── Motion ───────────────────────── */

export function MotionPanel() {
  const { value, set, drag, commit } = useSection("motion");
  const reducedMotion = usePrefersReducedMotion();

  return (
    <>
      <PreviewNote>Cursor tracking and drag-to-rotate aren’t active yet. These settings will drive them.</PreviewNote>
      <Section title="Cursor tracking">
        <SwitchRow
          label="Follow cursor"
          description="The head turns toward the pointer."
          checked={value.tracking}
          onChange={(tracking) => set({ tracking })}
        />
        <div className="space-y-1.5 pt-1">
          <SliderField
            label="Horizontal"
            value={value.yawLimit}
            min={0}
            max={60}
            format={(v) => `±${v}°`}
            onChange={(yawLimit) => drag({ yawLimit })}
            onCommit={commit}
            disabled={!value.tracking}
          />
          <SliderField
            label="Vertical"
            value={value.pitchLimit}
            min={0}
            max={30}
            format={(v) => `±${v}°`}
            onChange={(pitchLimit) => drag({ pitchLimit })}
            onCommit={commit}
            disabled={!value.tracking}
          />
          <SliderField
            label="Sensitivity"
            value={value.sensitivity}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(sensitivity) => drag({ sensitivity })}
            onCommit={commit}
            disabled={!value.tracking}
          />
        </div>
        {reducedMotion && (
          <p className="text-2xs text-muted flex gap-1.5 pt-1 leading-4">
            <Info className="mt-px size-3 shrink-0" aria-hidden="true" />
            Reduced motion is on for this device, so visitors with the same setting won’t see cursor tracking.
          </p>
        )}
      </Section>

      <Section title="Drag to rotate">
        <Field label="On release" labelId="drag-release-label">
          <Segmented
            ariaLabelledBy="drag-release-label"
            value={value.dragRelease}
            onChange={(dragRelease) => set({ dragRelease })}
            options={[
              { value: "return", label: "Return" },
              { value: "hold", label: "Hold" },
            ]}
          />
        </Field>
        <PanelNote>
          {value.dragRelease === "return"
            ? "The head eases back to face forward after you let go."
            : "The head stays where you leave it."}
        </PanelNote>
      </Section>

      <DisclosureSection title="Advanced">
        <SliderField
          label="Smoothing"
          value={value.damping}
          min={1}
          max={20}
          step={0.5}
          format={(v) => v.toFixed(1)}
          onChange={(damping) => drag({ damping })}
          onCommit={commit}
        />
        <SliderField
          label="Return after"
          value={value.idleReturnMs}
          min={0}
          max={3000}
          step={50}
          format={(v) => `${(v / 1000).toFixed(1)} s`}
          onChange={(idleReturnMs) => drag({ idleReturnMs })}
          onCommit={commit}
        />
        <div className="flex justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={() => set(DEFAULT_SETTINGS.motion)}>
            Reset to defaults
          </Button>
        </div>
      </DisclosureSection>
    </>
  );
}

/* ───────────────────────── Export ───────────────────────── */

function ExportRow({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="min-w-0">
        <p className="text-fg text-xs">{title}</p>
        <p className="text-2xs text-muted">{description}</p>
      </div>
      <Button size="sm" iconOnly aria-label={`Download ${title}`} aria-disabled="true">
        <Download />
      </Button>
    </div>
  );
}

export function ExportPanel() {
  const [scale, setScale] = useState<"1" | "2" | "4">("2");
  const transparent = useStudioStore((s) => s.settings.background.type === "transparent");

  return (
    <>
      <PreviewNote>GLB and PNG exports aren’t enabled in this preview yet.</PreviewNote>

      <Section title="3D model">
        <ExportRow title="GLB · Original" description="Reconstructed geometry and textures" />
        <ExportRow title="GLB · Styled" description="With the current material applied" />
      </Section>

      <Section title="Image">
        <Field label="Size" labelId="png-size-label">
          <Segmented
            ariaLabelledBy="png-size-label"
            value={scale}
            onChange={setScale}
            options={[
              { value: "1", label: "1×" },
              { value: "2", label: "2×" },
              { value: "4", label: "4×" },
            ]}
          />
        </Field>
        <Field label="Background">
          <span className="text-fg text-xs">{transparent ? "Transparent" : "From scene"}</span>
        </Field>
        <Button variant="secondary" className="mt-2 w-full" aria-disabled="true">
          Render PNG
        </Button>
      </Section>

      <Section title="Publish">
        <PanelNote>Share a link or embed an interactive version on your website.</PanelNote>
        <ShareDialog
          trigger={
            <Button variant="secondary" className="mt-2 w-full">
              <Share2 />
              Share and embed
            </Button>
          }
        />
      </Section>
    </>
  );
}
