# FrenchLens motion system

Motion in FrenchLens is a design-system layer, like colour and type. Screens
never choose curves or durations; they state an **intent** and use shared
**primitives**. Everything lives in `Shared/DesignSystem/Motion` and is
compiled into both the app and the Share Extension.

Principles: quiet, spring-based, intentional. Motion explains change (where
something came from, what replaced what); it never decorates. Everything
honours **Reduce Motion**, and UI tests run with motion off
(`MotionRuntime.isDisabled`).

## Intents — `MotionToken`

| Token      | Use                                   | Curve                        | Reduce Motion        |
| ---------- | ------------------------------------- | ---------------------------- | -------------------- |
| `tap`      | Pressed states, toggles               | spring 0.22 s, no bounce     | 0.2 s fade           |
| `select`   | Selection moving between options      | spring 0.38 s, bounce 0.12   | 0.2 s fade           |
| `reveal`   | Content entering                      | spring 0.60 s, no bounce     | 0.2 s fade           |
| `panel`    | Floating surfaces                     | spring 0.46 s, bounce 0.16   | 0.2 s fade           |
| `swap`     | Content replaced in place             | spring 0.34 s, no bounce     | 0.2 s fade           |
| `emphasis` | Acknowledgement beats (saved, correct)| spring 0.42 s, bounce 0.38   | none                 |
| `ambient`  | Slow loops                            | ease 1.6 s                   | none (loops paused)  |

API: `@Environment(\.motion) var motion` → `motion.perform(.panel) { … }`,
`.flAnimation(.swap, value: x)`, `motion.loop(duration:) { … }`.
Install once per root with `.motionEnvironment()`.

## Primitives

| Primitive | API | Technique |
| --- | --- | --- |
| Reveal / Panel / Slide / Swap transitions | `.transition(.flReveal)`, `.flPanel`, `.flSlide(direction:)`, `.flSwap` | iOS 17 `Transition` protocol; each reads Reduce Motion itself |
| Staggered entrance | `.flAppear(order)` | Reading-order choreography, capped at 0.42 s |
| Pop / shake | `.flPop(trigger:tilt:)`, `.flShake(trigger:)` | `keyframeAnimator` |
| Lens pulse | `LensPulse()` | `PhaseAnimator` (rest → focus → release) |
| Drawn checkmark | `DrawnCheckmark()` | Trimmed shapes, sequenced |
| Shimmer | `.flShimmer()` | Ambient sweep (paused under Reduce Motion) |
| Toast | `.flToast($message)` | Panel transition + auto-dismiss + VoiceOver announcement |
| Viewport focus | `.flScrollFocus()` | `scrollTransition` |
| Stretchy / parallax hero | `.flStretchyHeader(height:)` | `visualEffect` + `.scrollView` coordinate space |
| Collapsing title | `.flOnScrollOffsetChange`, `ScrollProgress`, `CollapsingTopBar` | Continuous, finger-locked progress |
| Matched geometry | `.flMatchedGeometry(id:in:)` | Off under Reduce Motion |
| Zoom navigation | `.flZoomSource`, `.flZoomDestination` | iOS 18 `navigationTransition(.zoom)`; no-op on 17 |
| Press feedback | `.buttonStyle(.flPressable)` | Spring compression + highlight |
| Haptics | `.flHaptic(.lookup, trigger:)` | Semantic events → `SensoryFeedback` |

## Choreography by screen

- **Home** — brand, greeting, CTA and lessons assemble in reading order; the greeting recedes and hands off to a collapsing bar as you scroll; rows press, soften at the viewport edges, and zoom into the lesson (iOS 18).
- **Lesson** — hero stretches/parallaxes; header, sentences and sections assemble in order; the title fades into the navigation bar in lockstep with the scroll; sections slide from the direction of travel.
- **Transcript** — the blue highlight *travels* between tapped words; the word panel lifts in and its contents blur-swap as you move between words, while the surface springs to its new height; drag down to dismiss (rubber-banded). During playback a thin accent rule glides under each spoken word and other sentences recede.
- **Save** — bookmark symbol replaces and pops with a tilt, a haptic plays, and "Saved to Library" floats in (announced to VoiceOver).
- **Processing** — lens pulses; each finished stage's dot becomes a check; on completion the title swaps, the line fills, a checkmark draws itself, the moment holds (0.7 s) and the lesson takes over underneath the cover.
- **Review** — cards slide forward, options arrive in order, a right answer pops and a wrong one shakes (with success/error haptics), the explanation rises in, and the final score counts up.
- **Share Extension** — lens pulses while reading the share; success draws a checkmark and the copy rises in.

**Settings → Motion** is a live lab of every intent and primitive.

## Figma mapping

Tokens map 1:1 to Figma prototype "Spring" presets (duration + bounce) or
Smart Animate curves; transitions map to component variants (`appearing`,
`identity`, `disappearing`). Retuning a token retunes every screen.
