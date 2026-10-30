# ADR 0004 — Head interaction model and dark-first theme

Date: 2026-10-30 · Status: Accepted (Milestone 3)

## Interaction

**Decision.** The head's rotation is the sum of two independent offsets, each
driven by its own damped spring (`src/components/viewer/interaction.ts`):

```
rotation = track(pointer) + manual(drag / keyboard)
```

- **Tracking:** the pointer position, normalised to −1…1 over the viewport,
  maps through a soft curve to ±yaw/±pitch limits. Sensitivity sets how much
  pointer travel reaches the limit (65 % ≈ 95 % of the half-viewport).
  Leaving the viewport returns to neutral after the idle delay (0.6 s).
- **Manual:** dragging maps pixels to degrees (full width ≈ 220°, full height
  ≈ 90°, pitch clamped to ±30°). Releases carry a short flick. "Return" eases
  back after the idle delay; "Hold" keeps the pose. Keyboard arrows always
  hold (inspect at your own pace); Reset view (button or "0") eases to neutral.
- **No fighting:** during a drag the tracking target is frozen (its spring
  still settles, so nothing jolts); after release tracking resumes towards the
  current pointer position from the current pose.
- **Springs** (ζ ≈ 0.82, ω 5–15 rad/s from "Smoothness") give a little inertia;
  they integrate real elapsed time with fixed sub-steps, so the motion is the
  same at 8 fps or 120 fps.
- **Rendering:** only the model's parent group rotates (yaw, then pitch, around
  the normalised pivot); the camera never moves. With `frameloop="demand"`
  frames are rendered only while the springs move.
- **Input:** tracking listens on the whole viewport (moving onto the toolbar
  is not "leaving"); drag uses pointer capture and treats `pointercancel` and
  lost capture as a cancelled drag (no flick). Touch rotates by dragging
  (`touch-action: none` on the studio canvas). The surface is keyboard
  focusable with arrow-key rotation.
- **Touch:** touch drags use their own rate, `touchSensitivity`, relative to
  the mouse rate (default 55 %: a 40 % swipe turns the head ≈ 48° instead of
  ≈ 88°). Mouse and pen are unchanged. Configurable as "Touch speed" in the
  Motion panel. Springs, flick and return behave exactly as for the mouse.
- **Reduced motion:** tracking starts off, springs are critically damped and
  faster, and releases never fling. Users may still enable tracking.

**Testing hook.** The viewer mirrors the current rotation onto data attributes
of the interaction surface (`data-yaw`, `data-track-yaw`, `data-manual-yaw`, …),
updated only while moving. Browser tests assert on real values.

## Theme

**Decision.** The application is dark-first: `:root` holds the dark tokens and
`[data-theme="light"]` overrides them. Users choose Dark (default), Light or
System in **Settings → Appearance**. The choice is stored per device in
`localStorage` and applied by a tiny inline script before first paint (no
flash); it will sync to the account profile once accounts exist. The 3D
viewport keeps its own dark tokens in every theme. All component colours come
from tokens (primary, danger, soft status, segment, slider thumb, tooltip,
overlay and shadow tokens were added).
