"use client";

import { Download, Moon, RotateCcw, Sun } from "lucide-react";
import { useState } from "react";
import { useCopy } from "@/components/app/hooks";
import { Page, PageHeader } from "@/components/app/page";
import { NAV } from "@/components/app/sidebar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { Kbd } from "@/components/ui/kbd";
import { SectionHeader, Segmented } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { db } from "@/lib/services/db";
import { publishingService } from "@/lib/services/mock";
import { useAppTheme, useWorkspace } from "@/lib/store";

function Row({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-md">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-0.5 text-xs text-fg-subtle">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ["⌘ K", "Open command menu"],
  ["C", "Create release"],
  ["⌘ S", "Save the release you're editing"],
  ["⇧ ⌘ L", "Toggle light / dark workspace theme"],
  ...NAV.map((n) => [n.shortcut, `Go to ${n.label}`] as [string, string]),
];

export function SettingsView() {
  const { workspace } = useWorkspace();
  const [theme, setTheme] = useAppTheme();
  const toast = useToast();
  const copy = useCopy();
  const [confirmReset, setConfirmReset] = useState(false);
  const [name, setName] = useState(workspace.name);

  return (
    <Page className="max-w-[860px]">
      <PageHeader title="Settings" description="Workspace preferences and prototype data." />

      <section aria-labelledby="ws-heading">
        <SectionHeader id="ws-heading" title="Workspace" className="mb-2" />
        <Row title="Workspace name" description="Shown in the sidebar and workspace switcher.">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = name.trim();
              if (!v) return toast.error("Name can't be empty");
              db.update((s) => ({ ...s, workspaces: s.workspaces.map((w) => (w.id === workspace.id ? { ...w, name: v, initials: v.charAt(0).toUpperCase() } : w)) }));
              toast.success("Workspace renamed");
            }}
          >
            <Field label="Workspace name" htmlFor="ws-name" className="[&>label]:sr-only">
              <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} className="w-56" />
            </Field>
            <Button type="submit" disabled={name.trim() === workspace.name}>Save</Button>
          </form>
        </Row>
        <Row title="Public changelog URL" description="Release slugs are generated from titles and stay stable once published.">
          <button onClick={() => copy(publishingService.publicUrl(workspace.slug))} className="rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg">
            /changelog/{workspace.slug}
          </button>
        </Row>
        <Row title="Workspace theme" description="Applies to the Shiplog app. The public changelog has its own theme in Appearance.">
          <Segmented
            label="Workspace theme"
            value={theme}
            onChange={setTheme}
            options={[
              { value: "light", label: "Light", icon: <Sun /> },
              { value: "dark", label: "Dark", icon: <Moon /> },
            ]}
          />
        </Row>
      </section>

      <section aria-labelledby="kb-heading" className="mt-12">
        <SectionHeader id="kb-heading" title="Keyboard shortcuts" className="mb-2" />
        <dl className="grid gap-x-10 pt-3 sm:grid-cols-2">
          {SHORTCUTS.map(([k, label]) => (
            <div key={label} className="flex items-center justify-between py-1.5">
              <dt className="text-sm text-fg-muted">{label}</dt>
              <dd className="flex gap-1">
                {k.split(" ").map((p) => <Kbd key={p}>{p}</Kbd>)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="data-heading" className="mt-12">
        <SectionHeader id="data-heading" title="Prototype data" className="mb-2" />
        <Row title="Export data" description="Download every workspace, release and setting stored in this browser as JSON.">
          <Button
            icon={<Download className="size-3.5" />}
            onClick={() => {
              const blob = new Blob([JSON.stringify(db.get(), null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `shiplog-${workspace.slug}-export.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export JSON
          </Button>
        </Row>
        <Row title="Reset demo" description="Restore the original Orbit demo: releases, activity, appearance and integration state.">
          <Button variant="danger" icon={<RotateCcw className="size-3.5" />} onClick={() => setConfirmReset(true)}>
            Reset demo data
          </Button>
        </Row>
      </section>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        tone="danger"
        title="Reset all demo data?"
        description="Every change you've made in this browser — drafts, published releases, appearance — will be replaced with the original demo."
        confirmLabel="Reset everything"
        onConfirm={() => {
          db.reset();
          setConfirmReset(false);
          setName(db.get().workspaces.find((w) => w.id === db.get().activeWorkspaceId)?.name ?? "");
          toast.success("Demo data restored");
        }}
      />
    </Page>
  );
}
