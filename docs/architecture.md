# Technical architecture

Status: Milestone 0 proposal, updated through Milestone 4 and the expanded
scope of 31 October 2026 (ADR 0006). Decisions marked **(ADR)** have a record
in `docs/decisions/`; feature specs live in `docs/specs/`.

## 1. System overview

```
 Browser (Next.js client)                        Server (Vercel)                     External
 ───────────────────────                         ───────────────                     ────────
 Dashboard / Create / Studio  ──fetch──▶  Route handlers & server actions  ──▶  Supabase (Auth, Postgres, Storage)
   React Three Fiber viewport             ├─ /api/uploads/*   (signed upload URLs)
   Zustand stores                         ├─ /api/portraits/* (CRUD, settings)        ──▶  Cloudflare R2 (GLB, PNG)
   MediaPipe face pre-check (WASM)        ├─ /api/generation/* (start, status)
                                          ├─ /api/webhooks/[provider] ◀──────────────────  Reconstruction provider(s)
 Embed page (/e/[slug])  ◀── public ───   ├─ /api/cron/poll-jobs (fallback polling)
   minimal viewer bundle                  └─ lib/reconstruction (provider adapters, server-only)
```

Principles:

- **Server-only secrets.** Provider keys, R2 keys and the Supabase service-role
  key are only imported from modules marked `import "server-only"`.
- **Provider independence.** The UI and renderer know only our own types
  (`Portrait`, `GenerationJob`, `ModelAsset`). Providers are adapters.
- **Settings ≠ geometry.** Customisation is a versioned JSON document stored
  separately from the GLB; the GLB is never rewritten to change a material.

## 2. Stack and versions

| Concern          | Choice                                                                    | Version at time of writing |
| ---------------- | ------------------------------------------------------------------------- | -------------------------- |
| Framework        | Next.js (App Router) + React + TypeScript (strict)                        | next 16.x, react 19.x      |
| Styling          | Tailwind CSS v4 with CSS-variable design tokens                           | 4.x                        |
| UI primitives    | Radix UI primitives (unstyled, accessible), wrapped in our own components | —                          |
| 3D               | three, @react-three/fiber, @react-three/drei                              | three 0.187, R3F 9         |
| Asset pipeline   | @gltf-transform/core + functions, meshoptimizer, sharp                    | —                          |
| State            | Zustand (client), server state via route handlers + SWR-style fetch       | 5.x                        |
| Validation       | Zod (shared client/server schemas)                                        | 4.x                        |
| Auth / DB        | Supabase Auth + Postgres with Row Level Security                          | —                          |
| Source photos    | Supabase Storage, **private** bucket                                      | —                          |
| Generated assets | Cloudflare R2 (S3 API via @aws-sdk/client-s3)                             | —                          |
| Face pre-check   | @mediapipe/tasks-vision Face Landmarker (Apache-2.0, runs in browser)     | —                          |
| Hosting          | Vercel                                                                    | —                          |
| Tests            | Vitest (unit), Playwright (e2e + visual), axe-core (a11y)                 | —                          |

Dependencies are added per milestone, not up front. Radix and MediaPipe are the
only additions beyond the brief, justified by accessibility and by face checks
that would otherwise need a server-side ML model.

## 3. Repository layout

Entries marked `*` exist as of Milestone 1; the rest arrive with their milestone.

