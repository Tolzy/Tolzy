# Implementation roadmap

Milestones run in order. A milestone is complete only when its acceptance
criteria pass, its tests pass, and the running interface has been inspected
(screenshots attached to the PR). Each milestone ships as its own pull request.

Development before Milestone 6 uses a **licensed sample head scan** as a
development fixture (candidate: the Lee Perry-Smith head scan distributed with
the three.js examples, CC BY 3.0 — licence to be re-verified and attributed),
clearly labelled "Sample model" in the UI. It is not presented as generated
output.

---

## M0 — Research and technical foundation ✅ (this PR)

**Objective:** Decide how to build before building.
**Scope:** Repository inspection, Mobbin research, provider desk research,
architecture, data model, design direction, security policy, risks, plan.
**Deliverables:** `docs/*`, `.env.example`, updated `README.md`.
**Acceptance:** Documents reviewed and approved by the product owner; open
questions (below) answered.
**Testing:** n/a (documentation).

## M1 — Design system and application shell

**Objective:** A real, navigable shell with the final visual language.
**Scope:** Next.js + TypeScript (strict) + Tailwind v4 scaffold; ESLint,
Prettier, Vitest, Playwright; design tokens (light/dark); Geist fonts; core
primitives (§3 of design-system.md); app shell (sidebar, top bar); empty
dashboard, empty studio layout with placeholder viewport region, 404/error
pages; `/dev/components` gallery (dev only).
**Tasks:** scaffold → tokens → primitives → shell → routes → CI.
**Acceptance:**
- All primitives keyboard-operable with visible focus; axe reports no
  serious/critical issues.
- Light and dark themes pass contrast checks.
- Layout correct at 375, 768, 1280, 1728 px widths.
- `npm run build`, lint, typecheck, unit and e2e tests green in CI.
**Testing:** Vitest for components, Playwright smoke + axe, visual snapshots of
the component gallery.

## M2 — 3D rendering foundation

**Objective:** Render real GLB geometry beautifully and safely.
**Scope:** `<Viewer>` with Canvas, camera, environment, backdrop, contact
shadow; `<PortraitModel>` with GLB loading (meshopt/Draco decoders
self-hosted), Normalizer (centre, scale, pivot, orientation fix), loading,
error and no-WebGL states; disposal; `frameloop="demand"`.
**Acceptance:**
- Sample head loads, is centred and upright; three test GLBs with different
  axes/scales are normalised by settings alone.
- Switching models 20× shows no growth in `renderer.info.memory`.
- Idle studio renders 0 frames/s; interaction renders at display rate.
- Broken URL shows the error state with retry.
**Testing:** Unit tests for normalisation maths; Playwright with
SwiftShader/WebGL screenshot of the viewer; memory regression test.

## M3 — Cursor tracking and manual interaction

**Objective:** The head follows the pointer naturally and can be inspected.
**Scope:** InteractionRig (additive track + manual model), pointer
normalisation, limits, sensitivity, damping, idle return, drag (mouse/touch/
pen), keyboard rotation, reduced-motion handling, settings store.
**Acceptance:**
- Defaults: yaw ±25°, pitch ±12°, sensitivity 0.65, idle return 0.6 s.
- No jump when a drag starts or ends; tracking resumes smoothly.
- Same behaviour at 30, 60 and 120 Hz (frame-rate independent).
- Reduced-motion users get no automatic tracking; drag still works.
- On touch, vertical page scroll still works in embed mode.
**Testing:** Unit tests for the rotation maths (pure functions); Playwright
pointer simulations asserting rig rotation; manual test matrix on iOS
Safari, Android Chrome, desktop Safari/Chrome/Firefox.

## M4 — Materials, lighting and customisation

**Objective:** Studio-quality look controls without regenerating geometry.
**Scope:** Material presets (Original, Chrome, Obsidian, Ceramic, Glass,
Gold) with original-material preservation; lighting presets built from
Lightformers + self-hosted HDRIs; background (solid, gradient, transparent);
inspector UI with presets and Adjust disclosure; Zod settings schema;
undo/redo; local persistence (server persistence arrives in M7).
**Acceptance:**
- Switching presets never alters geometry and Original restores the exact
  textures.
