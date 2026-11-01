"use client";

import { RadioGroup } from "radix-ui";
import { Download, Eye, EyeOff, Info, Share2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { BACKGROUND_PRESETS, BACKGROUND_SWATCHES, LIGHTING_PRESETS, MATERIAL_PRESETS } from "@/lib/studio/presets";
import { CONTROL_LABELS, controlRange, MATERIAL_PRESET_DEFS } from "@/lib/studio/materials";
import {
  backgroundIsTranslucent,
  backgroundToCss,
  DEFAULT_SETTINGS,
  lightingSettings,
  materialSettings,
  type Background,
} from "@/lib/studio/settings";
import { useStudioStore } from "@/stores/studio-store";
import { Button } from "@/components/ui/button";
import { Field, Segmented, SliderField, SwitchRow } from "@/components/ui/controls";
import { ColorField } from "@/components/ui/color/color-field";
import { Badge, DisclosureSection, PresetGroup, PresetTile, Section } from "@/components/ui/display";
import { usePrefersReducedMotion, useSection } from "./use-studio";
import { ShareDialog } from "./share-dialog";
import { useStudioModel } from "./studio-context";
import { useMaterialScope } from "./use-material-scope";
import { HIDEABLE, lineage, REGION_DEFS, REGION_ORDER, SHOW_PRESETS, type RegionId } from "@/lib/segmentation/regions";
import { Tooltip } from "@/components/ui/tooltip";

function PanelNote({ children }: { children: ReactNode }) {
  return <p className="text-2xs text-muted leading-4">{children}</p>;
}

/** Small label marking a section whose controls arrive in a later milestone. */
function ComingBadge({ milestone }: { milestone: number }) {
  return <Badge tone="outline">Milestone {milestone}</Badge>;
}

/** Quiet banner for settings that the renderer does not apply yet. */
function PreviewNote({ children }: { children: ReactNode }) {
  return (
    <div className="border-line bg-sunken/60 text-2xs text-muted flex gap-2 border-b px-4 py-3 leading-4">
      <Info className="mt-px size-3 shrink-0" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

/** A rendered preview filling a preset tile. */
function PreviewImage({ src, position = "center" }: { src: string; position?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small static renders, sized by the tile
    <img
      src={src}
      alt=""
      width={160}
      height={160}
      draggable={false}
      className="absolute inset-0 size-full object-cover"
      style={{ objectPosition: position }}
    />
  );
}

/* ───────────────────────── Material ───────────────────────── */

const percent = (v: number) => `${Math.round(v * 100)}%`;

export function MaterialPanel() {
  const scope = useMaterialScope();
  const { value, set, drag, commit } = scope;
  const { thumbnailUrl } = useStudioModel();
  const def = MATERIAL_PRESET_DEFS[value.preset];
  const atDefaults = def.controls.every((c) => value[c] === def.defaults[c]);

  return (
    <>
      <ScopeBar />
      <Section title="Preset">
        <PresetGroup label="Material preset" value={value.preset} onChange={(preset) => set(materialSettings(preset))}>
          {MATERIAL_PRESETS.map((p) => (
            <PresetTile
              key={p.id}
              value={p.id}
              label={p.label}
              preview={
                p.preview ? (
                  <PreviewImage src={p.preview} />
                ) : thumbnailUrl ? (
                  // Original: the model's own look, cropped to the face.
                  <span className="absolute inset-x-[-38%] top-[-4%] bottom-[-72%]">
                    <PreviewImage src={thumbnailUrl} position="50% 30%" />
                  </span>
                ) : null
              }
            />
          ))}
        </PresetGroup>
        <p className="text-muted pt-2 text-xs" aria-live="polite">
          {def.description}
        </p>
      </Section>

      <DisclosureSection title="Adjust">
        {def.controls.map((control) => {
          if (control === "tint") {
            return (
              <ColorField
                key={control}
                label={CONTROL_LABELS.tint}
                value={value.tint}
                onPreview={(tint) => drag({ tint })}
                onChange={(tint) => set({ tint })}
              />
            );
          }
          const [min, max] = controlRange(value.preset, control);
          return (
            <SliderField
              key={control}
              label={CONTROL_LABELS[control]}
              value={value[control]}
              min={min}
              max={max}
              step={0.01}
              format={control === "thickness" ? (v) => v.toFixed(2) : percent}
              onChange={(v) => drag({ [control]: v })}
              onCommit={commit}
            />
          );
        })}
        {value.preset === "original" && (
          <PanelNote>Original keeps the model’s own textures. Choose a material to change its surface.</PanelNote>
        )}
        {value.preset === "glass" && (
          <PanelNote>Glass is see-through by nature, so it has no opacity control.</PanelNote>
        )}
        <ResetRow disabled={atDefaults} onReset={() => set(materialSettings(value.preset))} />
      </DisclosureSection>
    </>
  );
}

function ResetRow({ disabled, onReset }: { disabled: boolean; onReset: () => void }) {
  return (
    <div className="flex justify-end pt-1">
      <Button variant="ghost" size="sm" disabled={disabled} onClick={onReset}>
        Reset to preset
      </Button>
    </div>
  );
}

/** Shows what the Material panel edits: the whole model or one selected part. */
function ScopeBar() {
  const scope = useMaterialScope();
  if (!scope.region)
    return (
      <div className="border-line text-2xs text-muted border-b px-4 py-2.5" data-testid="material-scope">
        Editing the whole model. Select a part in the viewport or the Model panel to style it on its own.
      </div>
    );
  return (
    <div className="border-line bg-accent-soft/50 border-b px-4 py-2.5" data-testid="material-scope">
      <div className="flex items-center gap-2">
        <span className="text-fg text-xs font-medium">Editing: {scope.regionName}</span>
        <span className="text-2xs text-muted">
          {scope.own
            ? "own material"
            : scope.inheritedFrom
              ? `follows ${REGION_DEFS[scope.inheritedFrom].name}`
              : "follows the whole model"}
        </span>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={scope.deselect}>
          Whole model
        </Button>
      </div>
      {scope.own && (
        <button
          type="button"
          onClick={scope.clearOverride}
          className="text-2xs text-muted hover:text-fg mt-1 underline underline-offset-2"
        >
          Use the {scope.inheritedFrom ? REGION_DEFS[scope.inheritedFrom].name.toLowerCase() : "whole-model"} material
          again
        </button>
      )}
    </div>
  );
}

/* ───────────────────────── Model (parts) ───────────────────────── */

export function ModelPanel() {
  const geometry = useStudioStore((s) => s.settings.geometry);
  const report = useStudioStore((s) => s.geometryReport);
  const selected = useStudioStore((s) => s.selectedRegion);
  const regionMaterials = useStudioStore((s) => s.settings.regionMaterials);
  const apply = useStudioStore((s) => s.apply);
  const selectRegion = useStudioStore((s) => s.selectRegion);
  const setContext = useStudioStore((s) => s.setContext);
  const setGeometry = (patch: Partial<typeof geometry>) =>
    apply((s) => ({ ...s, geometry: { ...s.geometry, ...patch } }));

  if (!report)
    return (
      <Section title="Parts">
        <PanelNote>Analysing the model…</PanelNote>
      </Section>
    );
  if (!report.segmented)
    return (
      <Section title="Parts">
        <PanelNote>
          This model couldn’t be split into parts: {report.reason} The whole model can still be styled.
        </PanelNote>
      </Section>
    );

  const available = (id: RegionId) => report.regions.find((r) => r.id === id)?.available ?? false;
  const hiddenNow = new Set(report.hidden);
  const toggleHidden = (id: RegionId) =>
    setGeometry({
      hidden: geometry.hidden.includes(id) ? geometry.hidden.filter((r) => r !== id) : [...geometry.hidden, id],
    });
  const depth = (id: RegionId) => lineage(id).length - 1;

  return (
    <>
      <Section title="Show">
        <Segmented
          ariaLabel="Show"
          value={geometry.preset}
          onChange={(preset) => setGeometry({ preset })}
          options={SHOW_PRESETS.map((p) => ({
            value: p.id,
            label: p.label,
            disabled: p.id === "bust" ? false : !available("neck") || (p.id === "head" && !available("head")),
          }))}
        />
        <PanelNote>
          {geometry.preset === "head"
            ? "Head only, cut cleanly under the jaw and closed."
            : geometry.preset === "headNeck"
              ? "Head and neck, closed above the shoulders."
              : "The full bust."}
        </PanelNote>
      </Section>

      <Section
        title="Parts"
        action={
          selected ? (
            <Button variant="ghost" size="sm" onClick={() => selectRegion(null)}>
              Deselect
            </Button>
          ) : null
        }
      >
        <ul aria-label="Model parts" className="-mx-2 space-y-0.5">
          {REGION_ORDER.map((id) => {
            const r = report.regions.find((x) => x.id === id)!;
            const hideable = HIDEABLE.includes(id) && r.available;
            const hidden = hiddenNow.has(id);
            const isSelected = selected === id;
            return (
              <li key={id} data-region={id} className="flex items-center gap-1" style={{ paddingLeft: depth(id) * 12 }}>
                <button
                  type="button"
                  disabled={!r.available || hidden}
                  aria-pressed={isSelected}
                  onClick={() => selectRegion(isSelected ? null : id)}
                  title={r.available ? undefined : r.reason}
                  className={cn(
                    "flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-xs",
                    "enabled:hover:bg-hover disabled:text-subtle aria-pressed:bg-accent-soft aria-pressed:text-fg",
                    r.available ? "text-fg" : "",
                  )}
                >
                  <span className="truncate">{REGION_DEFS[id].name}</span>
                  {regionMaterials[id] && (
                    <span className="bg-accent size-1.5 shrink-0 rounded-full" aria-label="has its own material" />
                  )}
                  {!r.available && <span className="text-2xs text-subtle ml-auto shrink-0">Not separable</span>}
                </button>
                {hideable && (
                  <Tooltip
                    content={
                      hidden
                        ? `Show ${REGION_DEFS[id].name.toLowerCase()}`
                        : `Hide ${REGION_DEFS[id].name.toLowerCase()}`
                    }
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      aria-label={`${hidden ? "Show" : "Hide"} ${REGION_DEFS[id].name.toLowerCase()}`}
                      aria-pressed={hidden}
                      onClick={() =>
                        id === "hair"
                          ? toggleHidden("hair")
                          : setGeometry({
                              preset: id === "neck" ? (hidden ? "headNeck" : "head") : hidden ? "bust" : "headNeck",
                            })
                      }
                    >
                      {hidden ? <EyeOff /> : <Eye />}
                    </Button>
                  </Tooltip>
                )}
              </li>
            );
          })}
        </ul>
        <PanelNote>
          Face, ears and shoulders are areas of one continuous surface: they can be styled on their own but not hidden,
          which would leave an opening.
        </PanelNote>
      </Section>

      {selected && (
        <Section title={REGION_DEFS[selected].name}>
          <PanelNote>Material changes now apply to this part only; everything else keeps its look.</PanelNote>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setContext("material")}>
              Edit material
            </Button>
          </div>
        </Section>
      )}
    </>
  );
}

/* ───────────────────────── Light ───────────────────────── */

export function LightPanel() {
  const { value, set, drag, commit } = useSection("lighting");
  const active = LIGHTING_PRESETS.find((p) => p.id === value.preset)!;
  const defaults = lightingSettings(value.preset);
  const atDefaults = (Object.keys(defaults) as (keyof typeof defaults)[]).every((k) => value[k] === defaults[k]);

  return (
    <>
      <Section title="Preset">
        <PresetGroup label="Lighting preset" value={value.preset} onChange={(preset) => set(lightingSettings(preset))}>
          {LIGHTING_PRESETS.map((p) => (
            <PresetTile key={p.id} value={p.id} label={p.label} preview={<PreviewImage src={p.preview!} />} />
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
        <SliderField
          label="Strength"
          value={value.shadowIntensity}
          min={0}
          max={1}
          step={0.01}
          format={percent}
          onChange={(shadowIntensity) => drag({ shadowIntensity })}
          onCommit={commit}
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
        <ColorField
          label="Light colour"
          value={value.color}
          onPreview={(color) => drag({ color })}
          onChange={(color) => set({ color })}
          swatches={LIGHT_SWATCHES}
        />
        <SliderField
          label="Ambient"
          value={value.ambient}
          min={0}
          max={2}
          step={0.05}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(ambient) => drag({ ambient })}
          onCommit={commit}
        />
        <ResetRow disabled={atDefaults} onReset={() => set(lightingSettings(value.preset))} />
      </DisclosureSection>
    </>
  );
}

/** Common light temperatures for the light colour picker. */
const LIGHT_SWATCHES = [
  { label: "Neutral white", color: "#ffffff" },
  { label: "Warm 3200 K", color: "#ffd2a1" },
  { label: "Soft warm 4000 K", color: "#ffe4c4" },
  { label: "Daylight 5600 K", color: "#fff3e8" },
  { label: "Cool 7500 K", color: "#e6ecff" },
  { label: "Blue hour", color: "#a9c4ff" },
] as const;

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
  const preview = useStudioStore((s) => s.preview);
  const setBg = (bg: Background) => apply((s) => ({ ...s, background: bg }));
  const dragBg = (bg: Background) => preview((s) => ({ ...s, background: bg }));
  const presetId = BACKGROUND_PRESETS.find((p) => sameBackground(p.background, background))?.id ?? "";

  const changeType = (type: Background["type"]) => {
    if (type === background.type) return;
    if (type === "solid") setBg({ type, color: background.type === "gradient" ? background.to : "#161618" });
    else if (type === "gradient") setBg(BACKGROUND_PRESETS[0].background);
    else setBg({ type: "transparent" });
  };

  return (
    <>
      <Section title="Presets">
        <RadioGroup.Root
          aria-label="Background preset"
          value={presetId}
          onValueChange={(id) => setBg(BACKGROUND_PRESETS.find((p) => p.id === id)!.background)}
          className="grid grid-cols-4 gap-2"
        >
          {BACKGROUND_PRESETS.map((p) => (
            <RadioGroup.Item
              key={p.id}
              value={p.id}
              className="group flex flex-col items-center gap-1 rounded-md outline-offset-2"
            >
              <span
                className={cn(
                  "ring-line relative block aspect-[4/3] w-full overflow-hidden rounded-md ring-1",
                  "group-hover:ring-line-strong group-data-[state=checked]:ring-accent group-data-[state=checked]:ring-2",
                  p.background.type === "transparent" && "checkerboard",
                )}
                style={{ background: backgroundToCss(p.background) }}
              />
              <span className="text-2xs text-muted group-data-[state=checked]:text-fg truncate">{p.label}</span>
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
      </Section>

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
              <ColorField
                label="Colour"
                alpha
                swatches={BACKGROUND_SWATCHES}
                value={background.color}
                onPreview={(color) => dragBg({ type: "solid", color })}
                onChange={(color) => setBg({ type: "solid", color })}
              />
            </>
          )}
          {background.type === "gradient" && (
            <>
              <ColorField
                label="Centre"
                alpha
                value={background.from}
                onPreview={(from) => dragBg({ ...background, from })}
                onChange={(from) => setBg({ ...background, from })}
              />
              <ColorField
                label="Edge"
                alpha
                value={background.to}
                onPreview={(to) => dragBg({ ...background, to })}
                onChange={(to) => setBg({ ...background, to })}
              />
            </>
          )}
          {background.type === "transparent" && (
            <PanelNote>
              The checkerboard marks transparency. PNG exports and embeds will show whatever is behind them.
            </PanelNote>
          )}
          {background.type !== "transparent" && backgroundIsTranslucent(background) && (
            <PanelNote>Below 100 % opacity the checkerboard shows where the background is see-through.</PanelNote>
          )}
        </div>
      </Section>
    </>
  );
}

function sameBackground(a: Background, b: Background): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* ───────────────────────── Motion ───────────────────────── */

function SubHeading({ children }: { children: ReactNode }) {
  return <p className="text-2xs text-muted pt-2.5 pb-0.5 font-medium">{children}</p>;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const degrees = (v: number) => `±${v}°`;

export function MotionPanel() {
  const { value, set, drag, commit } = useSection("motion");
  const reducedMotion = usePrefersReducedMotion();

  return (
    <>
      <Section title="Cursor tracking">
        <SwitchRow
          label="Follow cursor"
          description="The head turns toward the pointer."
          checked={value.tracking}
          onChange={(tracking) => set({ tracking })}
        />
        <SubHeading>Range</SubHeading>
        <SliderField
          label="Horizontal"
          value={value.yawLimit}
          min={0}
          max={60}
          format={degrees}
          onChange={(yawLimit) => drag({ yawLimit })}
          onCommit={commit}
          disabled={!value.tracking}
        />
        <SliderField
          label="Vertical"
          value={value.pitchLimit}
          min={0}
          max={30}
          format={degrees}
          onChange={(pitchLimit) => drag({ pitchLimit })}
          onCommit={commit}
          disabled={!value.tracking}
        />
        <SubHeading>Sensitivity</SubHeading>
        <SliderField
          label="Horizontal"
          value={value.sensitivityX}
          min={0}
          max={1}
          step={0.05}
          format={pct}
          onChange={(sensitivityX) => drag({ sensitivityX })}
          onCommit={commit}
          disabled={!value.tracking}
        />
        <SliderField
          label="Vertical"
          value={value.sensitivityY}
          min={0}
          max={1}
          step={0.05}
          format={pct}
          onChange={(sensitivityY) => drag({ sensitivityY })}
          onCommit={commit}
          disabled={!value.tracking}
        />
        {reducedMotion && (
          <p className="text-2xs text-muted flex gap-1.5 pt-1 leading-4">
            <Info className="mt-px size-3 shrink-0" aria-hidden="true" />
            Reduced motion is on for this device, so cursor tracking starts off and movement is calmer.
          </p>
        )}
      </Section>

      <Section title="Manual rotation">
        <SwitchRow
          label="Drag to rotate"
          description="Click and drag, or swipe on touch screens."
          checked={value.dragEnabled}
          onChange={(dragEnabled) => set({ dragEnabled })}
        />
        <Field label="On release" labelId="drag-release-label">
          <Segmented
            ariaLabelledBy="drag-release-label"
            value={value.dragRelease}
            onChange={(dragRelease) => set({ dragRelease })}
            options={[
              { value: "return", label: "Return", disabled: !value.dragEnabled },
              { value: "hold", label: "Hold", disabled: !value.dragEnabled },
            ]}
          />
        </Field>
        <PanelNote>
          {value.dragRelease === "return"
            ? "The head eases back to face forward after a short pause."
            : "The head stays where you leave it."}
        </PanelNote>
        <SliderField
          label="Touch speed"
          value={value.touchSensitivity}
          min={0.2}
          max={1.5}
          step={0.05}
          format={pct}
          onChange={(touchSensitivity) => drag({ touchSensitivity })}
          onCommit={commit}
          disabled={!value.dragEnabled}
        />
        <PanelNote>Swipe rotation on touch screens, relative to mouse dragging.</PanelNote>
      </Section>

      <DisclosureSection title="Feel">
        <SliderField
          label="Smoothness"
          value={value.smoothness}
          min={0}
          max={1}
          step={0.05}
          format={pct}
          onChange={(smoothness) => drag({ smoothness })}
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
      <PreviewNote>GLB downloads and PNG renders are coming in Milestone 11.</PreviewNote>

      <Section title="3D model" action={<ComingBadge milestone={11} />}>
        <ExportRow title="GLB · Original" description="Reconstructed geometry and textures" />
        <ExportRow title="GLB · Styled" description="With the current material applied" />
      </Section>

      <Section title="Image" action={<ComingBadge milestone={11} />}>
        <Field label="Size" labelId="png-size-label">
          <Segmented
            ariaLabelledBy="png-size-label"
            value={scale}
            onChange={setScale}
            options={[
              { value: "1", label: "1×", disabled: true },
              { value: "2", label: "2×", disabled: true },
              { value: "4", label: "4×", disabled: true },
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
