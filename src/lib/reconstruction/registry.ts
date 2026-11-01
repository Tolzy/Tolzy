import "server-only";

import { providerConfig } from "@/lib/server/config";
import { createFixtureProvider } from "./providers/fixture";
import { createMeshyProvider } from "./providers/meshy";
import type { ReconstructionProvider } from "./types";

let override: ReconstructionProvider | null = null;
/** Tests only: substitute a provider (e.g. a mock with scripted responses). */
export function setProviderForTests(p: ReconstructionProvider | null) {
  override = p;
}

/**
 * The provider for new jobs, or null when none is enabled. Jobs remember
 * their provider id, so an existing job always finishes on the provider
 * that started it (`providerById`).
 */
export function activeProvider(): ReconstructionProvider | null {
  if (override) return override;
  const cfg = providerConfig();
  if (!cfg?.enabled) return null;
  return providerById(cfg.id);
}

export function providerById(id: string): ReconstructionProvider | null {
  if (override && override.id === id) return override;
  if (id === "fixture" && providerConfig()?.id === "fixture") return createFixtureProvider();
  if (id === "meshy") {
    const key = process.env.RECONSTRUCTION_API_KEY;
    if (key && process.env.RECONSTRUCTION_PROVIDER_APPROVED === "1") return createMeshyProvider(key);
  }
  return null;
}
