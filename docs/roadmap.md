# Implementation roadmap

Milestones run in order. A milestone is complete only when its acceptance
criteria pass, its tests pass, and the running interface has been inspected
(screenshots attached to the PR). Each milestone ships as its own pull request.

Development before Milestone 6 uses a **licensed sample head** as a
development fixture (a CC0 bust built from MakeHuman assets, ADR 0003),
clearly labelled "Sample model" in the UI. It is not presented as generated
output. No paid reconstruction provider is used or subscribed to without the
product owner's approval (ADR 0002).

**Expanded scope (31 October 2026, ADR 0006; numbering confirmed by the
product owner the same day):** advanced colour picker (M4), model parts /
Geometry tool (M7), Eye Effects (M8), Effects Studio (M9). Later milestones
were renumbered:

| Milestone                          | Original | Now       |
| ---------------------------------- | -------- | --------- |
| Materials, lighting, colour, theme | M4       | M4 ✅     |
| Photo upload and validation        | M5       | M5 ✅\*   |
| AI reconstruction                  | M6       | M6 ✅†    |
| Model parts and Geometry tool      | —        | **M7** ✅ |
| Eye Effects                        | —        | **M8**    |
| Effects Studio                     | —        | **M9**    |
| Dashboard and project management   | M7       | M10       |
| GLB and PNG exports                | M8       | M11       |
| Embedding and publishing           | M9       | M12       |
| Quality assurance and deployment   | M10      | M13       |

\* M5's on-device selection and validation are complete; the server upload
now exists on the local development backend (M6); production storage waits
for the Supabase project.

† M6 is built and tested end to end with the development fixture provider;
selecting and switching on a real provider awaits the paid benchmark and
product-owner approval (ADR 0008, `docs/research/provider-comparison.md`).

Feature dependencies: `docs/feature-dependencies.md`.

---

## M0 — Research and technical foundation ✅

**Objective:** Decide how to build before building.
**Scope:** Repository inspection, Mobbin research, provider desk research,
architecture, data model, design direction, security policy, risks, plan.
**Deliverables:** `docs/*`, `.env.example`, updated `README.md`.
**Acceptance:** Documents reviewed and approved by the product owner; open
questions (below) answered.
**Testing:** n/a (documentation).

## M1 — Design system and application shell ✅

**Objective:** A real, navigable shell with the final visual language.
**Scope:** Next.js 16 + TypeScript (strict) + Tailwind v4 scaffold; ESLint,
Prettier, Vitest, Playwright + axe; design tokens (light-first application,
dark studio viewport); Geist fonts; core primitives (§3 of design-system.md);
app shell (sidebar, search, mobile drawer); dashboard, projects, settings
(account, storage & privacy), creation flow layout, studio layout with
inspector, viewport toolbar and share dialog; 404/error pages;
`/dev/components` gallery (development only); CI workflow.
**Acceptance:**

- All primitives keyboard-operable with visible focus; axe reports no
  serious/critical issues on every page at desktop and mobile sizes.
- Light theme passes contrast checks (a dark application theme is deferred —
  the studio viewport is dark by design).
- Layout correct at 390, 1024 and 1440 px widths (inspected screenshots).
- `npm run build`, lint, typecheck, unit and e2e tests green in CI.

**Testing:** Vitest for the studio store, settings and controls; Playwright
navigation, studio interaction, reduced-motion and axe tests on desktop and
mobile projects; `scripts/screenshots.mjs` for visual review.

**Not in scope (honestly labelled in the UI as a preview build):** sign-in,
upload, generation, persistence, exports and publishing.

## M2 — 3D rendering foundation ✅

