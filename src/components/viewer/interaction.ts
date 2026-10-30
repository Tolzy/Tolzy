/**
 * Head interaction model: cursor tracking + manual rotation.
 *
 * The final rotation is the SUM of two independent offsets, each driven by
 * its own damped spring, so the interactions never overwrite each other:
 *
 *   rotation = track (where the pointer is) + manual (what the user dragged)
 *
 * - While dragging, the tracking target is frozen where it is, so starting a
 *   drag never jumps; when the drag ends, tracking resumes from there.
 * - Springs (rather than plain easing) give the head a little inertia: it
 *   accelerates, settles and can carry a flick after release.
 *
 * Pure TypeScript — no three.js — so it can be unit tested with a fake clock.
 * Angles are degrees; yaw > 0 turns the face towards screen-right, pitch > 0
 * looks up.
 */

export type DragRelease = "return" | "hold";

export interface MotionConfig {
  tracking: boolean;
  /** Maximum tracking rotation, ± degrees. */
  yawLimit: number;
  pitchLimit: number;
  /** 0–1: how little pointer travel is needed to reach the limit. */
  sensitivityX: number;
  sensitivityY: number;
  /** 0–1: higher = softer, slower, more inertia. */
  smoothness: number;
  /** Delay before returning to neutral after the pointer leaves or a drag ends. */
  idleReturnMs: number;
  dragEnabled: boolean;
  dragRelease: DragRelease;
  /** Operating-system reduced-motion preference. */
  reducedMotion: boolean;
}

export interface Rotation {
  yaw: number;
  pitch: number;
  trackYaw: number;
  trackPitch: number;
  manualYaw: number;
  manualPitch: number;
  /** True when nothing is moving and no timer is pending (rendering can stop). */
  settled: boolean;
}

/** Manual pitch stays within this range so the head never flips over. */
export const MANUAL_PITCH_LIMIT = 30;
/** Degrees of rotation for dragging across the full viewport width / height. */
const DRAG_YAW_PER_WIDTH = 220;
const DRAG_PITCH_PER_HEIGHT = 90;
/** How far a release flick carries, as seconds of release velocity. */
const FLING_SECONDS = 0.14;
const MAX_FLING_DEG = 45;
const EPSILON = 0.01; // degrees

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Wraps an angle to (−180, 180]. */
export function wrapDegrees(deg: number): number {
  const w = ((((deg + 180) % 360) + 360) % 360) - 180;
  return w === -180 ? 180 : w;
}

/**
 * Maps a normalised pointer coordinate (−1…1) to a rotation within ±limit.
 * Sensitivity sets how much of the half-viewport is needed to reach the limit
 * (65 % → ~95 %); a soft curve eases in near the limit instead of hitting a wall.
 */
export function pointerToAngle(n: number, limit: number, sensitivity: number): number {
  const reach = 1.6 - clamp(sensitivity, 0, 1); // 0.6 … 1.6 of the half-viewport
  const v = n / reach;
  const k = 1.4;
  const soft = Math.tanh(k * v) / Math.tanh(k);
  return limit * clamp(soft, -1, 1);
}

/** Spring frequency (rad/s) from the smoothness setting. */
export function springOmega(smoothness: number, reducedMotion: boolean): number {
  const omega = 15 - 10 * clamp(smoothness, 0, 1); // 15 (snappy) … 5 (soft)
  return reducedMotion ? omega * 1.6 : omega;
}

class Spring {
  x = 0;
  v = 0;
  target = 0;

  step(dt: number, omega: number, zeta: number) {
    // Semi-implicit Euler with small sub-steps: stable at any frame rate.
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = omega * omega * (this.target - this.x) - 2 * zeta * omega * this.v;
      this.v += a * h;
      this.x += this.v * h;
    }
  }

  get resting() {
    return Math.abs(this.target - this.x) < EPSILON && Math.abs(this.v) < EPSILON;
  }

  snap() {
    this.x = this.target;
    this.v = 0;
  }
}

