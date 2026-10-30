import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/studio/settings";
import { useStudioStore, ZOOM_MAX, ZOOM_MIN } from "./studio-store";

const store = () => useStudioStore.getState();
const setRoughness = (roughness: number) => (s: typeof DEFAULT_SETTINGS) => ({
  ...s,
  material: { ...s.material, roughness },
});

describe("studio store", () => {
  beforeEach(() => store().reset());

  it("records discrete changes and undoes/redoes them", () => {
    store().apply((s) => ({ ...s, material: { ...s.material, preset: "chrome" } }));
    expect(store().settings.material.preset).toBe("chrome");

    store().undo();
    expect(store().settings.material.preset).toBe("original");

    store().redo();
    expect(store().settings.material.preset).toBe("chrome");
  });

  it("groups a continuous change into a single undo step", () => {
    store().preview(setRoughness(0.2));
    store().preview(setRoughness(0.3));
    store().preview(setRoughness(0.4));
    store().commit();

    expect(store().past).toHaveLength(1);
    store().undo();
    expect(store().settings.material.roughness).toBe(DEFAULT_SETTINGS.material.roughness);
  });

  it("undo during an uncommitted drag restores the pre-drag value", () => {
    store().preview(setRoughness(0.9));
    store().undo();
    expect(store().settings.material.roughness).toBe(DEFAULT_SETTINGS.material.roughness);
  });

  it("clears redo history after a new change", () => {
    store().apply(setRoughness(0.1));
    store().undo();
    store().apply(setRoughness(0.2));
    expect(store().future).toHaveLength(0);
  });

  it("ignores no-op updates", () => {
    store().apply((s) => s);
    expect(store().past).toHaveLength(0);
  });

  it("clamps zoom to the allowed range", () => {
    store().setZoom(1000);
    expect(store().zoom).toBe(ZOOM_MAX);
    store().setZoom(-5);
    expect(store().zoom).toBe(ZOOM_MIN);
  });

  it("opens the inspector when switching context", () => {
    store().toggleInspector();
    expect(store().inspectorOpen).toBe(false);
    store().setContext("light");
    expect(store().inspectorOpen).toBe(true);
    expect(store().context).toBe("light");
  });
});
