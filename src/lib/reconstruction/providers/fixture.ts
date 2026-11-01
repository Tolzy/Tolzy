import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ProviderError, type ProviderStatus, type ReconstructionProvider } from "../types";

/**
 * Development and test fixture — NOT a reconstruction. It goes through the
 * real job lifecycle (submit → queued → processing with progress → result)
 * on a timer and returns a bundled model, so the whole pipeline, the
 * generation screen and the Studio can be exercised without an external
 * provider or any spending. Refused on hosted deployments (config.ts).
 *
 * Scenarios (chosen when the job is created, tests only):
 *   default      sample head (separate hair, eyes; glTF Y-up, metres)
 *   fused        one fused skin mesh, Z-up, centimetres (provider-like)
 *   fail-once    first attempt fails (retryable), retry succeeds
 *   fail         every attempt fails
 *   invalid-glb  "succeeds" but returns a corrupt file
 *   slow         takes much longer (to test cancelling)
 */
const SCENARIOS = new Set(["default", "fused", "fail-once", "fail", "invalid-glb", "slow"]);

const duration = () => Number(process.env.FIXTURE_DURATION_MS || 9000);

function parse(id: string) {
  const [, scenario, attempt, started] = id.split(".");
  return { scenario, attempt: Number(attempt), started: Number(started) };
}

export function createFixtureProvider(): ReconstructionProvider {
  return {
    id: "fixture",
    capabilities: {
      maxViews: 5,
      viewPriority: ["leftThreeQuarter", "rightThreeQuarter", "leftProfile", "rightProfile"],
      reportsProgress: true,
      cancelQueued: true,
      cancelProcessing: true,
      deletesRemoteData: false,
    },

    async submit(input) {
      if (!input.views.length || input.views[0].slot !== "front")
        throw new ProviderError({ code: "bad_request", message: "A front photo is required.", retryable: false });
      const scenario = input.scenario && SCENARIOS.has(input.scenario) ? input.scenario : "default";
      return { providerJobId: `fx.${scenario}.${input.attempt}.${Date.now()}` };
    },

    async status(id): Promise<ProviderStatus> {
      const { scenario, attempt, started } = parse(id);
      const total = duration() * (scenario === "slow" ? 8 : 1);
      const t = (Date.now() - started) / total;
      if (t < 0.12) return { state: "queued", progress: null };
      const failNow = (scenario === "fail" || (scenario === "fail-once" && attempt === 1)) && t > 0.5;
      if (failNow)
        return {
          state: "failed",
          progress: null,
          error: {
            code: "reconstruction_failed",
            message: "The reconstruction failed (simulated by the development fixture).",
            retryable: true,
          },
        };
      if (t < 1) return { state: "processing", progress: Math.round(((t - 0.12) / 0.88) * 100) };
      return { state: "succeeded", progress: 100 };
    },

    async fetchResult(id) {
      const { scenario } = parse(id);
      if (scenario === "invalid-glb") return Buffer.from("This is not a GLB file.");
      const file =
        scenario === "fused"
          ? join(process.cwd(), "fixtures/reconstruction/fused-zup-cm.glb")
          : join(process.cwd(), "public/models/sample-head/sample-head.glb");
      return readFile(file);
    },

    async cancel() {
      // Nothing to stop remotely: the job simply stops being polled.
    },
  };
}
