# ADR 0008 — Reconstruction pipeline (M6) and model parts (M7)

Date: 2026-11-01 · Status: Proposed (Milestones 6 and 7, for review)

## Context

Milestone 6 turns validated photos into a portrait model; Milestone 7 splits
any model into regions with clean boundaries. The product owner has not
approved an external provider or any spending, so the pipeline must be real
and testable end to end **without** contacting a provider.

## Decisions

### 1. Provider-independent pipeline, provider chosen later

- `lib/reconstruction/types.ts` defines `ReconstructionProvider`
  (`submit`, `getStatus`, `fetchResult`, `cancel`, `deleteRemote`,
  `capabilities`) and `ProviderError {code, message, retryable}`.
- `lib/reconstruction/registry.ts` picks the provider from
  `RECONSTRUCTION_PROVIDER`; each job stores its provider id, so jobs finish on
  the provider that started them.
- **Fixture provider** (development and tests only; refused when `VERCEL` is
  set): goes through the real stages, timing and polling, and returns a bundled
  CC0 model — the sample head, or a provider-like fused single mesh that is
  Z-up, in centimetres and off-centre. Scenarios (`fail-once`, `fail`,
  `invalid-glb`, `slow`) exercise failure paths. The UI labels it “Development
  fixture … not a reconstruction of your photo”, and portraits made with it
  carry a “Fixture” badge.
- **Meshy adapter** written against the published Multi-Image to 3D API and
  unit-tested with mocked responses. It is **off** unless both
  `RECONSTRUCTION_API_KEY` and `RECONSTRUCTION_PROVIDER_APPROVED=1` are set.
  It has never been called live.
- Provider comparison and recommendation: `docs/research/provider-comparison.md`.

### 2. Local development backend behind the production interfaces

Supabase/R2 projects don't exist yet, and creating them is an external
service. `lib/server/store.ts` is a file-based store (JSON with a serialised
write lock and atomic renames, files under `DATA_DIR`) enabled only by
`LOCAL_BACKEND=1` and refused on hosted deployments. Tables mirror
`docs/data-model.md` (users, sessions, photos, consents, jobs, portraits,
assets). Swapping to Supabase changes `store.ts`/`auth.ts`, not the routes or
UI. Local sign-in is email-only (no password) and exists only on this backend.

### 3. Polling-driven job state machine

`queued → preparing → submitted → processing → downloading → validating →
completed`, or `failed` / `cancelled`. `advanceJob` moves a job one step and
is called by the status route (while someone watches), by the dashboard
render, and by `/api/cron/maintenance` (Bearer `CRON_SECRET`) for unattended
jobs. A per-job lock prevents double submission. Max 3 attempts, 30-minute
timeout, provider polling interval `RECONSTRUCTION_POLL_MS`. Webhooks are
deferred until a provider is chosen (they are an optimisation over polling).

The generation screen shows only real states: the six stages map one-to-one
to job states; a percentage appears only when the provider reports one; the
elapsed time is measured, and **no ETA is shown** because there is no real
duration data yet (it can be derived from completed jobs once a provider
runs).

### 4. Model validation and normalisation (server)

`lib/server/model-pipeline.ts` checks the GLB header, declared length, no
external URIs, triangle limits and finite, non-degenerate geometry, then
measures orientation from the shape itself: lateral axis by mirror symmetry,
up axis by the neck profile, forward by the nose. The result is a
**manifest** (orientation, framing pivot/focus, counts) stored with the asset.
The **original GLB is kept byte-for-byte**; normalisation is applied when
loading, so a better normaliser can be rolled out without re-processing.

### 5. Segmentation runs on load, in the browser (deviation from the M7 spec)

The spec (`docs/specs/model-parts.md` §3) planned segmentation as a server
stage that rewrites the GLB. As built, `lib/segmentation` is pure TypeScript
with no DOM or three.js dependency, and runs in the browser on load
(~100 ms for 15k triangles). Reasons: the stored model stays the provider's
original; no backfill is needed when the algorithm improves; and the same code
runs in Node for tests and can move to the server pipeline later without
changes. Trade-off: every load pays the cost (fine at current sizes; a
cached descriptor is the next step for very large models).

Geometry-aware, not clipping: two planes are found by profile analysis — a
slanted head cut from the throat to the nape, and a shoulder cut. Triangles
crossing a plane are split exactly. Cut vertices are added to a shared store,
so original vertices never move. Each cross-section becomes a closed loop and
gets a cap. If a cut produces more than two outlines, the surface there isn't
closed. Segmentation then fails with a reason rather than leaving holes, and
the model is shown whole. Face, ears and shoulders are labelled areas of the
continuous surface: selectable and styleable, but not hideable. Hiding them
would open the mesh, and the UI says so.

MediaPipe landmarks (planned in the spec) are not used yet: the geometric
rules were sufficient on both topologies tested. Landmarks are the planned
upgrade for unusual crops and for eye placement on fused meshes (M8).

### 6. Regions are a stable vocabulary for later milestones

`lib/segmentation/regions.ts`: id, name, parent, effects (`eye-glow`,
`hair-effects`, `face-lighting`, `surface-effects`). Per-model availability
and triangle counts come from segmentation. Per-region material overrides
live in the portrait settings (`regionMaterials`), inherit from the parent
(`lineage`), and are applied by the M4 MaterialSystem to the part meshes.
Parts share GPU vertex buffers, so nothing is duplicated.

## Consequences

- Choosing a provider = one adapter file + tests + approval flags; nothing else
  changes.
- Production still needs Supabase Auth/Storage (or equivalent), private object
  storage with signed URLs, a DPA with the provider, and NDPA 2023 compliance
  work (`docs/security-privacy.md` §7).
- Fused provider meshes cannot offer separate hair or eyes; the Model panel
  reports “Not separable” for them.
