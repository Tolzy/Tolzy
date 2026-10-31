# Spec — Advanced colour picker

Milestone: **M4**. Status: **implemented** (ADR 0007) — except the viewport
sampler fallback for browsers without the EyeDropper API (deferred; the
eyedropper is hidden there). Replaces the native `<input type="color">`.

## 1. Goal

A Figma-style colour picker that edits real renderer values — material tint,
scene background, and (from M8) eye-glow and effect colours — with HEX, RGB,
HSL and HSB entry, opacity, a spectrum, hue and alpha sliders, an eyedropper,
recent colours, and copy/paste.

## 2. Anatomy

```
┌───────────────────────────────┐
│  [ spectrum: saturation × brightness (HSB) ]   ← 2D area, current hue
│                               │
├───────────────────────────────┤
│ (◉ eyedropper)  ━━━━hue━━━━━━ │
│                 ▒▒▒alpha▒▒▒▒▒ │  ← checkerboard under a transparent→colour ramp
├───────────────────────────────┤
│ [HEX ▾]  1F1F23        100 %  │  ← mode select · values · opacity
│          R 31  G 31  B 35     │  ← RGB / HSL / HSB modes show three fields
├───────────────────────────────┤
│ Recent  ■ ■ ■ ■ ■ ■ ■ ■       │
│ In this portrait  ■ ■ ■       │
└───────────────────────────────┘
```

- Trigger: the existing swatch + value row in the inspector (Tint, Background
  stops, effect colours). Clicking the swatch opens a Radix `Popover`
  (already bundled via `radix-ui`); the value text stays directly editable.
- Popover is themed with app tokens (Dark/Light); the swatch keeps a
  checkerboard behind translucent colours.
- On phones the popover becomes a bottom sheet with the same content.

## 3. Colour model (decision — ADR 0006 §4)

- **Stored value:** sRGB hex string, `#RRGGBB` or `#RRGGBBAA` (8-digit only
  when alpha < 1). Compact, CSS-valid, diff-friendly, and what the Zod schema
  validates. Existing `#RRGGBB` settings stay valid.
- **HSB/HSL/RGB are views.** Conversions live in `lib/color/` (pure,
  unit-tested; no dependency needed — the maths is small).
- **Hue stability:** while the popover is open the picker keeps its own HSB
  state, so dragging to grey or black does not reset hue/saturation (Figma
  behaviour). Only the hex value is committed.
- **Renderer boundary:** conversion to three.js happens in one place
  (`toThreeColor(hex) → { color: Color (linear), alpha }`), so the panels never
  deal with colour spaces.

## 4. Inputs and behaviour

| Feature          | Behaviour                                                                                                                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spectrum         | Pointer drag with capture; arrow keys move 1 % (Shift 10 %). Exposed as two sliders for assistive tech ("Saturation", "Brightness") with `aria-valuetext`.                                                                                              |
| Hue slider       | 0–360°, rainbow track; arrows 1° (Shift 10°).                                                                                                                                                                                                           |
| Alpha slider     | 0–100 %, checkerboard under a transparent → opaque ramp of the current colour. Hidden when the target has no alpha (§5).                                                                                                                                |
| Modes            | HEX · RGB · HSL · HSB (select). Fields accept typing, ↑/↓ steps, and drag-to-scrub on the field label. Invalid input reverts on blur.                                                                                                                   |
| Eyedropper       | Chromium: native `EyeDropper` API (whole screen). Everywhere else, and as an explicit "Pick from viewport" option: sample the rendered 3D canvas at the pointer (one frame rendered and read back with `readPixels`). Hidden when neither is available. |
| Recent colours   | Last 12 committed colours, de-duplicated, newest first. Stored per browser (`localStorage`, wrapped in try/catch) until accounts exist; per account from M9.                                                                                            |
| In this portrait | Colours currently used by the portrait's settings (tint, background, effects).                                                                                                                                                                          |
| Copy             | Copies the value in the active mode (`#1F1F23`, `rgb(31 31 35)`, `hsl(…)`, `hsb(…)`), with alpha when < 1.                                                                                                                                              |
| Paste            | Accepts 3/4/6/8-digit hex (with or without `#`), `rgb()/rgba()`, `hsl()/hsla()`, `hsb()/hsv()`, CSS named colours. Works by keyboard (⌘/Ctrl+V in the value field) and a Paste button.                                                                  |
| Undo             | Dragging is one undo step (uses the store's existing drag/commit split).                                                                                                                                                                                |

Viewport sampling returns the **lit, tone-mapped** colour on screen, not the
material's base colour; the UI says "Picks the colour as rendered".

## 5. Targets and what alpha means

| Target                                          | Alpha         | Renderer effect                                                                         |
| ----------------------------------------------- | ------------- | --------------------------------------------------------------------------------------- |
| Material tint (Chrome, Obsidian, Ceramic, Gold) | No (as built) | Opacity is a separate **Opacity** slider (0–100 %, depth pre-pass), per the M4 brief.   |
| Glass tint                                      | No            | Absorption colour (transmission already provides see-through).                          |
| Background solid / gradient stops               | Yes           | CSS background over the checkerboard; glass backdrop and PNG export use the same value. |
| Eye glow, effect colours (M8)                   | Yes           | Shader uniforms (`vec4`), premultiplied at the boundary.                                |

## 6. Architecture

```
lib/color/            convert.ts (hex⇄rgb⇄hsl⇄hsb), parse.ts (paste), format.ts, three.ts (toThreeColor)
components/ui/color/  ColorPicker (popover/sheet), Spectrum, HueSlider, AlphaSlider, ColorInputs,
                      Eyedropper, Swatches; ColorField becomes the trigger row
stores/recent-colors.ts  small Zustand store with guarded localStorage persistence
components/viewer/     viewport colour sampler (exposed through a ref on the viewer)
```

No new npm dependencies. (`react-colorful`, 2.8 KB, MIT, was considered;
rejected because its fixed UI does not fit the design system and it lacks
modes, alpha checkerboard, eyedropper and swatches.)

## 7. Acceptance

- Every mode round-trips (hex → mode → hex) without drift; hue survives
  greys/black while editing.
- Changing tint, opacity and background through the picker updates the real
  renderer immediately (verified on viewer data attributes and pixels).
- Eyedropper works in Chromium; viewport sampler works in all supported
  browsers; the control is hidden where unsupported.
- Recent colours persist across reloads; copy/paste works for all listed
  formats; full keyboard operation; axe clean in Dark and Light.

## 8. Tests

Unit: conversions (property tests across the colour cube), parser (valid and
invalid inputs), formatting, hue stability. Browser: picker drives material
tint/opacity and background on the renderer; alpha checkerboard visible;
paste and copy; keyboard-only flow; theme screenshots.
