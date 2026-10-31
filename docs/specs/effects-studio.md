# Spec — Effects Studio

Milestone: **M8** (with eye effects). Status: planned, not implemented.
Depends on: colour picker (M4), Model Descriptor + anchors (M7),
MaterialSystem shader hook (M8, small extension of M4 code).

## 1. Goal

A separate **Effects** workspace for real-time, GPU-based effects around the
portrait — procedural smoke, particles, atmospheric fog, glow and light
trails — each with appear / disappear / reveal / loop / burst transitions.
Effects are reusable presets that work on any portrait (sample or generated).

## 2. Workspace

- Studio top bar gains a workspace switch: **Design** (today's inspector:
  Model, Material, Light, Scene, Motion, Export) · **Effects**.
- Route: `/studio/[portraitId]` (Design) and `/studio/[portraitId]/effects`
  (Effects). The viewer moves into the shared studio **layout**, so switching
  workspace never reloads the model or loses the pose.
- Effects inspector:
  - **Layers** list — effect instances (add from a library, duplicate,
    reorder, show/hide, delete). "Eyes" is a fixed layer at the top.
  - **Properties** of the selected layer.
  - **Timeline strip** under the viewport: play/pause, scrub, loop region,
    each layer's in/out transitions as handles.
- Library: curated starting points (e.g. "Smoke rising", "Ember sparks",
  "Low fog", "Halo", "Orbit trail").

## 3. Runtime architecture (decision — ADR 0006 §5)

```
components/viewer/effects/
  effects-layer.tsx        mounts enabled instances in render order
  runtime.ts               EffectModule interface, registry, shared services
  scheduler.ts             decides when frames are needed (see §6)
  depth-prepass.ts         low-res depth of the model, shared by effects
  timeline.ts              pure: presence(t), emission(t) from transitions
  modules/smoke.ts · particles.ts · fog.ts · glow.ts · trails.ts
lib/studio/effects.ts      pure data: types, defaults, ranges, library presets
```

```ts
interface EffectModule<P> {
  type: EffectType;
  create(ctx: EffectContext, params: P): EffectInstance<P>;
}
interface EffectInstance<P> {
  object: Object3D; // added to the effects group
  update(params: P): void; // parameter change: uniforms only, no reallocation
  tick(t: EffectTime): void; // per frame: time uniforms only
  animated(): boolean; // needs continuous frames right now?
  dispose(): void; // frees geometry, materials, render targets
}
interface EffectContext {
  descriptor: ModelDescriptor; // anchors (eyes, crown, chin, neckBase), visible bounds
  depth: DepthPrepass; // soft intersections with the head
  quality: "low" | "medium" | "high";
  pointer: PointerState; // for hover/proximity triggers
}
```

