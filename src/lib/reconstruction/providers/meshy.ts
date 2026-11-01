import "server-only";

import { ProviderError, type ProviderStatus, type ReconstructionInput, type ReconstructionProvider } from "../types";

/**
 * Meshy Multi-Image to 3D (https://docs.meshy.ai/api/multi-image-to-3d).
 * 1–4 images, front first; JSON over HTTPS with a Bearer key.
 *
 * Status: implemented against the published API and unit-tested with
 * recorded response shapes; NOT yet run against the live service — it stays
 * disabled until the product owner approves the provider and its spending.
 */
const BASE = "https://api.meshy.ai/openapi/v1/multi-image-to-3d";
const MAX_RESULT_BYTES = 150 * 1024 * 1024;

type Fetch = typeof fetch;

export function createMeshyProvider(apiKey: string, fetchImpl: Fetch = fetch): ReconstructionProvider {
  const call = async (url: string, init?: RequestInit) => {
    let res: Response;
    try {
      res = await fetchImpl(url, {
        ...init,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new ProviderError({
        code: "network",
        message: "The reconstruction service couldn’t be reached.",
        retryable: true,
      });
    }
    if (res.ok) return res;
    const body = await res.text().catch(() => "");
    const detail = (() => {
      try {
        return (JSON.parse(body) as { message?: string }).message ?? "";
      } catch {
        return "";
      }
    })();
    const map: Record<number, [string, string, boolean]> = {
      400: ["bad_request", "The reconstruction service rejected the photos.", false],
      401: ["unauthorised", "The reconstruction service key is invalid.", false],
      402: ["payment_required", "The reconstruction account has no credits left.", false],
      404: ["not_found", "The reconstruction job no longer exists.", false],
      409: ["conflict", "The job can’t be changed while it is processing.", false],
      429: ["rate_limited", "The reconstruction service is busy. Try again shortly.", true],
    };
    const [code, message, retryable] = map[res.status] ?? [
      "provider_error",
      "The reconstruction service had a problem.",
      res.status >= 500,
    ];
    throw new ProviderError(
      { code, message: detail && res.status === 400 ? `${message} (${detail})` : message, retryable },
      res.status,
    );
  };

  return {
    id: "meshy",
    capabilities: {
      maxViews: 4,
      viewPriority: ["leftThreeQuarter", "rightThreeQuarter", "leftProfile", "rightProfile"],
      reportsProgress: true,
      cancelQueued: true, // DELETE refunds PENDING tasks
      cancelProcessing: false, // DELETE returns 409 while IN_PROGRESS
      deletesRemoteData: true,
    },

    async submit(input: ReconstructionInput) {
      const image_urls = input.views.slice(0, 4).map((v) => `data:${v.mime};base64,${v.data.toString("base64")}`);
      const res = await call(BASE, {
        method: "POST",
        body: JSON.stringify({
          image_urls, // first image = front view (meshy-7.1)
          ai_model: "meshy-7.1",
          should_texture: true,
          texture_resolution: "2k",
          should_remesh: true,
          topology: "triangle",
          target_polycount: 80000,
          target_formats: ["glb"],
          image_enhancement: true,
          moderation: true,
        }),
      });
      const json = (await res.json()) as { result?: string };
      if (!json.result)
        throw new ProviderError({
          code: "bad_response",
          message: "The reconstruction service returned no job id.",
          retryable: true,
        });
      return { providerJobId: json.result };
    },

    async status(id) {
      const res = await call(`${BASE}/${encodeURIComponent(id)}`);
      const task = (await res.json()) as {
        status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED";
        progress?: number;
        task_error?: { message?: string };
      };
      const map: Record<string, ProviderStatus["state"]> = {
        PENDING: "queued",
        IN_PROGRESS: "processing",
        SUCCEEDED: "succeeded",
        FAILED: "failed",
        CANCELED: "cancelled",
      };
      const state = map[task.status] ?? "processing";
      return {
        state,
        progress: typeof task.progress === "number" ? task.progress : null,
        error:
          state === "failed"
            ? {
                code: "reconstruction_failed",
                message: task.task_error?.message || "The reconstruction failed.",
                retryable: true,
              }
            : undefined,
      };
    },

    async fetchResult(id) {
      const res = await call(`${BASE}/${encodeURIComponent(id)}`);
      const task = (await res.json()) as { model_urls?: { glb?: string } };
      const url = task.model_urls?.glb;
      if (!url)
        throw new ProviderError({
          code: "no_model",
          message: "The reconstruction returned no GLB model.",
          retryable: false,
        });
      let file: Response;
      try {
        file = await fetchImpl(url, { signal: AbortSignal.timeout(120_000) });
      } catch {
        throw new ProviderError({
          code: "download_failed",
          message: "The model couldn’t be downloaded.",
          retryable: true,
        });
      }
      if (!file.ok)
        throw new ProviderError({
          code: "download_failed",
          message: "The model couldn’t be downloaded.",
          retryable: true,
        });
      const length = Number(file.headers.get("content-length") ?? 0);
      if (length > MAX_RESULT_BYTES)
        throw new ProviderError({ code: "too_large", message: "The returned model is too large.", retryable: false });
      return Buffer.from(await file.arrayBuffer());
    },

    async cancel(id) {
      await call(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
    },

    async deleteRemote(id) {
      await call(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };
}