```
src/
  app/
    (app)/                  * shell with sidebar: dashboard, projects, settings (+ storage)
    (focus)/create/         * focused creation flow (upload + validation in M5)
    (studio)/studio/[portraitId]/ * full-screen 3D editor (Suspense + skeleton)
    dev/components/         * design-system gallery, development only
    e/[slug]/               public embed (M11, separate minimal layout)
    api/                    route handlers (uploads, generation, webhooks, cron, exports)
    globals.css             * design tokens (Tailwind v4 @theme)
  components/
    ui/                     * primitives: Button, Field, Slider, Segmented, Switch, Checkbox,
                              ColorField, Section, Disclosure, PresetGroup, Badge, Dialog,
                              Menu, Select, Tooltip, Kbd, EmptyState
    shell/                  * sidebar, search (⌘K), mobile drawer, page header, settings rows
    dashboard/              * portrait tiles and cards
    studio/                 * studio layout, inspector panels, viewport toolbar, share dialog
    viewer/                 * R3F: LazyViewer, Viewer, PortraitModel, StudioLighting, framing maths
                              interaction controller + rig (M3), MaterialSystem (M4),
                              geometry-system (M7), effects/ runtime + modules (M8)
    ui/color/               advanced colour picker (M4)
  lib/
    studio/                 * settings types/defaults, materials ✅, lighting ✅, presets;
                              geometry (M7), effects (M8)
    color/                  colour conversion, parsing, formatting, three.js boundary (M4)
    reconstruction/         provider interface + adapters (server-only)
    storage/                R2 + Supabase storage helpers (server-only)
    gltf/                   glTF Transform pipeline (server-only)
    images/                 sharp processing (server-only)
    supabase/               client/server factories
    validation/             Zod schemas shared by client and server
  stores/                   * Zustand: studio settings with undo/redo, view state
supabase/migrations/        SQL migrations
tests/e2e/                  * Playwright navigation, studio and axe tests
scripts/                    * screenshot capture for visual review
docs/                       this documentation
```

Next.js 16 runs with Cache Components and Partial Prefetching (framework
defaults). Pages that read runtime data (`params`, cookies) do so inside a
`<Suspense>` boundary with a designed fallback, so navigation stays instant.

## 4. 3D rendering foundation

### Six scene layers (ADR 0006)

The portrait is composed of independent layers — **geometry, materials,
lighting, scene/environment, motion, effects** — each with its own settings
slice, pure data module (`lib/studio/*`), runtime (`components/viewer/*`) and
panel. Layers never write each other's state. They share a read-only
**Model Descriptor** (parts, anchors, framing, capabilities) and a few
services (frame scheduler, depth pre-pass, pointer state, clock). Materials
expose two hooks — emissive (eye glow) and dissolve (reveal, part
cross-fades) — which are the only way other layers affect a material.

```
             ┌──────────── ModelDescriptor (read-only) ────────────┐
settings ──▶ │ geometry │ material │ lighting │ scene │ motion │ effects │ ──▶ one R3F scene
             └──────────────────────────────────────────────────────────┘
                               shared: scheduler · depth pre-pass · pointer · clock
```

### Scene graph

```
<StudioLayout>                             viewer lives in the layout (M8): Design and Effects
                                           workspaces share it without reloading the model
  <Canvas frameloop="demand">              camera: perspective, fov 26°, fixed (M2)
    <StudioLighting rig />                 ✅ direct lights + hemisphere + persistent procedural environment
    <TransmissionBackdrop />               ✅ Scene background for glass refraction only
    <SceneProbe />                         ✅ test/debug mirror of live scene state
    <InteractionRig>                       ✅ tracking + drag rotate THIS group only
      <PortraitModel>                      ✅ normaliser + MaterialSystem
        GeometrySystem                     (M7) part/cap visibility from the descriptor
        EyeEffects                         (M8) emissive hook + halos at eye anchors
      </PortraitModel>
      <EffectsLayer stack />               (M8) model-relative effects rotate with the head
    </InteractionRig>
    <EffectsLayer world />                 (M8) world-fixed effects (fog, floor smoke)
    <StudioShadow />                       ✅ contact shadow at the visible floor
  </Canvas>
</StudioLayout>
```

- **As built (M2):** see ADR 0003 — PBR Neutral tone mapping, Lightformer
  environment, transparent canvas over the CSS Scene background, framing that
  reserves space for the floating toolbar.
- **Camera:** a long-ish lens (fov ≈ 25–30°) avoids wide-angle facial
  distortion, which matters for likeness. The camera stays still; zoom changes
  distance within clamped limits. "Reset" restores both camera and rig.
- **Normalizer:** computes the bounding box once on load, recentres, scales the
  head to a canonical height, and applies a stored `orientationFix`
  (Euler offset) because providers disagree on forward axis (+Z vs −Z) and
  up-axis. The pivot is placed at the approximate head centre (≈ 0.62 of
  bbox height above the base, overridable), so rotation reads like a neck turn
  rather than a spin around the shoulders.
