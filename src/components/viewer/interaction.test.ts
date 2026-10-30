import { describe, expect, it } from "vitest";
import {
  InteractionController,
  MANUAL_PITCH_LIMIT,
  pointerToAngle,
  wrapDegrees,
  type MotionConfig,
} from "./interaction";

const CONFIG: MotionConfig = {
  tracking: true,
  yawLimit: 25,
  pitchLimit: 12,
  sensitivityX: 0.65,
  sensitivityY: 0.65,
  smoothness: 0.6,
  idleReturnMs: 600,
  dragEnabled: true,
  dragRelease: "return",
  touchSensitivity: 0.55,
  reducedMotion: false,
};

/** Drives a controller with a fake 60 fps clock. */
function rig(config: Partial<MotionConfig> = {}) {
  const c = new InteractionController({ ...CONFIG, ...config });
  let now = 0;
  let last = c.step(now, 0);
  const frames: number[] = [];
  return {
    c,
    get now() {
      return now;
    },
    run(ms: number, fps = 60) {
      const dt = 1000 / fps;
      const count = Math.round((ms * fps) / 1000);
      for (let i = 0; i < count; i++) {
        now += dt;
        last = c.step(now, dt / 1000);
        frames.push(last.yaw);
      }
      return last;
    },
    frames,
  };
}

describe("pointerToAngle", () => {
  it("is zero at the centre and symmetric", () => {
    expect(pointerToAngle(0, 25, 0.65)).toBe(0);
    expect(pointerToAngle(0.5, 25, 0.65)).toBeCloseTo(-pointerToAngle(-0.5, 25, 0.65));
  });

  it("never exceeds the limit", () => {
    for (const n of [-3, -1, -0.95, 0.95, 1, 3]) expect(Math.abs(pointerToAngle(n, 25, 1))).toBeLessThanOrEqual(25);
  });

  it("reaches more rotation for the same pointer travel at higher sensitivity", () => {
    expect(pointerToAngle(0.4, 25, 0.9)).toBeGreaterThan(pointerToAngle(0.4, 25, 0.3));
  });
});

describe("cursor tracking", () => {
  it.each([
    ["right", 1, 0, 1, 0],
    ["left", -1, 0, -1, 0],
    ["up", 0, 1, 0, 1],
    ["down", 0, -1, 0, -1],
    ["diagonal", 0.8, 0.8, 1, 1],
  ])("follows the pointer %s", (_, nx, ny, yawSign, pitchSign) => {
    const r = rig();
    r.c.pointerMove(nx, ny);
    const rot = r.run(1500);
    expect(Math.sign(Math.round(rot.yaw))).toBe(yawSign);
    expect(Math.sign(Math.round(rot.pitch))).toBe(pitchSign);
  });

  it("respects the configured limits", () => {
    const r = rig({ yawLimit: 10, pitchLimit: 5 });
    r.c.pointerMove(1, -1);
    const rot = r.run(2000);
    expect(rot.yaw).toBeCloseTo(10, 1);
    expect(rot.pitch).toBeCloseTo(-5, 1);
  });

  it("moves smoothly — no frame jumps more than a few degrees", () => {
    const r = rig();
    r.c.pointerMove(1, 0);
    r.run(1500);
    const steps = r.frames.slice(1).map((y, i) => Math.abs(y - r.frames[i]));
    expect(Math.max(...steps)).toBeLessThan(3);
  });

  it("returns to neutral only after the idle delay when the pointer leaves", () => {
    const r = rig();
    r.c.pointerMove(1, 1);
    r.run(1500);
    r.c.pointerLeave(r.now);
    expect(r.run(400).yaw).toBeGreaterThan(20); // still looking during the delay
    const rot = r.run(2000);
    expect(rot.yaw).toBeCloseTo(0, 1);
    expect(rot.pitch).toBeCloseTo(0, 1);
    expect(rot.settled).toBe(true);
  });

  it("ignores the pointer and returns to neutral when tracking is off", () => {
    const r = rig();
    r.c.pointerMove(1, 0);
    r.run(1500);
    r.c.setConfig({ ...CONFIG, tracking: false });
    r.c.pointerMove(-1, 0);
    expect(r.run(2000).yaw).toBeCloseTo(0, 1);
  });

  it("behaves the same at 8, 40, 60 and 120 fps", () => {
    const results = [8, 40, 60, 120].map((fps) => {
      const r = rig();
      r.c.pointerMove(0.6, 0);
      return r.run(250, fps).yaw; // 250 ms is a whole number of frames at every rate
    });
    expect(Math.max(...results) - Math.min(...results)).toBeLessThan(0.5);
  });
});

