# Spec — Eye effects

Milestone: **M8 — Eye Effects**. Status: planned, not implemented.
Depends on: Model Descriptor anchors (M7), effects runtime (built in M8), colour picker (M4 ✅).

## 1. Goal

Independently controllable eye illumination: on/off, colour, intensity,
radius, hover-triggered, cursor-proximity response, pulse, optional blink.

## 2. Can the eyes be addressed? (investigated 31 Oct 2026)

- **Sample head: yes.** The `Eyes` mesh contains four connected pieces: left
  and right eyeballs (276 verts each) and left and right corneas
  (268 / 256 verts). The eye texture's iris position is known from the build
  script, so iris/pupil can be isolated by UV. No eyelid geometry
  deformation is possible (no blend shapes or skeleton).
- **Generated portraits: usually no separate eye geometry.** Eye centres and
  radius come from landmarks (render-and-detect, model-parts spec §3.3) and
  are stored as anchors. Eye glow must therefore work **from anchors alone**;
  per-eye meshes are an enhancement when present.

## 3. Rendering approach (decision — ADR 0006 §5)

Two layers, both GPU-cheap and correct over the transparent canvas:

1. **Iris emission** (when eye meshes exist): MaterialSystem gains an
   "emissive layer" hook — the eye material's emissive colour/intensity is
   driven by the effect, masked to the iris by UV. Original materials stay
   untouched (same cache/restore rules as presets).
2. **Glow halo** (always): one camera-facing additive quad per eye at the
   anchor, radial falloff shader with `radius` and `intensity`, depth-tested
   against the head (soft depth fade) so it never shows through the skull.
   Works on fused meshes because it only needs the anchor.

Full-screen bloom post-processing is **not** used by default: with the CSS
background behind a transparent canvas, bloom needs premultiplied-alpha
handling and costs a full-screen pass every frame. It remains a possible
high-quality tier later.

## 4. Controls and behaviour

| Control          | Range / options                      | Notes                                                                                                                                                                                       |
| ---------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eye glow         | on/off                               | Off = no draw calls.                                                                                                                                                                        |
| Colour           | colour picker (alpha)                | Shared colour picker.                                                                                                                                                                       |
| Intensity        | 0–5                                  | Emission and halo brightness.                                                                                                                                                               |
| Radius           | 0.5–4 × eye radius                   | Halo size.                                                                                                                                                                                  |
| Trigger          | Always · On hover · Cursor proximity | Hover = pointer over the head (ray cast against the head part). Proximity = smooth curve of screen-space distance from pointer to the eyes.                                                 |
| Proximity range  | 5–60 % of viewport                   | Distance at which response starts.                                                                                                                                                          |
| Pulse            | on/off, rate 0.2–3 Hz, depth 0–100 % | Sinusoidal or "breathing" ease.                                                                                                                                                             |
| Blink            | off · glow blink                     | Glow blink = brief dim at random 3–8 s intervals. True eyelid blink only if the asset has eyelid blend shapes (`eyeBlinkLeft/Right`, ARKit naming); shown disabled with a reason otherwise. |
| Independent eyes | link/unlink left & right             | Unlinked: separate colour/intensity.                                                                                                                                                        |

Transitions (appear/disappear) reuse the effects timeline. Reduced motion:
no pulse/blink; proximity response becomes instant on/off.

## 5. Settings slice

```ts
effects.eyes = {
  enabled: boolean;
  linked: boolean;
  left: { color: Hex8; intensity: number; radius: number };
  right?: { …same };                      // when unlinked
  trigger: "always" | "hover" | "proximity";
  proximity: number;
  pulse: { enabled: boolean; rate: number; depth: number };
  blink: "off" | "glow" | "eyelid";
}
```

## 6. Acceptance

- Glow tracks the eyes through cursor tracking and drag rotation, on the
  sample and on a generated model without eye meshes.
- Hover and proximity triggers respond within one frame; no continuous
  rendering when glow is static and the pointer is still.
- Never visible through the head from behind; correct over Dark, Light,
  solid, gradient and transparent backgrounds.

## 7. Tests

Unit: proximity curve, pulse/blink timing (deterministic clock). Browser:
glow pixels at eye anchors, trigger behaviour with synthetic pointer moves,
occlusion when the head turns away, GPU counters stable.