**Objective:** Render real GLB geometry beautifully and safely.
**Delivered:** Lazily loaded `<Viewer>` (R3F) with a fixed, responsive camera;
normaliser (orientation, unit scale, pivot); procedural studio lighting with
PBR Neutral tone mapping and a contact shadow; loading, error-with-retry and
no-WebGL states; resource disposal; `frameloop="demand"`. A CC0 sample bust
built reproducibly from MakeHuman assets (ADR 0003,
`scripts/sample-head/README.md`), and a real render as its dashboard
thumbnail. Light intensity, rotation and shadow drive the renderer; material
and lighting presets and motion are labelled as not yet applied.
**Acceptance (met):**

- Sample head loads as real geometry, centred, upright and framed at 390,
  1024 and 1440 px, clear of the toolbar.
- Invalid GLB shows the error state and recovers on retry; browsers without
  WebGL see an explanation and the rest of the studio still works.
- Dashboard pages load no three.js code.
- No console errors across repeated studio visits.

**Testing:** Unit tests for framing maths; Playwright tests that measure
rendered detail in the viewport, the error/retry path, the no-WebGL fallback,
zoom re-framing and repeated navigation; axe on all pages.

**Deferred:** automated GPU-memory assertions (`renderer.info`) — disposal is
implemented and covered indirectly by the repeated-visit test.

## M3 — Cursor tracking and manual interaction ✅

**Delivered:** Independent tracking and manual offsets combined by springs
(ADR 0004); pointer tracking over the whole viewport with soft limits and
idle return; drag with pointer capture, cancellation handling, flick and
Return/Hold; touch; keyboard arrows; Reset view eases to neutral; reduced
motion. Motion panel wired to real settings (tracking, range, horizontal and
vertical sensitivity, manual rotation on/off, release behaviour, smoothness,
return delay). Dark-first theme with a persisted Light/System preference in
Settings → Appearance.
**Acceptance (met):** defaults ±25° / ±12°, 65 % sensitivity, 0.6 s return;
no jump when a drag starts or ends; same motion at 8–120 fps; reduced-motion
users get no automatic tracking; repeated visits show no heap growth.
**Testing:** 25 unit tests for the controller; Playwright tests for all four
directions and diagonal, leaving the viewport, limits from the panel,
tracking toggle, horizontal/vertical drag, tracking + drag combination,
reset, drag disabled, arrow keys, touch swipe (CDP touch events), reduced
motion, theme default/persistence, axe in both themes, and a heap-growth
test over repeated visits.
**Review refinements:** the sample bust now has a flat horizontal base (the
previous curved cut exposed a dark cap as a "wedge" beyond ~20° of rotation),
and touch drags use a separate, configurable rate (55 % of mouse by default).
Covered by asset-geometry unit tests and mobile short/medium/long swipe tests.
**Deferred:** `touch-action: pan-y` for embeds (Milestone 12; originally M9).

## M4 — Materials, lighting, customisation and global theming ✅ (in review)

**Objective:** Studio-quality look controls without regenerating geometry, a
precise colour picker, and a theme that reaches every surface. ADRs 0005,
0006 §7 and 0007.

**Delivered:**

- **Theme:** Dark default; Dark / Light / System menu in the Studio top bar,
  the app sidebar and the New Portrait header (same preference as Settings →
  Appearance); applied before first paint; persisted; every page, panel,
  menu, dialog, popover and tooltip on semantic tokens; viewport stage dark
  in both themes. Next.js dev-tools indicator disabled. Light-theme warning
  colour darkened to pass 4.5:1.
- **Colour picker** (`components/ui/color`, `lib/color`): spectrum,
  hue, opacity over a checkerboard, HEX/RGB/HSL/HSB inputs, eyedropper
  (native EyeDropper API where available), live preview, copy/paste of any
  CSS colour format, recent colours, preset swatches; replaces the native
  input everywhere (material tint, light colour, background colours).
- **Materials:** six presets; Adjust = tint, roughness, metalness, lacquer
  (Obsidian/Ceramic), thickness (Glass), **opacity 0–100 %** (all but Glass;
  Original keeps its textures via a cached translucent copy). Translucency
  uses a depth pre-pass so only the front-most surface blends; shadows fade
  with opacity. Reset to preset; undo/redo.