describe("manual rotation", () => {
  it("drags horizontally and vertically", () => {
    const r = rig({ tracking: false, dragRelease: "hold" });
    r.c.dragStart(1, 500, 400, 1000, 800, r.now);
    r.run(16);
    r.c.dragMove(1, 750, 300, r.now); // right and up
    r.run(500);
    r.c.dragEnd(1, r.now + 500); // long pause: no fling
    const rot = r.run(1500);
    expect(rot.yaw).toBeCloseTo(55, 0); // a quarter width = 55°
    expect(rot.pitch).toBeCloseTo(11.25, 0); // an eighth height = 11.25°
  });

  it("touch drags at the touch sensitivity; mouse and pen keep the full rate", () => {
    const drag = (pointerType: string, touchSensitivity = 0.55) => {
      const r = rig({ tracking: false, dragRelease: "hold", touchSensitivity });
      r.c.dragStart(1, 0, 400, 1000, 800, r.now, pointerType);
      r.c.dragMove(1, 400, 320, r.now); // 40 % of the width, 10 % of the height
      r.run(600);
      r.c.dragEnd(1, r.now + 500); // pause before release: no flick
      return r.run(1500);
    };
    const mouse = drag("mouse");
    expect(mouse.yaw).toBeCloseTo(88, 0); // unchanged: 0.4 × 220°
    expect(mouse.pitch).toBeCloseTo(9, 0);
    expect(drag("pen").yaw).toBeCloseTo(88, 0);
    const touch = drag("touch");
    expect(touch.yaw).toBeCloseTo(88 * 0.55, 0); // ≈ 48°: 45 % gentler
    expect(touch.pitch).toBeCloseTo(9 * 0.55, 0);
    expect(drag("touch", 1).yaw).toBeCloseTo(88, 0); // configurable
  });

  it("clamps manual pitch so the head never flips", () => {
    const r = rig({ tracking: false, dragRelease: "hold" });
    r.c.dragStart(1, 0, 0, 1000, 800, r.now);
    r.c.dragMove(1, 0, -5000, r.now);
    r.run(1500);
    r.c.dragEnd(1, r.now + 500);
    expect(r.run(1000).pitch).toBeCloseTo(MANUAL_PITCH_LIMIT, 1);
  });

  it("starting a drag never jumps, and tracking resumes smoothly afterwards", () => {
    const r = rig();
    r.c.pointerMove(1, 0);
    const before = r.run(1500).yaw;
    r.c.dragStart(1, 500, 400, 1000, 800, r.now);
    // Pointer moves while dragging must not move the tracking offset.
    r.c.pointerMove(-1, 0);
    const during = r.run(200);
    expect(Math.abs(during.yaw - before)).toBeLessThan(0.5);
    expect(during.trackYaw).toBeCloseTo(before, 0);

    r.c.dragEnd(1, r.now);
    r.c.pointerMove(-1, 0);
    r.run(1500);
    // A full swing from one side to the other: peak speed is a few degrees per
    // frame; a snap would be a jump of tens of degrees in a single frame.
    const steps = r.frames.slice(1).map((y, i) => Math.abs(y - r.frames[i]));
    expect(Math.max(...steps)).toBeLessThan(5);
  });

  it("combines both offsets instead of overwriting one with the other", () => {
    const r = rig({ dragRelease: "hold" });
    r.c.pointerMove(1, 0);
    r.run(1500);
    r.c.dragStart(1, 0, 0, 1000, 800, r.now);
    r.c.dragMove(1, 200, 0, r.now);
    r.run(300);
    r.c.dragEnd(1, r.now + 500);
    r.c.pointerMove(1, 0);
    const rot = r.run(1500);
    expect(rot.manualYaw).toBeCloseTo(44, 0);
    expect(rot.trackYaw).toBeGreaterThan(20);
    expect(rot.yaw).toBeCloseTo(rot.manualYaw + rot.trackYaw, 5);
  });

  it("returns after the idle delay in 'return' mode and holds in 'hold' mode", () => {
    for (const mode of ["return", "hold"] as const) {
      const r = rig({ tracking: false, dragRelease: mode });
      r.c.dragStart(1, 0, 0, 1000, 800, r.now);
      r.c.dragMove(1, 300, 0, r.now);
      r.run(300);
      r.c.dragEnd(1, r.now + 500);
      expect(r.run(300).yaw).toBeGreaterThan(50);
      const end = r.run(2500).yaw;
      if (mode === "return") expect(end).toBeCloseTo(0, 1);
      else expect(end).toBeCloseTo(66, 0);
    }
  });

  it("carries a flick after release, but not when cancelled", () => {
    const flick = (cancelled: boolean) => {
      const r = rig({ tracking: false, dragRelease: "hold" });
      r.c.dragStart(1, 0, 0, 1000, 800, r.now);
      for (let i = 1; i <= 5; i++) {
        r.run(16);
        r.c.dragMove(1, i * 40, 0, r.now);
      }
      r.c.dragEnd(1, r.now, cancelled);
      return r.run(1500).yaw;
    };
    expect(flick(false)).toBeGreaterThan(flick(true) + 5);
  });

  it("is ignored when manual rotation is disabled", () => {
    const r = rig({ dragEnabled: false });
    expect(r.c.dragStart(1, 0, 0, 1000, 800, r.now)).toBe(false);
    r.c.dragMove(1, 500, 0, r.now);
    expect(r.run(500).manualYaw).toBe(0);
  });

  it("returns the short way round after spinning past a full turn", () => {
    const r = rig({ tracking: false, dragRelease: "return" });
    r.c.dragStart(1, 0, 0, 1000, 800, r.now);
    r.c.dragMove(1, 1800, 0, r.now); // ≈ 396°
    r.run(500);
    r.c.dragEnd(1, r.now + 500);
    const after = r.run(16);
    expect(Math.abs(after.manualYaw)).toBeLessThanOrEqual(180);
    expect(r.run(3000).yaw).toBeCloseTo(0, 1);
  });
});

