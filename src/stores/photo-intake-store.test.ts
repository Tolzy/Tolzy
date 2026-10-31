import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PhotoResult } from "@/lib/photos/types";
import { readiness, usePhotoIntake } from "./photo-intake-store";

const ok: PhotoResult = { checks: [], info: null, status: "pass", faceChecksRan: true };
const bad: PhotoResult = { checks: [], info: null, status: "fail", faceChecksRan: true };
const warn: PhotoResult = { checks: [], info: null, status: "warn", faceChecksRan: true };
const file = (name = "a.jpg") => new File(["x"], name, { type: "image/jpeg" });

beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => "blob:test");
  globalThis.URL.revokeObjectURL = vi.fn();
  usePhotoIntake.getState().reset();
});

describe("readiness", () => {
  it("requires a front photo that passed, and consent", async () => {
    expect(readiness(usePhotoIntake.getState()).blockers).toEqual([
      "Add a front-facing photo.",
      "Confirm you have permission to use this photo.",
    ]);
    await usePhotoIntake.getState().select("front", file(), async () => warn);
    usePhotoIntake.getState().setConsent(true);
    expect(readiness(usePhotoIntake.getState())).toEqual({ ready: true, blockers: [] });
  });

  it("blocks on a failed front photo or a failed optional angle", async () => {
    const s = usePhotoIntake.getState();
    s.setConsent(true);
    await s.select("front", file(), async () => bad);
    expect(readiness(usePhotoIntake.getState()).ready).toBe(false);
    await s.select("front", file(), async () => ok);
    await s.select("leftProfile", file(), async () => bad);
    expect(readiness(usePhotoIntake.getState()).blockers).toEqual(["Replace or remove the left profile photo."]);
    s.remove("leftProfile");
    expect(readiness(usePhotoIntake.getState()).ready).toBe(true);
  });

  it("ignores a late result for a replaced photo and frees preview URLs", async () => {
    const s = usePhotoIntake.getState();
    let finishFirst!: (r: PhotoResult) => void;
    const first = s.select("front", file("old.jpg"), () => new Promise((r) => (finishFirst = r)));
    await s.select("front", file("new.jpg"), async () => ok);
    finishFirst(bad);
    await first;
    const front = usePhotoIntake.getState().slots.front!;
    expect(front.file.name).toBe("new.jpg");
    expect(front.result).toBe(ok);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("keeps optional angles independent", async () => {
    const s = usePhotoIntake.getState();
    await s.select("leftThreeQuarter", file("l.jpg"), async () => ok);
    await s.select("rightProfile", file("r.jpg"), async () => warn);
    s.remove("leftThreeQuarter");
    const slots = usePhotoIntake.getState().slots;
    expect(slots.leftThreeQuarter).toBeUndefined();
    expect(slots.rightProfile?.file.name).toBe("r.jpg");
  });
});