- **Resource disposal:** on unmount or model swap, traverse and dispose
  geometries, materials we created, and textures we own; clear `useGLTF` cache
  for the replaced URL.
- **Performance:** `frameloop="demand"` and `invalidate()` from the
  interaction rig while it is settling, so an idle studio does not render at
  60 fps; DPR clamped to [1, 2]; meshopt-compressed GLBs; KTX2 textures as a
  later optimisation.
- **States:** Suspense fallback (skeleton silhouette + progress from
  `useProgress`), error boundary with retry, and a WebGL-unavailable notice.

### Interaction rig (cursor tracking + drag)

As built in Milestone 3: see ADR 0004 and `src/components/viewer/interaction.ts`
(pure, unit-tested controller) and `interaction-rig.tsx` (applies it each frame).
The design below was the plan; the shipped version adds springs with inertia,
separate horizontal/vertical sensitivity and a manual-rotation toggle.

Rotation is the sum of two independent components, each damped per frame
with frame-rate-independent damping (`MathUtils.damp`):

```
rotation = track(pointer) + manual(drag)
```

| Component | Input                                                                         | Range                                   | Behaviour                                                             |
| --------- | ----------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------- |
| `track`   | Normalised pointer `[-1, 1]` relative to the canvas (or the window in embeds) | yaw ±25°, pitch ±12° × sensitivity 0.65 | Returns to 0 after 0.6 s without pointer movement or on pointer leave |
| `manual`  | Pointer drag delta (mouse, touch, pen)                                        | yaw unlimited, pitch clamped ±30°       | Setting: **return** (eases to 0 after release) or **hold**            |

Coexistence rule: while a drag is active the `track` target is frozen at its
current value (not zeroed), so there is no jump when the drag starts; after
release, tracking resumes smoothly. Because the two components add rather than
compete for one target, they never fight.

Touch: drag uses Pointer Events with pointer capture. In embeds, the canvas
uses `touch-action: pan-y` so vertical page scrolling still works, and only
horizontal drags rotate. Reduced motion: `prefers-reduced-motion: reduce`
disables cursor tracking by default, shortens damping, keeps manual drag.
Keyboard: arrow keys rotate in steps when the viewport is focused; `0` resets.

All values live in `portrait_settings.motion` and are validated by Zod.

## 5. Material system

As built in Milestone 4: see ADR 0005.

- `lib/studio/materials.ts` — preset data (defaults, fixed physics, which
  Adjust controls apply, ranges). `lib/studio/lighting.ts` — light rigs.
- `components/viewer/material-system.ts` — applies a preset to any loaded
  model: keeps originals in `userData.originalMaterial`, caches one
  `MeshPhysicalMaterial` per (preset, source material), updates it in place,
  classifies meshes generically (surface / cutout / detail), disposes all it
  created on unmount.
- `components/viewer/studio-lighting.tsx` — renders a rig: direct lights,
  hemisphere, one persistent procedural environment (gradient walls +
  Lightformers) for lighting and reflections only.
- `components/viewer/transmission-backdrop.tsx` — gives Glass the Scene
  background to refract (the visible background is CSS).
- `components/viewer/scene-probe.tsx` — mirrors live scene state (lights,
  environment version, GPU counts) onto data attributes for tests.

## 5a. Colour (M4)

Spec: `docs/specs/colour-picker.md`. Colours are stored as sRGB
`#RRGGBB`/`#RRGGBBAA`; HSB/HSL/RGB are UI views; `lib/color/three.ts` is the
single conversion point to linear three.js colours and alpha.

## 5b. Model geometry and parts (M7)

Spec: `docs/specs/model-parts.md`. Segmentation runs once per asset in the
server pipeline and is stored in the GLB (primitives per part, cap
primitives, `scene.extras.portraitStudio`) and in `model_assets.manifest`.
The browser's `GeometrySystem` only toggles visibility and reports visible
bounds to framing, shadows and effects. Clipping planes are a fallback only.

## 5c. Effects (M8)