describe("reset and reduced motion", () => {
  it("reset smoothly returns everything to neutral", () => {
    const r = rig({ dragRelease: "hold" });
    r.c.pointerMove(1, 1);
    r.c.dragStart(1, 0, 0, 1000, 800, r.now);
    r.c.dragMove(1, 300, 0, r.now);
    r.run(500);
    r.c.dragEnd(1, r.now + 500);
    r.c.reset();
    const first = r.run(16).yaw;
    expect(first).toBeGreaterThan(30); // eases, does not snap
    const rot = r.run(3000);
    expect(rot.yaw).toBeCloseTo(0, 1);
    expect(rot.pitch).toBeCloseTo(0, 1);
  });

  it("reduced motion: no overshoot and no flick", () => {
    const r = rig({ reducedMotion: true, tracking: false, dragRelease: "hold" });
    r.c.nudge(30, 0);
    r.run(2000);
    expect(Math.max(...r.frames)).toBeLessThanOrEqual(30.01);

    const f = rig({ reducedMotion: true, tracking: false, dragRelease: "hold" });
    f.c.dragStart(1, 0, 0, 1000, 800, f.now);
    for (let i = 1; i <= 5; i++) {
      f.run(16);
      f.c.dragMove(1, i * 40, 0, f.now);
    }
    f.c.dragEnd(1, f.now);
    expect(f.run(1500).yaw).toBeCloseTo(44, 0); // exactly the dragged distance
  });

  it("keyboard nudges are held even in 'return' mode", () => {
    const r = rig({ tracking: false, dragRelease: "return" });
    r.c.nudge(20, 5);
    const rot = r.run(3000);
    expect(rot.yaw).toBeCloseTo(20, 1);
    expect(rot.pitch).toBeCloseTo(5, 1);
  });

  it("wrapDegrees keeps angles within one turn", () => {
    expect(wrapDegrees(190)).toBe(-170);
    expect(wrapDegrees(-190)).toBe(170);
    expect(wrapDegrees(720)).toBe(0);
  });
});
