# Design system and product design

Status: Milestone 0 direction. Tokens and components are implemented and
reviewed in Milestone 1. Research basis: `research/design-references.md`.

## 1. Character

Quiet, precise, studio-grade. The interface behaves like a well-made camera
body: neutral materials, clear markings, nothing decorative. The portrait is
the only expressive element on screen.

Working name for the language: **Studio Neutral**.

## 2. Foundations

### Colour

Neutral greys with a very slight warm bias (photographic, not clinical), one
accent. Defined as CSS variables, exposed to Tailwind v4 via `@theme`.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | #FAFAF9 | #0F0F10 | App background |
| `--surface` | #FFFFFF | #161617 | Panels, inspector |
| `--surface-sunken` | #F3F3F1 | #1C1C1E | Inputs, wells |
| `--border` | #E7E6E3 | #262628 | Hairlines (1 px) |
| `--border-strong` | #D6D5D1 | #34343A | Focused inputs, dividers that must read |
| `--text` | #18181A | #EDEDEC | Primary text |
| `--text-muted` | #6B6A67 | #9A9A97 | Labels, meta |
| `--text-subtle` | #9C9B97 | #6A6A6E | Placeholders, disabled |
| `--accent` | #3E5BFF | #6F86FF | Selection, focus ring, active state — nothing else |
| `--danger` | #D43B32 | #F0675E | Destructive actions, errors |
| `--success` | #2F8F57 | #4CC07D | Passed validation checks |
| `--viewport` | #E9E8E5 → #F7F6F4 | #121214 → #1D1D20 | Default studio backdrop (radial) |

Primary buttons are `--text` on `--bg` inverted (near-black in light,
near-white in dark), not accent-coloured. No gradients in UI chrome; the only
gradient is the optional viewport backdrop.

### Typography

- **Geist Sans** (SIL OFL) for UI, **Geist Mono** for numeric values in the
  inspector (tabular, aligned). Self-hosted via `next/font`.
- Scale (px / line-height): 11/16 · 12/16 · 13/20 · 14/20 · 16/24 · 20/28 ·
  28/34 · 40/44.
- Inspector: 12 px labels (muted), 12–13 px values. Page titles: 28 px,
  weight 600, −0.01 em tracking.
- Weights: 400 and 500 for UI, 600 for headings. No bold body text.

### Spacing, radius, elevation

- 4 px base grid; common steps 4, 8, 12, 16, 24, 32, 48, 64.
- Radius: 6 px (controls), 8 px (menus, popovers), 12 px (dialogs, thumbnails).
  No pill-shaped containers except tags and the floating viewport toolbar.
- Elevation: hairline borders by default. Shadow only for floating layers
  (menus, toolbar, dialogs): one soft shadow token.

### Motion

- Durations: 120 ms (hover, press), 180 ms (panels, popovers), 240 ms (dialogs).
- Easing: `cubic-bezier(0.2, 0, 0, 1)` for enter, linear-ish for exit.
- UI never animates layout for decoration. The 3D head is the only thing that
  moves continuously. All motion respects `prefers-reduced-motion`.

### Iconography

Lucide icons at 16 px, 1.5 px stroke, `--text-muted` by default.

## 3. Core components (Milestone 1)

Button (primary / secondary / ghost / danger; sm 28 px, md 32 px, lg 40 px),
IconButton, Field row (label + control), NumberInput with scrub-on-drag label,
Slider (with numeric value), SegmentedControl, Switch, Select, ColorField,
SwatchGrid (visual preset picker), Disclosure section, Tabs / Context rail,
Tooltip with keyboard shortcut, Menu, Dialog, Toast, Progress (linear +
stage list), EmptyState, Skeleton, ThumbnailCard.

All built on Radix primitives for focus management, keyboard support and ARIA.
Visible focus ring: 2 px `--accent` with 2 px offset.

## 4. Screens

### Application shell

- Left sidebar, 232 px, collapsible: workspace/account menu, **New portrait**
  (primary), Home, Projects (expandable list), Settings. No promotional slots.
- Command/search (`⌘K`) in the sidebar header.

### Dashboard

- Page title "Portraits", filter chips (All · Ready · Generating · Failed),
  sort (Last edited), grid/list toggle.