- **Lighting:** five rigs; intensity, rotation, light colour, ambient,
  shadow strength, contact shadow; Reset to preset; undo/redo.
- **Scene:** background presets, gradient/solid/none, custom colours with
  opacity (checkerboard shows through), independent of material and lighting.
- **Persistence:** settings validated by a versioned Zod schema
  (`lib/studio/schema.ts`) and saved per portrait on this device; the same
  document moves to `portrait_settings` in M10.

**Acceptance (met):** presets change the real model; adjustments are live;
opacity renders without inner-face artefacts; formats round-trip; picker
opacity works; lighting presets and adjustments change the scene; background
presets and custom colours work; undo/redo restores settings; both themes
across the app, persisted, viewport dark in both; no material or lighting
regressions.
**Testing:** unit (colour maths and parsing, schema, material system incl.
opacity), browser (`customization.spec.ts`, `materials.spec.ts`,
`theme.spec.ts`, axe in both themes on every page).
**Deferred:** viewport colour sampler for browsers without the EyeDropper
API (the eyedropper is hidden there); mobile Glass quality tier.

## M5 — Photograph upload and validation ✅ (on-device; server upload pending)

**Objective:** Collect good input and consent before spending money.
**Delivered** (ADR 0007): New Portrait flow — drag-and-drop or browse,
preview, replace, remove; four optional angle slots, each independent;
guidelines with a framing illustration; consent required; Continue lists
exactly what is missing; a review step that states plainly that uploading is
not available yet and that nothing has been uploaded. Validation runs **on
the device**: file signature (not extension), 20 MB limit, decoding (HEIC
where the browser can), 1024 px minimum, then MediaPipe Face Landmarker
(self-hosted runtime and model) for face count, face size, pose, framing,
eyes, expression, head covering, plus focus and exposure measured on the face. Exposure uses
percentiles and clipping, never average brightness, so skin tone does not
affect the result.
**Remaining (needs the Supabase project — product-owner dependency):**
Supabase Auth (sign-in before upload), migrations for profiles, projects,
portraits, source_images, consents; private bucket with RLS; signed upload
URLs; server validation and re-encode (Sharp, EXIF strip); consent records
with version; retention job (30 days, keep/delete options).
**Acceptance (met for this build):** invalid files rejected with specific
messages; no-face, multi-face, too-small face, blur and files that fail
format/size/resolution are blocked; other checks warn; consent enforced; no
network request carries photo data and none goes to a third party.
**Testing:** unit (format sniffing, limits, focus/exposure maths, readiness
rules), browser (`create.spec.ts`: browse, drag-and-drop, every format and
limit, each face check, replace/remove, independent angles, consent,
no-upload guarantee, axe in both themes). Fixtures are renders of the CC0
sample head — no real person's photo.

## M6 — AI reconstruction integration ✅ (in review; provider awaiting approval)

**Objective:** Turn validated photos into normalised GLB assets asynchronously.

**Built (ADR 0008):**

- Provider comparison and recommendation. No provider is selected yet; the
  shortlist goes to a paid benchmark that needs approval.
- Provider interface, registry, fixture provider (development and tests
  only) and a Meshy adapter that is off by default.
- Local backend: accounts, sessions, private photos, consents, jobs,
  portraits and assets.
- Polling job state machine with retry, cancel, timeout, attempt limit and
  cron route.
- Model validation and orientation/framing manifest.
- Generation screen showing real stages and provider %.
- Thumbnail, dashboard entry, owner-only Studio and private model route.
- Retention: 30 days after success, 7 after failure; delete routes.

**Acceptance status:**

- ✅ End to end with polling: upload → completed GLB in the Studio and
  dashboard (fixture provider; integration + browser tests).
