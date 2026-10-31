# ADR 0006 — Scene layers, Model Descriptor and the expanded product scope

Date: 2026-10-31 · Status: Proposed (for product-owner review)

Context: the product owner added an advanced colour picker, model part
selection, eye effects and an Effects Studio, and reported that the Light
theme does not reach the Studio. This ADR records the architecture those
features share. Feature details: `docs/specs/*.md`.

## 1. Six independent layers

The portrait is composed of six layers. Each has its own settings slice, a
pure data module, a runtime module and an inspector panel, and never writes
another layer's state.

| Layer             | Settings slice               | Data (`lib/studio/`) | Runtime (`components/viewer/`)                              | Panel / workspace |
| ----------------- | ---------------------------- | -------------------- | ----------------------------------------------------------- | ----------------- |
| Model geometry    | `geometry`                   | `geometry.ts`        | `geometry-system.ts`                                        | Design → Model    |
| Materials         | `material`                   | `materials.ts`       | `material-system.ts` ✅                                     | Design → Material |
| Lighting          | `lighting`                   | `lighting.ts` ✅     | `studio-lighting.tsx` ✅                                    | Design → Light    |
| Scene/environment | `scene` (background, camera) | `scene.ts`           | viewport CSS, `transmission-backdrop.tsx` ✅, camera rig ✅ | Design → Scene    |
| Motion            | `motion`                     | `settings.ts` ✅     | `interaction.ts` + rig ✅                                   | Design → Motion   |
| Effects           | `effects` (eyes + stack)     | `effects.ts`         | `effects/*`                                                 | Effects workspace |

Allowed couplings, all read-only and explicit:

- Every layer may read the **Model Descriptor** (§2).
- Effects "Reveal" and part cross-fades drive a **dissolve hook** that the
  MaterialSystem exposes; eye glow drives an **emissive hook** on eye
  materials. Hooks are the only way another layer influences materials.
- Framing, contact shadow and effects use the **visible bounds** reported by
  the geometry layer.
- Shared services: frame scheduler, depth pre-pass, pointer state, clock.

## 2. Model Descriptor

One read-only description of the loaded model, built by the loader from the
GLB's `scene.extras.portraitStudio` (written by our pipeline) with safe
defaults when absent:

```ts
interface ModelDescriptor {
  source: "sample" | "generated";
  pipelineVersion: string;
  framing: ModelFraming; // exists today
  parts: Partial<Record<PartId, { primitives: string[]; caps?: string[] }>>;
  anchors: Partial<Record<AnchorId, { position: Vec3; radius?: number }>>; // eyeL, eyeR, crown, chin, neckBase…
  capabilities: { eyeMeshes: boolean; eyelidBlendShapes: boolean; partsAvailable: PartId[] };
}
```

It is what makes geometry, eye effects and effect stacks work identically
on the sample and on any generated portrait. Server copy:
`model_assets.manifest jsonb`.

## 3. Segmentation in the asset pipeline, not the browser

Part separation is computed once per asset in the server pipeline (landmarks
by render-and-detect + cross-section analysis + exact triangle splits + cap
generation) and stored as glTF primitives plus metadata. The browser only
toggles visibility. Clipping planes are a fallback preview only. A versioned
stage with a backfill job lets assets generated before M7 gain parts without
paying the provider again.

## 4. Colour values

Stored as sRGB `#RRGGBB` / `#RRGGBBAA` strings; HSB/HSL/RGB are UI views;
conversion to linear three.js colours and alpha happens at one renderer
boundary. Alpha means opacity, applied only where the target supports it
(spec table). No colour library dependency.

## 5. Effects run on the GPU, without full-screen post-processing by default

- WebGL 2 / `WebGLRenderer` stays (re-evaluate WebGPU + TSL at M8 kickoff).
- Stateless analytic particles in vertex shaders by default (no CPU per
  frame, deterministic, scrubbable); GPGPU only where state is needed.
- Glow uses halos/rim shells, not bloom: the canvas is transparent over a CSS
  background, where bloom needs premultiplied-alpha handling and a
  full-screen pass every frame. Bloom may become a high tier.
- A scheduler keeps `frameloop="demand"`: frames render only while an effect
  animates and the viewport is visible.
- Quality tiers and reduced-motion behaviour are part of every module.

## 6. Workspaces share one viewer

The viewer moves into the studio route's layout; Design and Effects are
nested routes. Switching keeps the loaded model, pose and GPU resources.

## 7. Theme: correction to ADR 0005

Review feedback: "only the floating Preferences interface changes". Cause
found (31 Oct 2026): in development, Next.js shows its own Dev Tools button
(the round "N", bottom-left/right), whose **Preferences → Theme** setting only
restyles that Dev Tools panel. The app's theme lives in Settings →
Appearance, which is **not reachable from the Studio** — the Studio has no
theme control. Interface surfaces do follow the app theme when it is set
there (verified by tests and screenshots), but the control is undiscoverable
and the Dev Tools setting is misleading.

Decision for the rest of M4: a theme control inside the Studio and the app
shell; disable the Next.js Dev Tools indicator in this project
(`devIndicators: false`) so it cannot be mistaken for app preferences; a full
audit of every Studio surface (top bar, rail, inspector, mobile tab bar and
sheets, popovers including the new colour picker, menus, dialogs, tooltips,
viewport overlays such as loading/error states) in both themes, with tests
that switch the theme from inside the Studio. The viewport stage stays dark.

## Consequences

- Two new milestones (Model parts; Effects) and renumbering of later ones
  (roadmap).
- The settings document grows to schema v2 (`geometry`, `effects`, 8-digit
  colours); the Zod schema and migration v1 → v2 ship with persistence (M9).
- The M6 pipeline must be built as named, versioned stages.
- The embed bundle gains an optional, lazily loaded effects chunk.