- Grid of 4:5 portrait thumbnails (rendered PNGs, neutral backdrop). Each card:
  thumbnail, name, one meta line ("Edited 2 h ago · Chrome"). Status overlays
  only when not ready (spinner + "Generating", or "Failed — Retry").
- First tile: "New portrait" (dashed hairline).
- Card menu: Open, Rename, Move to project, Duplicate settings, Download GLB,
  Delete (separated, red, confirm dialog).
- Empty state: one sentence, one primary action, a short note on what makes a
  good photo.

### Create portrait (focused, full-page flow)

Two steps, no wizard chrome beyond a step indicator.

1. **Photo.** Large drop zone with a face silhouette. Requirements stated
   before upload (JPG/PNG/WebP/HEIC, ≤ 20 MB, ≥ 1024 px short edge, one face,
   facing camera, even light, no sunglasses/hats). After drop, a live checklist
   appears beside the image: *Face detected · Single person · Facing camera ·
   Sharp · Well lit · Resolution*. Each item passes, warns (can proceed) or
   fails (blocks) with a one-line fix.
   Optional **More angles**: collapsible row of slots (Left 3/4, Right 3/4,
   Left profile, Right profile) with explanation that extra angles improve
   side views.
   Consent block: plain-language disclosure of external AI processing,
   retention period, and "never used for training", with a required checkbox
   ("I am this person or have their permission").
2. **Generating.** Stage list (Uploading → Queued → Reconstructing →
   Optimising → Ready) with honest time range, "You can leave this page — we'll
   keep working" and an opt-in browser notification. On failure: plain cause,
   **Try again** and **Use a different photo**.

### Studio (3D editor)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ←  Project / Portrait name ▾      Saved            Share   [ Export ▾ ]  │  48 px top bar
├──────────────────────────────────────────────────────────┬──┬────────────┤
│                                                          │M │ Material   │
│                                                          │L │ ┌──┬──┬──┐ │
│                   3D viewport (full-bleed)               │S │ │  │  │  │ │  swatch grid
│                                                          │I │ └──┴──┴──┘ │
│                                                          │E │ ▸ Adjust   │
│                                                          │  │            │
│              ┌─────────────────────────────┐             │  │            │
│              │ ⟲  − 100% +   ◎ Tracking  ⤢ │             │  │            │
└──────────────┴─────────────────────────────┴─────────────┴──┴────────────┘
                floating toolbar                      rail   inspector 280 px
```

- **Context rail** (M Material, L Light, S Scene/background, I Interaction,
  E Export). One inspector context visible at a time.
- Each context opens on presets: Material → six rendered spheres;
  Light → five lighting thumbnails; Scene → background swatches + transparent;
  Interaction → Tracking on/off, limits, sensitivity, damping, return delay,
  drag behaviour, with a "Try it" hint over the viewport.
- **Adjust** disclosure reveals numeric controls (roughness, intensity,
  environment rotation, colour override).
- Floating toolbar: Reset view, zoom −/value/+, Tracking toggle, Fullscreen.
- Inspector collapses (`\`) for a clean preview; on narrow screens it becomes
  a bottom sheet with the rail as tabs.
- Autosave of settings (debounced 800 ms) with "Saving… / Saved" in the top
  bar; undo/redo (`⌘Z` / `⇧⌘Z`) over settings changes.

### Export and publish

- **Export menu:** Download GLB (original), Download GLB (with material),
  Render PNG… (dialog: size 1×/2×/4×, transparent background toggle, preview).
- **Share dialog:** two tiles — *Private* (default, "Only you") and *Public
  embed* ("Anyone with the link or embed can view this 3D portrait"). Choosing
  Public requires confirming; then shows link, iframe snippet with copy
  buttons, size presets, live preview with Desktop/Mobile toggle, and **Stop
  sharing**.

## 5. Accessibility baseline

WCAG 2.2 AA: contrast ≥ 4.5:1 for text (muted label tokens checked), full
keyboard operation including the viewport (focusable, arrow-key rotation),
`aria-live` announcements for generation progress and save state, reduced
motion respected, 3D canvas has an accessible name and text description,
touch targets ≥ 24 px (44 px on touch layouts).

## 6. Explicitly avoided

Promotional banners, decorative statistics, glassmorphism, multi-colour
accents, gradient buttons, card-in-card layouts, always-visible advanced
parameters, spinner-only loading without stage information.
