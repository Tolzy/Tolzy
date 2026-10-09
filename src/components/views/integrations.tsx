"use client";

import { AlertTriangle, Eye, FlaskConical, GitBranch, GitPullRequest, Lock, RefreshCw, Search, ShieldCheck, Unplug } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useNow, useSync } from "@/components/app/hooks";
import { Page, PageHeader } from "@/components/app/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Checkbox, Input, Select, Switch } from "@/components/ui/form";
import { GitHubMark, Skeleton } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import type { RemoteRepository } from "@/lib/services/contracts";
import { db } from "@/lib/services/db";
import { repositoryService } from "@/lib/services/mock";
import { useDb, useWorkspace } from "@/lib/store";
import { cn, formatDateTime, pluralize, relativeTimeLong } from "@/lib/utils";

function RepoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { workspace } = useWorkspace();
  const toast = useToast();
  const [repos, setRepos] = useState<RemoteRepository[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRepos(null);
    setError(null);
    setQ("");
    repositoryService
      .listAvailable(workspace.id)
      .then((list) => {
        setRepos(list);
        setChosen(new Set(list.filter((r) => r.connected).map((r) => r.fullName)));
      })
      .catch((e: Error) => setError(e.message));
  }, [open, workspace.id]);

  const filtered = (repos ?? []).filter((r) => r.fullName.toLowerCase().includes(q.toLowerCase()));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Choose repositories"
      description="Shiplog will read commits and pull requests from these repositories. (Demo: the list below is simulated.)"
      footer={
        <>
          <span className="mr-auto text-xs text-fg-subtle">{pluralize(chosen.size, "repository", "repositories")} selected</span>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!repos || chosen.size === 0}
            onClick={async () => {
              setSaving(true);
              try {
                await repositoryService.setConnectedRepositories(workspace.id, [...chosen]);
                toast.success("Repositories updated", `${pluralize(chosen.size, "repository", "repositories")} connected (demo).`);
                onClose();
              } catch (e) {
                toast.error("Couldn't update repositories", (e as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <Input leading={<Search />} placeholder="Filter repositories" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter repositories" data-autofocus />
      <div className="scrollbar-thin mt-3 max-h-[320px] overflow-y-auto rounded-lg border border-line">
        {error ? (
          <p role="alert" className="p-4 text-sm text-danger">{error}</p>
        ) : !repos ? (
          <div aria-busy="true" aria-label="Loading repositories" className="divide-y divide-line">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="size-4" />
                <div className="flex-1"><Skeleton className="h-3 w-40" /><Skeleton className="mt-2 h-2.5 w-56" /></div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-fg-subtle">No repositories match “{q}”.</p>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((r) => {
              const on = chosen.has(r.fullName);
              return (
                <li key={r.fullName}>
                  <label className={cn("flex cursor-pointer items-start gap-3 p-3 transition-colors hover:bg-surface-2/60", on && "bg-accent-soft/40")}>
                    <span className="pt-0.5">
                      <Checkbox
                        checked={on}
                        label={r.fullName}
                        onChange={(v) =>
                          setChosen((s) => {
                            const n = new Set(s);
                            if (v) n.add(r.fullName);
                            else n.delete(r.fullName);
                            return n;
                          })
                        }
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-mono text-sm text-fg">{r.fullName}</span>
                        {r.private && <Lock className="size-3 text-fg-faint" aria-label="Private" />}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-fg-subtle">{r.description}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 font-mono text-2xs text-fg-faint">
                      <GitBranch className="size-3" aria-hidden />
                      {r.defaultBranch}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

const PERMISSIONS = [
  { icon: <Eye />, title: "Read repository metadata", desc: "Names, default branches and descriptions." },
  { icon: <GitPullRequest />, title: "Read commits and pull requests", desc: "Titles, descriptions, authors and links, used to suggest release stories." },
  { icon: <ShieldCheck />, title: "No write access", desc: "Shiplog never pushes code, comments, or changes settings in your repositories." },
];

export function IntegrationsView() {
  const now = useNow();
  const params = useSearchParams();
  const state = useDb();
  const { workspace, integration, repositories } = useWorkspace();
  const toast = useToast();
  const { sync, syncing } = useSync();
  const [repoDialog, setRepoDialog] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (params.get("select") && integration.status !== "disconnected") setRepoDialog(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connected = integration.status !== "disconnected";
  const statusBadge = useMemo(() => {
    switch (integration.status) {
      case "connected":
        return <Badge tone="success" dot>Connected</Badge>;
      case "syncing":
        return <Badge tone="warning" dot>Syncing…</Badge>;
      case "error":
        return <Badge tone="danger" dot>Sync failed</Badge>;
      default:
        return <Badge tone="outline">Not connected</Badge>;
    }
  }, [integration.status]);

  const setDemo = (patch: Partial<typeof state.demo>) => db.update((s) => ({ ...s, demo: { ...s.demo, ...patch } }));

  return (
    <Page>
      <PageHeader title="Integrations" description="Connect the sources Shiplog reads to discover what your team has shipped." />

      <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
        <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <span className="font-medium">Demo mode.</span> This prototype uses simulated GitHub data. No credentials are requested, and nothing is sent to GitHub — connection and sync states below are simulated.
        </p>
      </div>

      <section aria-labelledby="gh-heading" className="mt-6 rounded-xl border border-line bg-surface">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-invert text-invert-fg">
            <GitHubMark className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="gh-heading" className="text-[15px] font-semibold">GitHub</h2>
              {statusBadge}
              {connected && <Badge tone="outline">Simulated</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-fg-subtle">
              {connected ? (
                <>
                  Connected as <span className="font-mono text-fg">{integration.account}</span>
                  {integration.lastSyncedAt && <> · last synced {relativeTimeLong(integration.lastSyncedAt, now)}</>}
                </>
              ) : (
                "Import commits and pull requests to draft release stories."
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {connected ? (
              <>
                <Button icon={<RefreshCw className={cn("size-3.5", syncing && "animate-[spin_0.8s_linear_infinite]")} />} onClick={sync} disabled={syncing}>
                  {syncing ? "Syncing" : "Sync now"}
                </Button>
                <Button variant="danger" icon={<Unplug className="size-3.5" />} onClick={() => setConfirmDisconnect(true)}>
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                loading={connecting}
                icon={<GitHubMark className="size-3.5" />}
                onClick={async () => {
                  setConnecting(true);
                  try {
                    await repositoryService.connectAccount(workspace.id);
                    toast.success("GitHub connected (simulated)", "Now choose which repositories to read.");
                    setRepoDialog(true);
                  } catch (e) {
                    toast.error("Couldn't connect", (e as Error).message);
                  } finally {
                    setConnecting(false);
                  }
                }}
              >
                {connecting ? "Connecting…" : "Connect GitHub"}
              </Button>
            )}
          </div>
        </div>

        {integration.status === "error" && integration.lastError && (
          <div role="alert" className="mx-5 mb-5 flex items-start gap-2 rounded-md border border-danger/25 bg-danger-soft px-3 py-2.5 text-sm text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="flex-1">
              <p className="font-medium">The last sync failed</p>
              <p className="text-xs opacity-90">{integration.lastError}</p>
            </div>
            <Button size="sm" onClick={sync}>Retry</Button>
          </div>
        )}

        {connected && (
          <div className="grid border-t border-line md:grid-cols-2">
            <div className="p-5 md:border-r md:border-line">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold">Connected repositories</h3>
                <button onClick={() => setRepoDialog(true)} className="text-xs font-medium text-accent hover:underline">
                  Manage
                </button>
              </div>
              {repositories.length ? (
                <ul className="mt-3 space-y-2">
                  {repositories.map((r) => (
                    <li key={r.id} className="flex items-center gap-2.5 text-sm">
                      {r.private ? <Lock className="size-3.5 text-fg-faint" aria-label="Private" /> : <GitHubMark className="size-3.5 text-fg-faint" />}
                      <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{r.fullName}</span>
                      <span className="flex items-center gap-1 font-mono text-2xs text-fg-faint">
                        <GitBranch className="size-3" aria-hidden />
                        {r.defaultBranch}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 rounded-md border border-dashed border-line-strong p-4 text-center">
                  <p className="text-sm text-fg-subtle">No repositories selected yet.</p>
                  <Button size="sm" className="mt-2" onClick={() => setRepoDialog(true)}>Choose repositories</Button>
                </div>
              )}
              {integration.lastSyncedAt && <p className="mt-4 text-2xs text-fg-faint">Last sync: {formatDateTime(integration.lastSyncedAt)}</p>}
            </div>
            <div className="p-5">
              <h3 className="text-xs font-semibold">Permissions</h3>
              <ul className="mt-3 space-y-3">
                {PERMISSIONS.map((p) => (
                  <li key={p.title} className="flex gap-3">
                    <span className="mt-0.5 text-fg-subtle [&>svg]:size-4">{p.icon}</span>
                    <span>
                      <span className="block text-sm text-fg">{p.title}</span>
                      <span className="block text-xs text-fg-subtle">{p.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {!connected && (
          <div className="border-t border-line p-5">
            <h3 className="text-xs font-semibold">What Shiplog will be able to do</h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-3">
              {PERMISSIONS.map((p) => (
                <li key={p.title} className="flex gap-2.5">
                  <span className="mt-0.5 text-fg-subtle [&>svg]:size-4">{p.icon}</span>
                  <span>
                    <span className="block text-sm">{p.title}</span>
                    <span className="block text-xs text-fg-subtle">{p.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-labelledby="demo-heading" className="mt-8">
        <h2 id="demo-heading" className="text-sm font-semibold">Demo controls</h2>
        <p className="mt-0.5 text-xs text-fg-subtle">Explore loading and error states without a real GitHub connection.</p>
        <div className="mt-4 space-y-4 rounded-xl border border-line bg-surface p-5">
          <Switch checked={state.demo.failNextSync} onChange={(failNextSync) => setDemo({ failNextSync })} label="Fail the next sync" description="The next “Sync now” returns a simulated 502 error." />
          <Switch checked={state.demo.activityError} onChange={(activityError) => setDemo({ activityError })} label="Fail activity loading" description="The Activity page shows its error state until this is turned off." />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Simulated network latency</p>
              <p className="mt-0.5 text-xs text-fg-subtle">Slower speeds make loading skeletons easier to see.</p>
            </div>
            <div className="w-32">
              <Select value={String(state.demo.latency)} onChange={(e) => setDemo({ latency: Number(e.target.value) })} aria-label="Simulated latency">
                <option value="150">Fast</option>
                <option value="450">Normal</option>
                <option value="1400">Slow</option>
              </Select>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="more-heading" className="mt-8">
        <h2 id="more-heading" className="text-sm font-semibold">More sources</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            { name: "GitLab", desc: "Merge requests and commits" },
            { name: "Linear", desc: "Completed issues and projects" },
            { name: "Slack", desc: "Announce releases in a channel" },
          ].map((i) => (
            <li key={i.name} aria-disabled="true" className="rounded-lg border border-dashed border-line-strong p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-fg-muted">{i.name}</span>
                <Badge tone="outline">Not in prototype</Badge>
              </div>
              <p className="mt-1 text-xs text-fg-faint">{i.desc}</p>
            </li>
          ))}
        </ul>
      </section>

      <RepoDialog open={repoDialog} onClose={() => setRepoDialog(false)} />
      <ConfirmDialog
        open={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        tone="danger"
        loading={disconnecting}
        title="Disconnect GitHub?"
        description="Shiplog will stop syncing activity. Existing releases and the public changelog stay as they are."
        confirmLabel="Disconnect"
        onConfirm={async () => {
          setDisconnecting(true);
          await repositoryService.disconnectAccount(workspace.id);
          setDisconnecting(false);
          setConfirmDisconnect(false);
          toast.success("GitHub disconnected");
        }}
      />
      <span className="sr-only" aria-live="polite">{integration.status === "syncing" ? "Syncing" : ""}</span>
    </Page>
  );
}