interface DragState {
  id: number;
  startX: number;
  startY: number;
  startYaw: number;
  startPitch: number;
  width: number;
  height: number;
  samples: { t: number; yaw: number; pitch: number }[];
}

export class InteractionController {
  private trackYaw = new Spring();
  private trackPitch = new Spring();
  private manualYaw = new Spring();
  private manualPitch = new Spring();
  private drag: DragState | null = null;
  private leftAt: number | null = null;
  private releasedAt: number | null = null;
  private config: MotionConfig;

  /** Called whenever input arrives, so a paused render loop can wake up. */
  private onWake: () => void = () => {};

  constructor(config: MotionConfig) {
    this.config = { ...config };
  }

  /** Registers the callback that restarts rendering when input arrives. */
  setWake(fn: (() => void) | null) {
    this.onWake = fn ?? (() => {});
  }

  setConfig(config: MotionConfig) {
    this.config = { ...config };
    if (!config.dragEnabled && this.drag) this.drag = null;
    this.onWake();
  }

  get dragging() {
    return this.drag !== null;
  }

  /* ───────── cursor tracking ───────── */

  /** Pointer position in normalised viewport coordinates (x right, y up, −1…1). */
  pointerMove(nx: number, ny: number) {
    this.leftAt = null;
    if (this.drag || !this.config.tracking) return; // tracking is frozen while dragging
    this.trackYaw.target = pointerToAngle(nx, this.config.yawLimit, this.config.sensitivityX);
    this.trackPitch.target = pointerToAngle(ny, this.config.pitchLimit, this.config.sensitivityY);
    this.onWake();
  }

  /** The pointer left the viewport: return to neutral after the idle delay. */
  pointerLeave(now: number) {
    if (this.drag) return;
    this.leftAt = now;
    this.onWake();
  }

  /* ───────── manual rotation ───────── */

  /** Returns false when dragging is disabled. Coordinates are client pixels. */
  dragStart(id: number, x: number, y: number, width: number, height: number, now: number): boolean {
    if (!this.config.dragEnabled || this.drag) return false;
    this.leftAt = null;
    this.releasedAt = null;
    // Continue from where the head currently is, not where it was heading.
    this.manualYaw.target = this.manualYaw.x;
    this.manualPitch.target = this.manualPitch.x;
    this.drag = {
      id,
      startX: x,
      startY: y,
      startYaw: this.manualYaw.x,
      startPitch: this.manualPitch.x,
      width: Math.max(width, 1),
      height: Math.max(height, 1),
      samples: [{ t: now, yaw: this.manualYaw.x, pitch: this.manualPitch.x }],
    };
    this.onWake();
    return true;
  }

  dragMove(id: number, x: number, y: number, now: number) {
    const d = this.drag;
    if (!d || d.id !== id) return;
    const yaw = d.startYaw + ((x - d.startX) / d.width) * DRAG_YAW_PER_WIDTH;
    const pitch = clamp(
      d.startPitch - ((y - d.startY) / d.height) * DRAG_PITCH_PER_HEIGHT,
      -MANUAL_PITCH_LIMIT,
      MANUAL_PITCH_LIMIT,
    );
    this.manualYaw.target = yaw;
    this.manualPitch.target = pitch;
    d.samples.push({ t: now, yaw, pitch });
    while (d.samples.length > 2 && now - d.samples[0].t > 100) d.samples.shift();
    this.onWake();
  }

  /** Ends a drag. A cancelled drag (pointercancel, lost capture) never flings. */
  dragEnd(id: number, now: number, cancelled = false) {
    const d = this.drag;
    if (!d || d.id !== id) return;
    this.drag = null;

    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const dt = (last.t - first.t) / 1000;
    const recent = now - last.t < 60;
    if (!cancelled && !this.config.reducedMotion && recent && dt > 0.01) {
      const vy = (last.yaw - first.yaw) / dt;
      const vp = (last.pitch - first.pitch) / dt;
      this.manualYaw.target += clamp(vy * FLING_SECONDS, -MAX_FLING_DEG, MAX_FLING_DEG);
      this.manualPitch.target = clamp(
        this.manualPitch.target + clamp(vp * FLING_SECONDS, -MAX_FLING_DEG, MAX_FLING_DEG),
        -MANUAL_PITCH_LIMIT,
        MANUAL_PITCH_LIMIT,
      );
    }
    // Keep yaw within one turn so a later return takes the short way round.
    const wrapped = wrapDegrees(this.manualYaw.target);
    const shift = wrapped - this.manualYaw.target;
    this.manualYaw.target += shift;
    this.manualYaw.x += shift;

    this.releasedAt = now;
    this.onWake();
  }

