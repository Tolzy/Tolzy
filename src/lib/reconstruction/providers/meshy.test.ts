// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "../types";
import { createMeshyProvider } from "./meshy";

/** A fetch mock that records requests and returns scripted responses (no network). */
function mockFetch(responses: (Response | Error)[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) throw new Error("unexpected request");
    if (next instanceof Error) throw next;
    return next;
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const view = (slot: "front" | "leftThreeQuarter") => ({
  slot,
  data: Buffer.from(`jpeg-${slot}`),
  mime: "image/jpeg" as const,
});

describe("Meshy adapter (documented API, mocked network)", () => {
  it("submits front-first data URIs with the key in the Authorization header only", async () => {
    const m = mockFetch([json({ result: "task-123" })]);
    const p = createMeshyProvider("sk-test", m.fetch);
    const { providerJobId } = await p.submit({ views: [view("front"), view("leftThreeQuarter")], attempt: 1 });
    expect(providerJobId).toBe("task-123");
    const { url, init } = m.calls[0];
    expect(url).toBe("https://api.meshy.ai/openapi/v1/multi-image-to-3d");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(String(init?.body));
    expect(body.image_urls).toHaveLength(2);
    expect(body.image_urls[0]).toBe(`data:image/jpeg;base64,${Buffer.from("jpeg-front").toString("base64")}`);
    expect(body).toMatchObject({ ai_model: "meshy-7.1", should_texture: true, target_formats: ["glb"] });
    expect(String(init?.body)).not.toContain("sk-test");
  });

  it("maps task statuses and real progress", async () => {
    const m = mockFetch([
      json({ status: "PENDING", progress: 0 }),
      json({ status: "IN_PROGRESS", progress: 42 }),
      json({ status: "FAILED", progress: 0, task_error: { message: "Bad input" } }),
      json({ status: "CANCELED" }),
      json({ status: "SUCCEEDED", progress: 100 }),
    ]);
    const p = createMeshyProvider("k", m.fetch);
    expect(await p.status("t")).toEqual({ state: "queued", progress: 0, error: undefined });
    expect(await p.status("t")).toMatchObject({ state: "processing", progress: 42 });
    expect(await p.status("t")).toMatchObject({ state: "failed", error: { message: "Bad input" } });
    expect((await p.status("t")).state).toBe("cancelled");
    expect((await p.status("t")).state).toBe("succeeded");
  });

  it.each([
    [401, "unauthorised", false],
    [402, "payment_required", false],
    [429, "rate_limited", true],
    [503, "provider_error", true],
  ])("HTTP %i → %s (retryable %s)", async (status, code, retryable) => {
    const m = mockFetch([json({ message: "x" }, status)]);
    const err = await createMeshyProvider("k", m.fetch)
      .status("t")
      .catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.info).toMatchObject({ code, retryable });
  });

  it("downloads the GLB from model_urls.glb", async () => {
    const m = mockFetch([
      json({ status: "SUCCEEDED", model_urls: { glb: "https://assets.meshy.ai/x.glb" } }),
      new Response(Buffer.from("glTF.....")),
    ]);
    const data = await createMeshyProvider("k", m.fetch).fetchResult("t");
    expect(data.subarray(0, 4).toString()).toBe("glTF");
    expect(m.calls[1].url).toBe("https://assets.meshy.ai/x.glb");
  });

  it("treats network failures as retryable", async () => {
    const m = mockFetch([new TypeError("fetch failed")]);
    const err = await createMeshyProvider("k", m.fetch)
      .status("t")
      .catch((e) => e);
    expect(err.info).toMatchObject({ code: "network", retryable: true });
  });

  it("can cancel only queued tasks and deletes remote data after download", () => {
    const p = createMeshyProvider("k", mockFetch([]).fetch);
    expect(p.capabilities).toMatchObject({
      cancelQueued: true,
      cancelProcessing: false,
      deletesRemoteData: true,
      maxViews: 4,
    });
  });
});