- ✅ Failures, retries, cancel, invalid models, access isolation, no keys
  in the client (tested).
- ⏳ Provider chosen by documented evaluation. The comparison is done; the
  benchmark needs budget approval.
- ⏳ Production storage (Supabase/R2), webhooks and rate limits come with
  the chosen provider and hosted backend.

**Testing:** `src/lib/server/__tests__/generation.integration.test.ts`,
`model-pipeline.test.ts`, `providers/meshy.test.ts` (mocked HTTP),
`tests/e2e/reconstruction.spec.ts`.

## M7 — Model parts and Geometry tool ✅ (in review)

**Objective:** Show head only, head and neck or full bust on any portrait,
with clean closed geometry, and select parts for per-region styling.

**Built (`docs/segmentation-architecture.md`, ADR 0008 §5–6):**

- Geometry-aware segmentation into head, face, hair, ears, eyes, brows,
  lashes, neck, shoulders and upper bust. It uses exact cuts with closed
  caps and reports regions it can't separate.
- Model panel: Show presets, parts list with visibility toggles, and an
  explanation where a part can't be hidden.
- Selection from the viewport or the list, with a rim highlight and
  deselect.
- Per-region materials that inherit from the parent region, on shared
  geometry.
- Framing and contact shadow follow the visible bounds.

**Deviation from spec:** segmentation runs on load in the browser (the same
pure-TS code runs in Node tests). The GLB is not rewritten, and MediaPipe
landmarks are not used yet.

**Acceptance status:**

- ✅ Presets work with closed caps on the sample and on a fused,
  provider-like model.
- ✅ Vertex data never changes.
- ✅ Failed segmentation keeps the model whole, with a message.
- ⏳ "≥ 3 generated models" needs real provider output (benchmark).

**Testing:** `src/lib/segmentation/segment.test.ts`,
`components/viewer/geometry-system.test.ts`, `tests/e2e/segmentation.spec.ts`.

## M8 — Eye Effects

**Objective:** Independently controllable eye illumination on any portrait.
**Scope** (`docs/specs/eye-effects.md`): effects runtime foundations
(module interface, frame scheduler, quality tiers); eye glow on/off, colour,
intensity, radius; hover-triggered illumination; cursor-proximity response;
pulse; glow blink (eyelid blink only when the asset has blend shapes);
independent left/right where supported; MaterialSystem emissive hook.
**Depends on:** M4 (colour picker), M7 (eye anchors).
**Acceptance:** glow follows the eyes through tracking and drag on the sample
and on a generated model without eye meshes; triggers respond within a frame;
never visible through the head; no frames rendered while static.
**Testing:** unit (proximity curve, pulse/blink timing with a deterministic
clock); browser pixel tests at the eye anchors; GPU counters.

## M9 — Effects Studio

**Objective:** Real-time GPU effects around the portrait, reusable across
portraits.
**Scope** (`docs/specs/effects-studio.md`): Effects workspace
(`/studio/[id]/effects`, shared viewer in the studio layout), layers,
properties, timeline strip; procedural smoke, particles, atmospheric fog,
light trails; appear / disappear / reveal / loop / burst transitions and
triggers; MaterialSystem dissolve hook (Reveal); library presets.
**Depends on:** M8 (runtime), M4 (colour picker), M7 (anchors, visible bounds).
**Acceptance:** every control drives the renderer in real time; transitions
scrubbable; stacks transfer between portraits; GPU counters stable; ≥ 45 fps
on a mid-range phone (low tier, two layers); idle with static effects renders
no frames; reduced-motion behaviour.
**Testing:** unit (timeline, triggers); browser pixel tests per effect and
transition; performance profiles.

## M10 — Dashboard and project management