  /**
   * Keyboard rotation: nudges the manual offset. Unlike a drag it is held
   * (no automatic return), so keyboard users can inspect the head at their own
   * pace; Reset view brings it back.
   */
  nudge(dYaw: number, dPitch: number) {
    if (!this.config.dragEnabled) return;
    this.manualYaw.target = wrapDegrees(this.manualYaw.target + dYaw);
    this.manualPitch.target = clamp(this.manualPitch.target + dPitch, -MANUAL_PITCH_LIMIT, MANUAL_PITCH_LIMIT);
    this.releasedAt = null;
    this.onWake();
  }

  /** Smoothly returns both offsets to neutral. */
  reset() {
    this.drag = null;
    this.leftAt = null;
    this.releasedAt = null;
    this.trackYaw.target = this.trackPitch.target = 0;
    this.manualYaw.target = wrapDegrees(this.manualYaw.target);
    this.manualYaw.x = wrapDegrees(this.manualYaw.x);
    this.manualYaw.target = this.manualPitch.target = 0;
    this.onWake();
  }

  /* ───────── simulation ───────── */

  step(now: number, dtSeconds: number): Rotation {
    const c = this.config;
    // Real elapsed time keeps the motion speed independent of frame rate (slow
    // devices included); the cap only guards against long pauses such as a
    // background tab. Springs sub-step internally, so large steps stay stable.
    const dt = clamp(dtSeconds, 0, 0.25);

    if (!c.tracking) {
      this.trackYaw.target = this.trackPitch.target = 0;
    } else if (this.leftAt !== null && now - this.leftAt >= c.idleReturnMs) {
      this.trackYaw.target = this.trackPitch.target = 0;
      this.leftAt = null;
    }
    if (
      this.releasedAt !== null &&
      !this.drag &&
      c.dragRelease === "return" &&
      now - this.releasedAt >= c.idleReturnMs
    ) {
      this.manualYaw.target = this.manualPitch.target = 0;
      this.releasedAt = null;
    }
    if (c.dragRelease === "hold" && this.releasedAt !== null && !this.drag) this.releasedAt = null;

    const omega = springOmega(c.smoothness, c.reducedMotion);
    const zeta = c.reducedMotion ? 1 : 0.82; // slightly under-damped: a hint of life
    this.trackYaw.step(dt, omega, zeta);
    this.trackPitch.step(dt, omega, zeta);
    // While dragging, follow the pointer closely; afterwards use the shared feel.
    const manualOmega = this.drag ? Math.max(omega * 2.2, 18) : omega;
    const manualZeta = this.drag ? 1 : zeta;
    this.manualYaw.step(dt, manualOmega, manualZeta);
    this.manualPitch.step(dt, manualOmega, manualZeta);

    const springsResting = [this.trackYaw, this.trackPitch, this.manualYaw, this.manualPitch].every((s) => s.resting);
    if (springsResting) for (const s of [this.trackYaw, this.trackPitch, this.manualYaw, this.manualPitch]) s.snap();
    const timersPending = this.leftAt !== null || this.releasedAt !== null;

    return {
      yaw: this.trackYaw.x + this.manualYaw.x,
      pitch: this.trackPitch.x + this.manualPitch.x,
      trackYaw: this.trackYaw.x,
      trackPitch: this.trackPitch.x,
      manualYaw: this.manualYaw.x,
      manualPitch: this.manualPitch.x,
      settled: springsResting && !timersPending && !this.drag,
    };
  }
}