Rules: modules read only their params, the descriptor and shared services;
they never touch model materials (the one exception, "Reveal", goes through
the MaterialSystem's dissolve hook). Same caching/disposal discipline and GPU
counters as materials and lighting.

## 4. Effects

All simulation runs on the GPU. Default technique is **stateless analytic
particles**: each particle's position is a function of `(seed, age, params)`
evaluated in the vertex shader of an instanced quad, so there is no
per-frame CPU work, results are deterministic (scrubbable timeline), and
transitions are just time remapping. GPGPU (ping-pong float textures) is used
only where particles must react to state (e.g. cursor repulsion).

| Effect       | Technique                                                                                                                                                               | Main controls                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Smoke        | Soft billboard puffs (instanced), 3D noise (fbm) in the fragment shader, curl-noise drift, soft depth fade against the head. High tier: short ray-marched noise volume. | **colour, opacity, density, turbulence, speed, direction, spread, animation duration**; emitter anchor (base, crown, around) |
| Particles    | Instanced points/quads; sparks, embers, dust, bokeh; additive or alpha blend.                                                                                           | count, size, colour (gradient over life), lifetime, speed, gravity, spread, emitter shape                                    |
| Fog          | Layered noise volume slices (or one full-screen pass using the depth pre-pass); height falloff.                                                                         | colour, density, height, falloff, drift speed, noise scale                                                                   |
| Glow         | Rim/halo shell (fresnel on a slightly inflated copy of visible parts) and anchor halos; no full-screen bloom by default.                                                | colour, intensity, radius, falloff                                                                                           |
| Light trails | Ribbon geometry from a ring buffer of positions along a path (orbit, figure-eight, follow cursor), fading by age; additive.                                             | colour, width, length, speed, path, count                                                                                    |

Smoke control mapping: colour → uniform; opacity → alpha scale; density →
particle count × alpha accumulation; turbulence → noise amplitude/frequency;
speed → time scale; direction → emitter velocity (angle + elevation); spread
→ emission cone; animation duration → particle lifetime and timeline length.

## 5. Transitions

A pure timeline function per layer returns `presence ∈ [0,1]` and an emission
multiplier for time `t`:

| Transition | Meaning                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Appear     | presence 0 → 1 over duration (fade + emission ramp).                                                                                                                                 |
| Disappear  | presence 1 → 0; emission stops first, existing particles live out their lifetime.                                                                                                    |
| Reveal     | Effect covers the portrait, then clears while the model dissolves in (dissolve mask uniform injected into model materials via the MaterialSystem hook, driven by the same timeline). |
| Loop       | Seamless repeat of the layer's duration (lifetime-aligned seeds).                                                                                                                    |
| Burst      | One-shot emission spike at t₀ (all seeds born within a short window), then decay.                                                                                                    |

Each layer: `{ in, out, loop, duration, delay, easing, trigger }` with
triggers **on load · on hover · cursor proximity · on click · manual**
(shared with eye effects).

## 6. Performance and rendering loop

- Today the viewer renders on demand. The scheduler requests frames only
  while some instance reports `animated()`, the viewport is on screen
  (IntersectionObserver) and the tab is visible. Static effects cost nothing
  when idle.
- **Quality tiers** chosen from device signals (GPU tier heuristics,
  `devicePixelRatio`, mobile) and overridable: particle caps (e.g. 2k / 8k /
  20k), half-resolution depth pre-pass, ray-marched smoke only on high.
- Budget: ≥ 45 fps on a mid-range phone with one smoke + one particle layer
  (low tier); ≥ 60 fps desktop with four layers (high tier).
- Reduced motion: effects show a still frame (timeline at a representative
  time) or are off by default; transitions become fades.
- Blending: premultiplied alpha so effects composite correctly over the CSS
  background and in transparent PNG export.

## 7. Settings slice

```ts
effects.stack: Array<{
  id: string; type: "smoke" | "particles" | "fog" | "glow" | "trail";
  name: string; enabled: boolean;
  anchor: AnchorId | "around" | "floor";
  params: SmokeParams | ParticleParams | …;   // per-type, Zod-validated
  timeline: { in: "appear" | "reveal" | "burst" | "none"; out: "disappear" | "none";
              loop: boolean; duration: number; delay: number; easing: Easing;
              trigger: Trigger };
}>
```

Positions are relative to anchors and model height (1 = model height), so an
effect stack copied to another portrait fits it automatically. Library
presets are the same documents.

## 8. Outputs

- PNG export (M10): renders the current timeline frame.
- GLB export cannot contain shader effects; the export dialog says so.
- Embeds (M11): the effects runtime is a separate lazy chunk loaded only when
  the published snapshot has effects; counts against the embed JS budget.
- Video export (WebM via `canvas.captureStream` + MediaRecorder) is a natural
  follow-up; not planned yet.

## 9. Technology choices

- **WebGL 2 with three.js `WebGLRenderer`** (current stack). three.js
  WebGPU + TSL compute was evaluated: attractive for particles, but it would
  change the renderer for every feature; re-evaluate at M8 kickoff.
- No new dependencies required. Noise functions from the MIT-licensed
  `webgl-noise` (Ashima Arts / Stefan Gustavson), vendored with attribution.
  drei's `Trail`/`Sparkles` are references only. pmndrs `postprocessing`
  (bloom) is a possible later high tier.

## 10. Acceptance and tests

- Each effect type renders, responds to every control in real time, and
  disposes cleanly (GPU counters stable across add/remove cycles).
- All five transitions play correctly and are scrubbable; triggers work.
- Effect stacks move between the sample and a generated portrait without
  manual adjustment.
- Performance budgets met on the device matrix; idle studio renders no
  frames with only static effects.

Unit: timeline maths, parameter validation, anchor-relative placement.
Browser: per-effect pixel checks, transitions at fixed times (deterministic
clock), GPU counters, reduced motion, workspace switch keeps the pose.
