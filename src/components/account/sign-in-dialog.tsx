"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/stores/account-store";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlays";

/**
 * Sign-in for the local development backend: an account on this computer,
 * identified by email, no password. The production backend (Supabase Auth,
 * magic link / OAuth) replaces this dialog's form.
 */
export function SignInDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signIn = useAccount((s) => s.signIn);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const err = await signIn(email, name);
    setBusy(false);
    if (err) return setError(err);
    setOpen(false);
    router.refresh();
  };

  const input =
    "bg-sunken ring-line focus:ring-line-strong text-fg h-9 w-full rounded-md px-3 text-sm ring-1 outline-none ring-inset";
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title="Sign in"
      description="Local development account — stored only on this computer. Production uses secure email sign-in."
      width="sm"
    >
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs">
          <span className="text-muted">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${input} mt-1`}
          />
        </label>
        <label className="block text-xs">
          <span className="text-muted">Name (optional)</span>
          <input
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${input} mt-1`}
          />
        </label>
        {error && (
          <p role="alert" className="text-danger text-xs">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Dialog>
  );
}
