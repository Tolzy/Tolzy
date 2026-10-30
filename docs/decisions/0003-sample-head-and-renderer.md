# ADR 0003 — Sample head asset and renderer foundation

Date: 2026-10-30 · Status: Accepted (Milestone 2)

## Context

Milestone 2 needs a properly licensed, complete human head (face, ears, scalp,
back of head, neck, ideally shoulders) to build the renderer before any AI
provider is chosen. Paid assets and provider spend are not approved (ADR 0002).

## Decision

1. **Sample asset:** build our own bust from **CC0 MakeHuman assets** with a
   reproducible script (`scripts/sample-head/build.py`). Ready-made heads were
   rejected for missing geometry (Lee Perry-Smith scan has no back of head),
   non-commercial licences (Nefertiti), unverifiable terms (Three D Scans,
   Sketchfab, Smithsonian from this environment) or real-person likeness. The
   result is a synthetic person — no publicity-rights questions — and matches
   the first market (an African male skin from the CC0 skins02 pack).
2. **Renderer:** React Three Fiber 9 + Drei 10 on three r187, loaded lazily via
   `next/dynamic` so only the studio downloads three.js.
   - Fixed camera (26° vertical FOV), framed by pure functions in
     `framing.ts` that fit width and height and keep clear of the toolbar.
   - Normaliser: orientation fix → scale to unit height → pivot at a fraction
     of the height. Generated models will store these hints per asset.
   - Lighting: procedural environment from Drei `Lightformer`s (no external
     HDR downloads), warm key, cool rim, kicker and hemisphere fill; Khronos
     PBR Neutral tone mapping for faithful skin hues; contact shadow.
   - `frameloop="demand"`, DPR 1–2, transparent canvas over the Scene
     background, Draco/meshopt decoders disabled (no third-party CDN code).
   - Loading progress, error boundary with retry (clears the loader cache),
     WebGL detection fallback, GPU resource disposal on unmount and only one
     model kept in the loader cache.
   - Original materials are kept on `mesh.userData.originalMaterial` so
     Milestone 4 can switch presets without reloading geometry.

## Consequences

- The sample's hair is a simple card-based proxy; it is acceptable for a
  sample but not representative of reconstruction quality.
- The bundle for the studio grows by roughly 1 MB of JavaScript (uncompressed)
  plus the 1.8 MB model; the dashboard is unaffected.
- R3F 9.8 logs a `THREE.Clock` deprecation warning with three r187. It is a
  warning from the library, not an application error.
