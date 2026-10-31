# Implementation roadmap

Milestones run in order. A milestone is complete only when its acceptance
criteria pass, its tests pass, and the running interface has been inspected
(screenshots attached to the PR). Each milestone ships as its own pull request.

Development before Milestone 6 uses a **licensed sample head** as a
development fixture (a CC0 bust built from MakeHuman assets, ADR 0003),
clearly labelled "Sample model" in the UI. It is not presented as generated
output. No paid reconstruction provider is used or subscribed to without the
product owner's approval (ADR 0002).

**Expanded scope (31 October 2026, ADR 0006):** advanced colour picker (M4),
model parts / Geometry tool (new M7), eye effects and Effects Studio (new
M8). Later milestones were renumbered:

| Milestone                          | Before  | Now            |
| ---------------------------------- | ------- | -------------- |
| Materials, lighting, colour, theme | M4      | M4 (re-opened) |
| Upload / Reconstruction            | M5 / M6 | M5 / M6        |
| Model parts and Geometry tool      | —       | **M7**         |
| Eye effects and Effects Studio     | —       | **M8**         |
| Dashboard and project management   | M7      | M9             |
| GLB and PNG exports                | M8      | M10            |
| Embedding and publishing           | M9      | M11            |
| Quality assurance and deployment   | M10     | M12            |

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
**Deferred:** `touch-action: pan-y` for embeds (Milestone 11; was M9).

## M4 — Materials, lighting, colour and theme (re-opened)

**Objective:** Studio-quality look controls without regenerating geometry, a
precise colour picker, and a theme that reaches every Studio surface.

**Delivered so far (commit fb6b053, ADR 0005):** six material presets applied
by a reusable `MaterialSystem` (originals preserved, geometry untouched,
materials cached and updated in place); per-preset Adjust with Reset; five
lighting rigs with a persistent procedural environment for reflections;
Glass refracting the Scene background; rendered preset previews; floating
viewport controls on theme tokens; tests for all of it.

**Remaining scope:**

1. **Theme completion** (ADR 0006 §7). Review found the theme cannot be
   changed from the Studio, and the Next.js Dev Tools "Preferences → Theme"
   (development only) only restyles its own panel. Add a Dark / Light /
   System control in the Studio top bar and the app shell; disable the Dev
   Tools indicator (`devIndicators: false`); audit and fix every Studio
   surface in both themes — top bar, breadcrumbs, rail, inspector, mobile tab
   bar and sheets, popovers, menus, dialogs, tooltips, toasts, viewport
   overlays (loading, error, no-WebGL). The viewport stage stays dark.
2. **Advanced colour picker** (`docs/specs/colour-picker.md`): spectrum, hue,
   alpha with checkerboard, HEX/RGB/HSL/HSB, eyedropper (native + viewport
   sampler), recent and in-portrait colours, copy/paste; wired to material
   tint (with opacity), background colours and gradient stops.
3. **Material opacity** from the tint alpha (depth pre-pass, no sorting
   artefacts) and a lower-cost Glass tier on mobile.

**Acceptance:**

- Switching presets never alters geometry and Original restores the exact
  textures. ✅
- Chrome and Gold show readable reflections in every lighting preset. ✅
- Theme can be changed from inside the Studio; every Studio surface listed
  above passes contrast in Dark and Light; the viewport, model, materials and
  lighting are identical in both themes; preference persists.
- Colour picker meets its spec acceptance (round-trips, eyedropper, recent
  colours, copy/paste, keyboard, axe) and drives the real renderer.
- Glass has a lower-cost tier on mobile; ≥ 45 fps on a mid-range phone.

**Testing:** Unit tests for colour conversion/parsing; browser tests that
switch the theme from the Studio and check each surface, picker → renderer
tests, viewport sampling, existing material/lighting suites.
**Not in M4:** model parts, eye effects, Effects Studio.

## M5 — Photograph upload and validation

**Objective:** Collect good input and consent before spending money.
**Scope:** Supabase project + Auth (sign-in is required before any upload or
generation; the dashboard and projects are tied to the signed-in account); migrations for profiles, projects,
portraits, source_images, consents; private storage bucket; upload flow with
client face pre-check (MediaPipe), server validation and re-encode (Sharp,
EXIF strip); optional extra angles; consent capture.
**Acceptance:**

- Invalid files rejected with specific messages; no-face and multi-face
  blocked; other checks warn.
- Uploaded files contain no EXIF/GPS; stored privately; RLS prevents
  cross-user access (tested).
- Consent recorded with version.