Specs: `docs/specs/eye-effects.md`, `docs/specs/effects-studio.md`. Effect
modules implement `create / update / tick / animated / dispose`; simulation
runs on the GPU (stateless instanced particles, noise shaders); no full-screen
post-processing by default; a scheduler renders frames only while something
animates and the viewport is visible; quality tiers and reduced-motion
behaviour per module. Placement is anchor-relative, so effect stacks are
reusable across portraits.

## 6. Reconstruction provider abstraction

```ts
// lib/reconstruction/types.ts (server-only)
interface ReconstructionProvider {
  id: ProviderId;
  capabilities: { multiImage: boolean; webhooks: boolean; maxImages: number };
  submit(input: ReconstructionInput): Promise<{ providerJobId: string }>;
  getStatus(providerJobId: string): Promise<ProviderStatus>; // polling fallback
  parseWebhook(req: Request): Promise<ProviderStatus | null>; // verifies signature
  fetchResult(providerJobId: string): Promise<ReadableStream>; // raw model bytes
  deleteRemoteData?(providerJobId: string): Promise<void>;
}
```

- Inputs reference our storage via short-lived signed URLs, never public URLs.
- A registry chooses the provider from `RECONSTRUCTION_PROVIDER` (env) and
  stores `provider` on each job, so jobs finish on the provider that started
  them even after a switch.
- A `pipeline` provider can compose several adapters (see research doc §4).
- A `fixture` provider that returns a bundled, licensed sample head exists for
  local development and tests only; it is disabled in production by an env
  guard and labelled in the UI as a development fixture.

## 7. Generation job lifecycle

```
pending ──submit ok──▶ processing ──result ok──▶ completed
   │                       │
   └──submit error──▶ failed ◀──provider error / timeout / pipeline error
```

1. `POST /api/generation` validates ownership + images, inserts a `pending` job,
   submits to the provider, moves to `processing`.
2. Completion arrives by **webhook** (signature-verified, idempotent on
   `provider_job_id`) or by **polling**: a Vercel Cron route checks
   `processing` jobs older than N seconds with exponential backoff.
3. On success: download result → glTF Transform pipeline as named, versioned
   stages (validate → normalise → segment (M7) → dedupe, prune, weld,
   optional simplify per primitive, texture resize to 2048/1024, meshopt
   compression → thumbnail) →
   upload to R2 under `models/{userId}/{portraitId}/{assetId}.glb` → insert
   `model_assets` row → job `completed` → portrait points to the new asset.
4. Timeouts (e.g. 20 min) mark the job `failed` with a user-facing reason.
5. The client watches the job via Supabase Realtime on `generation_jobs`
   (fallback: polling the status route every 5 s).

Vercel function duration limits apply to step 3. If optimisation of large
outputs exceeds them, the pipeline moves to a background worker (documented
risk R5).

## 8. Exports

- **GLB (original):** signed R2 download of the optimised model.
- **GLB (styled):** client-side `GLTFExporter` of the current scene with the
  active material preset baked in (binary) and only the visible parts (M7).
  Glass uses `KHR_materials_transmission`. Shader effects cannot be stored in
  glTF; the dialog says so.
- **PNG:** rendered client-side at a chosen resolution (1×–4× viewport, max
  4096 px) by temporarily resizing the renderer, rendering one frame, and
  reading the canvas with `toBlob`. Transparent background uses
  `alpha: true` and no scene background; contact shadow stays.
  Optionally uploaded to R2 and recorded in `exports`.

## 9. Embeds

- Route `/e/[slug]` renders only the viewer with the **published snapshot**
  of settings, with no app chrome or auth.
- Publishing copies the GLB to a public R2 bucket/path behind a custom domain
  with long cache headers; unpublishing deletes it and deactivates the slug.
  Private assets are never exposed through the embed.
- Security headers: embed routes send `Content-Security-Policy:
frame-ancestors *` (or the user's allow-list); every other route sends
  `frame-ancestors 'none'`.
- Snippet: a responsive iframe using CSS `aspect-ratio`, `loading="lazy"`,
  and a `title` attribute for accessibility.

## 10. Environments and configuration

See `.env.example`. Required services: Supabase project, Cloudflare R2 bucket
(private) + public bucket for published embeds, a reconstruction provider key
(after the bake-off), Vercel project with Cron enabled.