**Objective:** Organise and find portraits.
**Scope:** Projects CRUD, portraits list/grid, search, filters, sort,
rename/move/delete (with storage cleanup), thumbnails, server-persisted
settings with autosave (Zod schema v2 incl. `geometry` and `effects`, v1 → v2
migration), recent colours per account, account settings (profile, data
deletion).
**Acceptance:** All actions work with keyboard; deletion removes storage
objects; empty, loading and error states designed; list of 200 portraits stays
responsive.
**Testing:** e2e CRUD flows; RLS tests; deletion integration test.

## M11 — GLB and PNG exports

**Objective:** Take the portrait out of the app.
**Scope:** Original GLB download (presigned), styled GLB via GLTFExporter,
PNG render dialog (1×/2×/4×, transparent), clamping to GPU limits, export
records, thumbnails from the same renderer. Exports include only visible
parts (M7); PNG renders the current effects frame (M8–M9); GLB export explains
that shader effects are not included.
**Acceptance:** Exported GLBs open in Blender and the three.js editor with
correct materials; PNG transparency verified; 4× export works on desktop and
degrades gracefully on mobile.
**Testing:** Unit test GLB validity with glTF Transform / gltf-validator;
visual checks of exported PNGs.

## M12 — Embedding and publishing

**Objective:** Share an interactive portrait safely.
**Scope:** Share dialog (Private / Public embed), publish/unpublish routes,
public bucket copy, `/e/[slug]` minimal viewer, poster image, frame-ancestors
headers, iframe snippet with responsive sizing, optional origin allow-list;
effects runtime as a lazy chunk loaded only for snapshots with effects.
**Acceptance:** Unpublished portraits are unreachable (asset URL 404s);
embed works on a third-party test page on desktop and mobile; embed route JS
budget ≤ 250 KB gzip excluding three.js core chunk; Lighthouse performance ≥ 80
on the embed page.
**Testing:** e2e publish/unpublish; header tests; third-party page harness.

## M13 — Quality assurance and deployment

**Objective:** Production readiness.
**Scope:** Full accessibility audit, cross-browser/device matrix, performance
budgets, security review (headers, RLS, secrets scan), error monitoring,
retention cron, privacy policy and terms, Vercel production deploy with
environment separation (preview / production).
**Acceptance:** All earlier acceptance criteria re-verified on production;
no critical a11y or security findings open; runbook documented.

---

## Product-owner decisions (30 October 2026)

1. **Accounts:** Sign-in is required before uploading photographs or
   generating portraits. Dashboard and projects are tied to accounts.
2. **Provider budget:** Not approved yet. Develop the renderer with a licensed
   sample head. A separate provider evaluation happens before Milestone 6; no
   paid provider plans without approval. Volunteers (8–12) are recruited once
   providers are shortlisted and consent/privacy procedures are in place.
3. **Retention:** Source photographs deleted 30 days after generation by
   default; users can keep them, delete them immediately, and see their stored
   assets. Generated models have their own deletion controls. Everything is
   private by default.
4. **Theme:** Light-first application; the 3D Studio viewport is dark by
   default. _(Updated in M3: dark-first application with a persisted Light
   option; the viewport stays dark in both.)_
5. **Region:** Nigeria is the initial market; the architecture stays
   international. No regional restrictions are hard-coded; production image
   processing is enabled per region only after provider availability,
   licensing and privacy requirements are evaluated.

See `docs/decisions/0002-product-owner-decisions.md`.

## Product-owner decisions (31 October 2026)

6. **Expanded scope:** advanced colour picker (M4), model parts (M7, after
   reconstruction), Eye Effects (M8), Effects Studio (M9). ADR 0006.
7. **Theme:** must reach every Studio surface and be changeable from the
   Studio; completed within M4.
8. **Delivery:** Milestones 4 and 5 implemented in one cycle, kept as
   separate modules with separate tests and acceptance criteria.
9. **Dev tools:** the floating Next.js developer indicator is disabled.
10. **Model parts:** real geometry segmentation, not clipping, for selecting
    the head independently of neck and shoulders (M7).
