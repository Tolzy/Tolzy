# ADR 0005 — Material presets, lighting rigs and theme scope

Date: 2026-10-31 · Status: Accepted in part — materials and lighting as built; theme scope extended by ADR 0006 (Milestone 4 re-opened)

## Materials

**Decision.** Presets are data (`src/lib/studio/materials.ts`) applied to the
loaded model by a `MaterialSystem` (`src/components/viewer/material-system.ts`).
Nothing in either is specific to the sample head, so generated portraits use
the same code.

- **Originals are kept.** Each mesh's source material stays in
  `userData.originalMaterial`; Original puts those exact objects back.
  Geometry is never cloned, replaced or modified (unit and browser tests
  compare geometry identity, vertex data and a geometry key).
- **One material per (preset, source material)**, created on first use and
  updated in place afterwards: adjustments and repeated switching create no
  new materials, programs or textures (verified by GPU counters in tests).
- **Generic mesh roles** from the source material: opaque → surface;
  alpha-tested (hair cards) → cutout, keeping its silhouette through an alpha
  map built once from the texture's alpha; mostly transparent cards (brows,
  lashes) → detail, hidden under sculptural presets where they read as noise.
- **Surface detail** survives: the model's own normal map is reused at a
  per-preset strength (subtle on Glass, stronger on Ceramic).
- **Adjust** controls come from each preset's definition (tint, roughness,
  metalness for metals, lacquer for Obsidian/Ceramic, thickness for Glass).
  Choosing a preset loads its defaults; "Reset to preset" restores them.

| Preset   | Model                                                                   |
| -------- | ----------------------------------------------------------------------- |
| Chrome   | metalness 1, roughness 0.07, neutral tint                               |
| Obsidian | near-black dielectric, roughness 0.16, clearcoat 1                      |
| Ceramic  | warm white, roughness 0.45, clearcoat 0.65, light sheen                 |
| Glass    | transmission 0.9, IOR 1.5, thickness 0.45, attenuation tint, dispersion |
| Gold     | metalness 1, roughness 0.16, sRGB of gold's measured reflectance        |

**Glass and the transparent canvas.** The visible background is CSS behind a
transparent canvas (ADR 0003). three.js renders transmission against its clear
colour, which for a transparent canvas is a half-transparent white — glass
looked like pale plastic. `TransmissionBackdrop` re-draws the Scene
background (same gradient maths as the CSS) into the transmission buffer only;
on screen it writes nothing. A small diffuse share (transmission 0.9) keeps a
clear bust readable on dark backgrounds. Glass renders double-sided so the far
side is visible through the near one, and does not cast a solid shadow.

## Lighting

**Decision.** A lighting preset is a complete rig (`src/lib/studio/lighting.ts`):
direct lights (one casts a soft shadow map), a hemisphere fill and a
procedural environment — vertical-gradient "studio walls" plus Lightformer
softboxes — used for lighting and reflections only, never as the visible
background. Studio (default), Dramatic, Soft, Rim and Neutral. Intensity
scales the whole rig; rotation turns lights and environment together.

- One `<Environment>` stays mounted for the viewer's lifetime and re-renders
  in place (`frames={1}`) when the rig changes. Remounting it per preset
  leaked one GPU texture per switch: three.js does not free the PMREM map it
  derives from a render-target environment.
- No third-party HDRI CDNs. Self-hosted HDRIs remain an option for later.

## Previews

Preset tiles show real renders made by the studio itself
(`/dev/preview-renders`, development only; `scripts/render-previews.mjs`
writes `public/previews/*.webp`, ~3–6 KB each). Original shows the current
model's own thumbnail, so it stays correct for generated portraits.

## Theme scope

**Decision.** The app theme (dark default, light option, persisted) applies to
all interface chrome — navigation, top bar, inspector, rail, floating
viewport toolbar and badges, tooltips, menus, dialogs. The 3D viewport is a
photographic stage: its background, model, materials and lighting are
identical in both themes (tests compare the scene's own values in each).
Floating controls use `--float-*` tokens; `--viewport-*` tokens are reserved
for the always-dark stage. Preset preview tiles stay dark in both themes:
they are small renders of the stage, not chrome.

**Review addendum (31 Oct 2026):** the product owner reported that only a
floating Preferences panel changed theme. That panel is the Next.js Dev
Tools (development only); the app theme cannot be changed from the Studio.
Completion of the theme work stays in M4 — see ADR 0006 §7.

## Limitations

- Transmission is the most expensive material; there is no mobile quality
  switch yet (the original plan's lower-cost Glass fallback). Software
  rendering in CI is slow but stable.
- Glass refracts the Scene background colour, not the checkerboard shown for
  "Transparent" (it uses a neutral dark instead).
- Settings are held in the studio store for the session; server persistence
  arrives with the dashboard milestone (M9 after the 31 Oct renumbering).
