"use client";

import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Segmented, SliderField, SwitchRow } from "@/components/ui/controls";
import { ColorField } from "@/components/ui/color/color-field";
import { Badge, DisclosureSection, EmptyState, PresetGroup, PresetTile, Section } from "@/components/ui/display";
import { Dialog, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Select } from "@/components/ui/overlays";
import { Tooltip } from "@/components/ui/tooltip";
import { PortraitCard, PortraitMenuButton, type PortraitCardData } from "@/components/dashboard/portrait-tiles";
import { MATERIAL_PRESETS } from "@/lib/studio/presets";
import type { MaterialPreset } from "@/lib/studio/settings";

// Example data for this gallery only.
const EXAMPLE_CARDS: PortraitCardData[] = [
  { id: "example-ready", name: "Ready portrait", status: "ready", meta: "Edited 2 h ago · Chrome" },
  { id: "example-generating", name: "Generating portrait", status: "generating", meta: "Started 1 min ago" },
  { id: "example-failed", name: "Failed portrait", status: "failed", meta: "No face detected" },
];

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-line border-t py-8">
      <h2 className="text-muted mb-5 text-xs font-medium">{title}</h2>
      {children}
    </section>
  );
}

export function ComponentGallery() {
  const [segment, setSegment] = useState<"a" | "b" | "c">("a");
  const [slider, setSlider] = useState(0.65);
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(false);
  const [color, setColor] = useState("#3b5bfd");
  const [sort, setSort] = useState<"edited" | "name">("edited");
  const [preset, setPreset] = useState<MaterialPreset>("chrome");

  return (
    <main className="mx-auto max-w-[960px] px-6 py-12">
      <h1 className="text-xl font-semibold tracking-[-0.015em]">Components</h1>
      <p className="text-muted mt-1.5 text-sm">Studio Neutral design system. Development only.</p>

      <Block title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">Primary</Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Delete</Button>
          <Button aria-disabled="true">Unavailable</Button>
          <Button size="sm">Small</Button>
          <Button size="lg" variant="primary">
            <Plus /> Large
          </Button>
          <Tooltip content="Icon button" shortcut={["⌘", "E"]}>
            <Button iconOnly aria-label="Edit">
              <Pencil />
            </Button>
          </Tooltip>
        </div>
      </Block>

      <Block title="Badges">
        <div className="flex flex-wrap gap-2">
          <Badge>Neutral</Badge>
          <Badge tone="outline">Outline</Badge>
          <Badge tone="accent">Accent</Badge>
          <Badge tone="success">Ready</Badge>
          <Badge tone="warning">Warning</Badge>
          <span className="bg-vp rounded-md p-1.5">
            <Badge tone="float">Floating</Badge>
          </span>
        </div>
      </Block>

      <Block title="Inspector controls">
        <div className="border-line bg-surface w-[288px] rounded-lg border">
          <Section title="Section">
            <Segmented
              ariaLabel="Example"
              value={segment}
              onChange={setSegment}
              options={[
                { value: "a", label: "One" },
                { value: "b", label: "Two" },
                { value: "c", label: "Three" },
              ]}
            />
            <SliderField
              label="Sensitivity"
              value={slider}
              min={0}
              max={1}
              step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={setSlider}
            />
            <ColorField label="Colour" value={color} onChange={setColor} alpha />
            <SwitchRow label="Follow cursor" description="With a description." checked={on} onChange={setOn} />
          </Section>
          <Section title="Presets">
            <PresetGroup label="Material" value={preset} onChange={setPreset}>
              {MATERIAL_PRESETS.map((p) => (
                <PresetTile
                  key={p.id}
                  value={p.id}
                  label={p.label}
                  preview={
                    p.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.preview} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="bg-sunken block size-full" />
                    )
                  }
                />
              ))}
            </PresetGroup>
          </Section>
          <DisclosureSection title="Advanced">
            <p className="text-muted text-xs">Hidden until expanded.</p>
          </DisclosureSection>
        </div>
      </Block>

      <Block title="Form">
        <Checkbox checked={checked} onChange={setChecked}>
          I am the person in this photo, or I have their permission.
        </Checkbox>
      </Block>

      <Block title="Menus, select and dialog">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            ariaLabel="Sort"
            prefix="Sort"
            value={sort}
            onChange={setSort}
            options={[
              { value: "edited", label: "Last edited" },
              { value: "name", label: "Name" },
            ]}
          />
          <Menu>
            <MenuTrigger asChild>
              <Button>Open menu</Button>
            </MenuTrigger>
            <MenuContent align="start">
              <MenuItem icon={<Pencil />}>Rename</MenuItem>
              <MenuItem icon={<Copy />}>Duplicate settings</MenuItem>
              <MenuSeparator />
              <MenuItem icon={<Trash2 />} danger>
                Delete
              </MenuItem>
            </MenuContent>
          </Menu>
          <Dialog
            trigger={<Button>Open dialog</Button>}
            title="Delete portrait?"
            description="This permanently deletes the 3D model, its exports and any published embed."
            width="sm"
            footer={
              <>
                <Button>Cancel</Button>
                <Button variant="danger">Delete</Button>
              </>
            }
          />
        </div>
      </Block>

      <Block title="Portrait cards (example data)">
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3">
          {EXAMPLE_CARDS.map((card) => (
            <PortraitCard
              key={card.id}
              portrait={card}
              menu={
                <Menu>
                  <MenuTrigger asChild>
                    <PortraitMenuButton />
                  </MenuTrigger>
                  <MenuContent>
                    <MenuItem icon={<Pencil />}>Rename</MenuItem>
                    <MenuSeparator />
                    <MenuItem icon={<Trash2 />} danger>
                      Delete
                    </MenuItem>
                  </MenuContent>
                </Menu>
              }
            />
          ))}
        </div>
      </Block>

      <Block title="Empty state">
        <div className="border-line rounded-xl border">
          <EmptyState
            icon={<Plus />}
            title="No portraits yet"
            description="Create your first portrait from a single photo."
            actions={<Button variant="primary">New portrait</Button>}
          />
        </div>
      </Block>
    </main>
  );
}
