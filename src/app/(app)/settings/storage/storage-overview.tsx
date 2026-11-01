"use client";

import { Box, Download, Image as ImageIcon, Info } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import { Dialog, DialogClose } from "@/components/ui/overlays";
import { Notice, SettingsGroup, SettingsRow } from "@/components/shell/settings-rows";
import { useAppStatus } from "@/components/account/use-account";

interface Summary {
  count: number;
  bytes: number;
  keep: boolean;
  nextDeletion: string | null;
  models: { count: number; bytes: number };
}

const size = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const files = (n: number) => (n === 1 ? "1 file" : `${n} files`);

function AssetRow({ icon, label, detail, policy }: { icon: ReactNode; label: string; detail: string; policy: string }) {
  return (
    <SettingsRow
      label={
        <span className="[&_svg]:text-subtle flex items-center gap-2.5 [&_svg]:size-4">
          {icon}
          {label}
        </span>
      }
      description={policy}
    >
      <span className="tabular text-muted text-right text-xs">{detail}</span>
    </SettingsRow>
  );
}

/**
 * Stored photos and models for the signed-in user, with the photo retention
 * controls. Signed out (or without an account backend) it shows the rules
 * only — nothing is stored then.
 */
export function StorageOverview() {
  const status = useAppStatus();
  const signedIn = Boolean(status?.user);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/photos", { cache: "no-store" });
    if (res.ok) setSummary((await res.json()) as Summary);
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    // Deferred so the first fetch isn't a synchronous state update in the effect.
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [signedIn, load]);

  const setKeep = async (keep: boolean) => {
    setBusy(true);
    const res = await fetch("/api/photos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keep }),
    });
    setBusy(false);
    setMessage(
      res.ok ? (keep ? "Your photographs will be kept." : "Automatic deletion is back on.") : "That didn’t work.",
    );
    await load();
  };
  const deleteAll = async () => {
    setBusy(true);
    const res = await fetch("/api/photos", { method: "DELETE" });
    setBusy(false);
    setConfirm(false);
    if (res.ok) {
      const { removed } = (await res.json()) as { removed: number };
      setMessage(removed === 1 ? "1 photograph deleted." : `${removed} photographs deleted.`);
    } else setMessage("That didn’t work.");
    await load();
  };

  const photos = summary ?? { count: 0, bytes: 0, keep: false, nextDeletion: null, models: { count: 0, bytes: 0 } };
  const live = signedIn && summary;

  return (
    <>
      {!signedIn && (
        <Notice icon={<Info />}>
          Sign in to see and manage the files stored in your account. These are the rules that will apply to them.
        </Notice>
      )}

      <SettingsGroup
        title="Stored assets"
        description="Everything is private by default. Each type can be deleted on its own."
      >
        <AssetRow
          icon={<ImageIcon />}
          label="Source photographs"
          detail={`${files(photos.count)} · ${size(photos.bytes)}`}
          policy={
            photos.keep
              ? "Kept until you delete them."
              : photos.nextDeletion
                ? `Deleted automatically — next on ${new Date(photos.nextDeletion).toLocaleDateString()}. 30 days after a portrait is generated, 7 days after a failed one.`
                : "Deleted 30 days after your portrait is generated (7 days after a failed one), unless you keep them."
          }
        />
        <AssetRow
          icon={<Box />}
          label="3D models"
          detail={`${files(photos.models.count)} · ${size(photos.models.bytes)}`}
          policy="Kept until you delete the portrait. Never publicly accessible."
        />
        <AssetRow
          icon={<Download />}
          label="Exports"
          detail="Coming with exports"
          policy="PNG renders and styled GLBs. Kept until you delete them."
        />
      </SettingsGroup>

      <SettingsGroup title="Photograph retention">
        <SettingsRow
          label={<label htmlFor="keep-photos">Keep my photographs</label>}
          description="Keep your stored source photographs after generation so you can regenerate later. Off by default."
        >
          <Switch
            id="keep-photos"
            checked={photos.keep}
            onChange={(v) => void setKeep(v)}
            disabled={!live || busy || photos.count === 0}
          />
        </SettingsRow>
        <SettingsRow
          label="Delete all photographs now"
          description="Removes every source photograph immediately. Your 3D models are not affected."
        >
          <Button
            variant="secondary"
            className="text-danger"
            disabled={!live || busy || photos.count === 0}
            onClick={() => setConfirm(true)}
          >
            Delete photographs
          </Button>
        </SettingsRow>
        {message && (
          <p role="status" className="text-muted px-1 pt-2 text-xs" data-testid="storage-message">
            {message}
          </p>
        )}
      </SettingsGroup>

      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete all photographs?"
        description={`${files(photos.count)} will be removed permanently. Your portraits stay, but can’t be regenerated from these photos.`}
        width="sm"
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="danger" disabled={busy} onClick={() => void deleteAll()}>
              Delete
            </Button>
          </>
        }
      />
    </>
  );
}