- Chrome and Gold show readable reflections in every lighting preset.
- Glass has a lower-cost fallback on mobile; ≥ 45 fps on a mid-range phone.
- Settings round-trip through the Zod schema.
**Testing:** Unit tests for schema and material factory; visual regression
screenshots per preset × lighting; performance profile on mobile.

## M5 — Photograph upload and validation

**Objective:** Collect good input and consent before spending money.
**Scope:** Supabase project + Auth; migrations for profiles, projects,
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
**Scope:** Step 1 bake-off and ADR (see research doc §5). Step 2 provider
interface + chosen adapter(s); generation_jobs + model_assets migrations;
start route; webhook route; cron polling fallback; glTF Transform pipeline;
R2 upload; progress UI with Realtime; failures and retries; rate limits.
**Acceptance:**
- Provider chosen by documented evaluation; licence and data gates passed.
- End-to-end: upload → completed GLB visible in the studio, with webhook and
  with polling only.
- Duplicate webhooks are idempotent; timeouts mark jobs failed with a clear
  message; provider keys absent from client bundles (verified by build scan).
**Testing:** Adapter contract tests with recorded fixtures; webhook signature
tests; job state machine unit tests; one real end-to-end run per release.

## M7 — Dashboard and project management

**Objective:** Organise and find portraits.
**Scope:** Projects CRUD, portraits list/grid, search, filters, sort,
rename/move/delete (with storage cleanup), thumbnails, server-persisted
settings with autosave, account settings (profile, data deletion).
**Acceptance:** All actions work with keyboard; deletion removes storage
objects; empty, loading and error states designed; list of 200 portraits stays
responsive.
**Testing:** e2e CRUD flows; RLS tests; deletion integration test.

## M8 — GLB and PNG exports

**Objective:** Take the portrait out of the app.
**Scope:** Original GLB download (presigned), styled GLB via GLTFExporter,
PNG render dialog (1×/2×/4×, transparent), clamping to GPU limits, export
records, thumbnails from the same renderer.
**Acceptance:** Exported GLBs open in Blender and the three.js editor with
correct materials; PNG transparency verified; 4× export works on desktop and
degrades gracefully on mobile.
**Testing:** Unit test GLB validity with glTF Transform / gltf-validator;
visual checks of exported PNGs.

## M9 — Embedding and publishing

**Objective:** Share an interactive portrait safely.
**Scope:** Share dialog (Private / Public embed), publish/unpublish routes,
public bucket copy, `/e/[slug]` minimal viewer, poster image, frame-ancestors
headers, iframe snippet with responsive sizing, optional origin allow-list.
**Acceptance:** Unpublished portraits are unreachable (asset URL 404s);
embed works on a third-party test page on desktop and mobile; embed route JS
budget ≤ 250 KB gzip excluding three.js core chunk; Lighthouse performance ≥ 80
on the embed page.
**Testing:** e2e publish/unpublish; header tests; third-party page harness.

## M10 — Quality assurance and deployment

**Objective:** Production readiness.
**Scope:** Full accessibility audit, cross-browser/device matrix, performance
budgets, security review (headers, RLS, secrets scan), error monitoring,
retention cron, privacy policy and terms, Vercel production deploy with
environment separation (preview / production).
**Acceptance:** All earlier acceptance criteria re-verified on production;
no critical a11y or security findings open; runbook documented.

---

## Open questions for the product owner

1. **Accounts:** Is sign-in required before uploading (recommended for privacy
   and cost control), or should there be a try-before-sign-up path?
2. **Provider budget:** Approve ≈ $200 + plan fees for the bake-off, and
   recruiting 8–12 consenting test subjects?
3. **Retention default:** 30 days for source photos, with an opt-in to keep —
   acceptable?
4. **Theme:** Light-first UI with a neutral light viewport (as proposed), or
   dark-first studio?
5. **Launch regions:** Needed for the licence gate (e.g. Hunyuan3D excludes
   EU/UK/KR) and for biometric-data compliance.
6. **Monetisation:** Credits/quotas affect rate limiting and job design;
   out of scope for now unless you want it planned.