**Testing:** Unit tests for validators; integration tests against a local
Supabase (CLI); RLS tests with two users; e2e upload flow.

## M6 — AI reconstruction integration

**Objective:** Turn validated photos into normalised GLB assets asynchronously.
**Scope:** Step 1 provider shortlist from free tiers, published samples and
vendor conversations, then a budget request to the product owner for the
paid bake-off with consenting volunteers (see research doc §5), and an ADR. Step 2 provider
interface + chosen adapter(s); generation_jobs + model_assets migrations;
start route; webhook route; cron polling fallback; glTF Transform pipeline
built as named, versioned stages (normalise → segment slot for M7 → optimise
→ thumbnail) so later stages can be added and back-filled;
R2 upload; progress UI with Realtime; failures and retries; rate limits.
**Acceptance:**

- Provider chosen by documented evaluation; licence and data gates passed.
- End-to-end: upload → completed GLB visible in the studio, with webhook and
  with polling only.
- Duplicate webhooks are idempotent; timeouts mark jobs failed with a clear
  message; provider keys absent from client bundles (verified by build scan).

**Testing:** Adapter contract tests with recorded fixtures; webhook signature
tests; job state machine unit tests; one real end-to-end run per release.

## M7 — Model parts and Geometry tool

**Objective:** Show head only, head and neck, full bust or a custom set of
parts on any portrait, with clean closed geometry.
**Scope** (`docs/specs/model-parts.md`): segmentation stage in the asset
pipeline (landmarks by render-and-detect with MediaPipe, cross-section
profile, exact triangle splits, cap generation, validation); glTF primitives
per part + Model Descriptor metadata (`model_assets.manifest`); backfill of
existing assets; sample head rebuilt with the same labels; client
`GeometrySystem`; Model panel (presets, custom part list, hover highlight);
framing and contact shadow from visible bounds; clipping-plane fallback for
unsegmentable models.
**Depends on:** M5 (MediaPipe), M6 (versioned pipeline, real outputs).
**Acceptance:** presets work with closed caps under every material on the
sample and ≥ 3 generated models; vertex data never changes; failed
segmentation degrades to Full bust with a message.
**Testing:** unit tests for profile/cut/cap maths; pipeline golden tests on
fixtures; browser tests for presets, framing and caps.

## M8 — Eye effects and Effects Studio

**Objective:** Real-time GPU effects around the portrait, reusable across
portraits.
**Scope:** Effects workspace (`/studio/[id]/effects`, shared viewer in the
studio layout), layers list, properties, timeline strip; effects runtime
(module interface, scheduler, depth pre-pass, quality tiers); eye effects
(`docs/specs/eye-effects.md`: glow colour, intensity, radius, hover and
proximity triggers, pulse, glow blink; eyelid blink only with blend shapes);
smoke, particles, fog, glow, light trails and appear / disappear / reveal /
loop / burst transitions (`docs/specs/effects-studio.md`); MaterialSystem
emissive and dissolve hooks; effect library presets.
**Depends on:** M4 (colour picker), M7 (anchors, visible bounds).
**Acceptance:** every control drives the renderer in real time; transitions
scrubbable; stacks transfer between portraits; GPU counters stable; ≥ 45 fps
on a mid-range phone (low tier, two layers); no frames rendered when idle
with static effects; reduced-motion behaviour.
**Testing:** unit tests for timeline and triggers (deterministic clock);
browser pixel tests per effect and transition; performance profiles.
May be split into M8a (runtime + eyes) and M8b (Effects Studio) at kickoff if
the estimate requires.

## M9 — Dashboard and project management

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

## M10 — GLB and PNG exports

**Objective:** Take the portrait out of the app.
**Scope:** Original GLB download (presigned), styled GLB via GLTFExporter,
PNG render dialog (1×/2×/4×, transparent), clamping to GPU limits, export
records, thumbnails from the same renderer. Exports include only visible
parts (M7); PNG renders the current effects frame (M8); GLB export explains
that shader effects are not included.
**Acceptance:** Exported GLBs open in Blender and the three.js editor with
correct materials; PNG transparency verified; 4× export works on desktop and
degrades gracefully on mobile.
**Testing:** Unit test GLB validity with glTF Transform / gltf-validator;
visual checks of exported PNGs.

## M11 — Embedding and publishing

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

## M12 — Quality assurance and deployment

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
   reconstruction), eye effects and Effects Studio (M8). ADR 0006.
7. **Theme:** must reach every Studio surface and be changeable from the
   Studio; completed within M4.
