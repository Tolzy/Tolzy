# ADR 0007 — Customisation (M4) and on-device photo validation (M5)

Date: 2026-10-31 · Status: Proposed (Milestones 4 and 5, for review)

## Milestone 4

**Theme.** One preference (`ps-theme`, Dark default) applied before first
paint by an inline script, changeable from Settings → Appearance and from a
Dark / Light / System menu in the Studio top bar, the app sidebar and the New
Portrait header. Every surface uses semantic tokens; floating controls use
`--float-*`; only the viewport stage uses `--viewport-*` and stays dark. The
Next.js dev-tools indicator is disabled (`devIndicators: false`).

**Colour values and picker.** Stored as sRGB `#rrggbb` / `#rrggbbaa`
(ADR 0006 §4). `lib/color` holds conversions, parsing and formatting; the
picker edits in HSB so hue survives greys. Opacity is offered only where it
means something: background colours (alpha), materials (a separate Opacity
slider). The eyedropper uses the EyeDropper API where the browser has it and
is hidden elsewhere; a viewport sampler for other browsers is deferred. No
colour library dependency.

**Opacity rendering.** A translucent head must not reveal its own inner
faces. Each opaque mesh gets a depth-only twin (shared geometry, colour writes
off) drawn first; the colour pass then blends only the front-most surface.
Already-transparent sources (eye corneas, brows) blend as before — a twin
would hide the eyeball behind its own cornea. Original stays untouched: a
translucent copy of each source material is cached. Cast and contact shadows
scale with opacity. Glass has no opacity control (transmission is its
transparency).

**Lighting adjustments.** Intensity scales the direct lights; ambient scales
the hemisphere fill and the environment (reflections); light colour tints the
direct lights; shadow strength drives the shadow map's intensity and the
contact shadow. Choosing a preset loads its defaults; Reset restores them.

**Persistence.** `lib/studio/schema.ts` (Zod, versioned) validates the
settings document per section, so one bad value never discards the rest.
Saved per portrait in `localStorage` (debounced, flushed on page hide);
moves to `portrait_settings` with accounts (M10). Undo history is not saved.

## Milestone 5

**Validate on the device; upload only with an account.** Photos are checked
in the browser and never uploaded in this build: uploading requires sign-in
(product-owner decision 1) and a private storage backend (Supabase Auth +
Storage with RLS, signed URLs, server re-encode and EXIF stripping), which
need the product owner's Supabase project. The review step says so; there is
no fake upload. `lib/uploads/availability.ts` is the switch the server
upload will replace.

**MediaPipe Face Landmarker, self-hosted.** Apache-2.0 runtime from
`@mediapipe/tasks-vision` (copied to `public/vendor` at build time) and the
float16 model committed under `public/models/mediapipe` — no third-party CDN,
no network calls with photo data. Runs on the CPU (WASM) for consistent
results; loaded only when a photo is checked. Its informational console
lines are filtered so they don't surface as errors.

**Checks and severity.** Fail (blocks): unsupported or disguised file
(signature sniffing), over 20 MB, unreadable, short side under 1024 px, no
face (front photo), more than one face, face too small (< 300 px or < 14 % of
the height), heavy blur. Warn (allowed): head turned, face partly cut off or
hairline missing, eyes closed or covered, non-neutral expression, slight
softness, exposure and uneven light. Profile photos are checked for format,
resolution and sharpness only (face detection is for front-facing views).
If the face model cannot load, the result says the face was not checked.

**Fair exposure checks.** Exposure is judged by percentiles and clipping of
the inner face (no background), never by average brightness, and focus is
measured after contrast normalisation — so darker and lighter skin tones are
treated the same. Found in testing: an average-brightness rule flagged the
correctly lit sample head (deep skin tone) as "too dark".

**Test fixtures** are renders of the CC0 sample head (front, ¾, profile) and
derived variants (`tests/fixtures/photos`), so no real person's photo is
used.

## Consequences

- Server upload, consent records and retention jobs remain M5 work blocked
  on the Supabase project.
- The settings document gains `material.opacity` and lighting `color`,
  `ambient`, `shadowIntensity`; older saved documents are upgraded on load.
- `face_landmarker.task` (3.7 MB) is in the repository; the WASM runtime
  (~14 MB) is copied at build time and served only to the New Portrait page.
