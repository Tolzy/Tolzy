/**
 * Provider-independent reconstruction types (docs/architecture.md §6).
 * The app talks only to these; each provider is an adapter.
 */

import type { SlotId } from "@/lib/photos/types";

export interface ReconstructionView {
  slot: SlotId;
  /** Prepared image (re-encoded JPEG, metadata removed). */
  data: Buffer;
  mime: "image/jpeg";
}

export interface ReconstructionInput {
  /** Front view first; extra views in the provider's preferred order. */
  views: ReconstructionView[];
  /** Fixture provider only: development/test scenario. */
  scenario?: string | null;
  /** Attempt number (1-based) — lets the fixture simulate a first failure. */
  attempt: number;
}

export type ProviderState = "queued" | "processing" | "succeeded" | "failed" | "cancelled";

export interface ProviderStatus {
  state: ProviderState;
  /** 0–100 when the provider reports progress, otherwise null (never invented). */
  progress: number | null;
  error?: ProviderErrorInfo;
}

export interface ProviderErrorInfo {
  code: string;
  message: string;
  /** Whether trying again may succeed (rate limits, timeouts, provider outages). */
  retryable: boolean;
}

export class ProviderError extends Error {
  constructor(
    public info: ProviderErrorInfo,
    public httpStatus?: number,
  ) {
    super(info.message);
  }
}

export interface ProviderCapabilities {
  /** Most views accepted in one request (front included). */
  maxViews: number;
  /** Which extra slots the provider can use, in priority order. */
  viewPriority: SlotId[];
  /** Progress percentages are real provider data. */
  reportsProgress: boolean;
  /** Cancellation possible while queued / while processing. */
  cancelQueued: boolean;
  cancelProcessing: boolean;
  /** Remote copies can be deleted after download (privacy). */
  deletesRemoteData: boolean;
}

export interface ReconstructionProvider {
  id: string;
  capabilities: ProviderCapabilities;
  submit(input: ReconstructionInput): Promise<{ providerJobId: string }>;
  status(providerJobId: string): Promise<ProviderStatus>;
  /** Raw GLB bytes of a succeeded job. */
  fetchResult(providerJobId: string): Promise<Buffer>;
  cancel?(providerJobId: string): Promise<void>;
  deleteRemote?(providerJobId: string): Promise<void>;
}
