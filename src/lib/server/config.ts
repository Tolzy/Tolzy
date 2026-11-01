import "server-only";

/**
 * Server configuration. Everything here stays on the server; nothing is
 * exposed to the browser except what `publicStatus()` returns.
 */

export type BackendKind = "local" | "none";
export type ProviderId = "fixture" | "meshy";

/** Hosted deployments (Vercel) must never use the local development backend or fixture. */
const hosted = () => Boolean(process.env.VERCEL);

/**
 * The local backend stores accounts, photos and models on this machine
 * (`DATA_DIR`, default `.data`). It is for development and automated tests:
 * enabled only with LOCAL_BACKEND=1, refused on hosted deployments. The
 * production backend (Supabase Auth + Storage, docs/data-model.md) plugs in
 * behind the same interfaces once its project exists.
 */
export function backendKind(): BackendKind {
  return process.env.LOCAL_BACKEND === "1" && !hosted() ? "local" : "none";
}

export function dataDir(): string {
  return process.env.DATA_DIR || ".data";
}

export interface ProviderConfig {
  id: ProviderId;
  /** Shown to users before they consent. */
  name: string;
  /** Where photos go. */
  processing: string;
  external: boolean;
  /** External providers need a key and explicit product-owner approval. */
  enabled: boolean;
  reason?: string;
}

/**
 * The reconstruction provider. External providers stay disabled unless the
 * key is present AND RECONSTRUCTION_PROVIDER_APPROVED=1 (no spending without
 * approval — product-owner decision 2).
 */
export function providerConfig(): ProviderConfig | null {
  const id = (process.env.RECONSTRUCTION_PROVIDER ?? "") as ProviderId;
  if (id === "fixture") {
    return hosted()
      ? null
      : {
          id,
          name: "Development fixture",
          processing:
            "No external processing. Returns the bundled sample head after the real pipeline steps — it is not a reconstruction of your photo.",
          external: false,
          enabled: true,
        };
  }
  if (id === "meshy") {
    const keyed = Boolean(process.env.RECONSTRUCTION_API_KEY);
    const approved = process.env.RECONSTRUCTION_PROVIDER_APPROVED === "1";
    return {
      id,
      name: "Meshy (Multi-Image to 3D)",
      processing: "Photos are sent to Meshy’s servers (United States) to build the 3D model.",
      external: true,
      enabled: keyed && approved,
      reason: !keyed ? "No API key configured." : !approved ? "Awaiting product-owner approval." : undefined,
    };
  }
  return null;
}

/** What the browser may know: availability only, never keys. */
export function publicStatus() {
  const provider = providerConfig();
  return {
    backend: backendKind(),
    provider: provider
      ? {
          id: provider.id,
          name: provider.name,
          processing: provider.processing,
          external: provider.external,
          enabled: provider.enabled,
          reason: provider.reason ?? null,
        }
      : null,
  };
}

/** Current consent text version (stored with every consent record). */
export const CONSENT_VERSION = "2026-10-31";

/** Source photos are deleted this long after generation unless kept (decision 3). */
export const PHOTO_RETENTION_DAYS = 30;

/** Photos of failed or cancelled generations are deleted after this (unless kept). */
export const FAILED_PHOTO_RETENTION_DAYS = 7;
