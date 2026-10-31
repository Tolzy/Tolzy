# Spec — Model parts and the Geometry tool

Milestone: **M7** (after reconstruction in M6). Status: planned, not implemented.

## 1. Goal

Let users show **Head only**, **Head and neck**, **Full bust**, or a
**custom selection of parts**, on the sample and on AI-generated portraits —
with clean, closed geometry at every boundary, not just clipping planes.

## 2. What the current assets offer (investigated 31 Oct 2026)

Sample head (`public/models/sample-head/sample-head.glb`):

| Mesh      | Vertices | Connected pieces | Notes                                                                   |
| --------- | -------: | ---------------: | ----------------------------------------------------------------------- |
| Skin      |    4,812 |                1 | Head, neck and shoulders are **one fused surface**. Needs segmentation. |
| Base      |      108 |                1 | Flat cap closing the bust cut.                                          |
| Eyes      |    1,076 |                4 | Left/right eyeball + left/right cornea — addressable per eye.           |
| Eyebrows  |      126 |                — | Separate, alpha-blended cards.                                          |
| Eyelashes |      250 |                — | Separate, alpha-blended cards.                                          |
| Hair      |    3,177 |                — | Separate, alpha-tested cards.                                           |

No skeleton, skin weights or morph targets.

Generated portraits (from the provider research): expect a **single fused,
textured mesh** in most cases (hair and eyes baked into the surface), arbitrary
crop (head, bust or full body), and no part labels. Some avatar-style
providers export separate eyes/teeth and ARKit blend shapes; we must not
depend on that.

## 3. Approach (decision — ADR 0006 §3)

Segmentation is a **server-side pipeline stage** that runs once per model
asset and writes the result into the asset itself. The client only toggles
visibility. Clipping planes are kept only as a fallback preview when a model
could not be segmented.

### 3.1 Output format

- The GLB's fused surface is **split into glTF primitives per part**, sharing
  the original vertex buffer (no duplication, no visible seams, valid in any
  glTF viewer).
- Each boundary gets a precomputed **cap primitive** (a closed, flat or
  slightly domed patch with matching normals and UVs from the nearest
  texels), shown only when the part below it is hidden. This avoids the open
  "wedge" problem we fixed in M3.
- Metadata in the GLB (`scene.extras.portraitStudio`) and in
  `model_assets.manifest` (jsonb): parts, caps, anchors, capabilities,
  `segmentationVersion`. See ADR 0006 §2 (Model Descriptor).

### 3.2 Part vocabulary

`head` · `face` (subset of head, for future per-part materials) · `neck` ·
`shoulders` · `hair` · `eyeL` · `eyeR` · `brows` · `lashes` · `base`/caps.

| Preset        | Visible parts                                | Cap shown        |
| ------------- | -------------------------------------------- | ---------------- |
| Head only     | head, hair, eyes, brows, lashes              | neck-cut cap     |
| Head and neck | + neck                                       | shoulder-cut cap |
| Full bust     | everything                                   | base             |
| Custom        | any subset the descriptor marks as separable | caps as needed   |

### 3.3 Finding the boundaries on any model

1. **Normalise** (existing: orientation, scale, pivot).
2. **Facial landmarks by render-and-detect:** render the model from the front
   (and ¾ views) server-side or in a worker, run MediaPipe Face Landmarker on
   the renders, and unproject landmarks onto the surface by ray casting. Gives
   chin, jawline, ears, eye centres and eye radius on any textured mesh,
   independent of the provider. (MediaPipe arrives in M5 for photo checks.)
3. **Cross-section profile:** slice the mesh horizontally every few mm and
   measure circumference/width. The neck is the narrowest band between the
   chin and the shoulders; shoulders begin where width rises sharply.
4. **Cut surfaces:** head/neck boundary = a curved cut from under the chin
   (landmarks) back to the occipital base (profile); neck/shoulder boundary =
   a plane through the profile's inflection. Triangles crossing a cut are
   split exactly (the same exact-split code the sample build uses), then
   vertices are labelled by flood fill on each side.
5. **Hair, eyes, brows:** when they are separate meshes, labelled by mesh;
   when fused, eyes get **anchors only** (no geometry split); hair separation
   is attempted with texture + curvature heuristics and offered in Custom only
   if confidence is high ("where technically possible").
6. **Validation:** every part must be one watertight-with-cap region and pass
   area/vertex sanity checks; otherwise the asset is marked
   `parts: unavailable` and only Full bust (+ clipping preview) is offered.

For the **sample head**, the build script can label head/neck/shoulders from
the CC0 MakeHuman skeleton weights (to be verified at milestone start) and
emit the same primitives and metadata, so the studio code path is identical.

ML 3D part segmentation was considered and rejected for now (model size,
licences, server GPU cost); the geometric approach is deterministic,
testable and cheap.

## 4. Integration with reconstruction (M6)

- M6 builds the processing pipeline with **named stages** and a
  `pipelineVersion`: download → validate → normalise → _(segment — M7)_ →
  optimise (meshopt) → thumbnail → upload.
- M7 adds the segment stage and a **backfill job** that re-processes existing
  model assets, so portraits generated before M7 gain parts without
  regenerating (no provider cost).
- Optimisation must preserve primitive splits and extras (glTF Transform
  `weld`/`dedup` are part-aware; `simplify` runs per primitive).

## 5. Client architecture

- `lib/studio/geometry.ts` — presets, part ids, settings slice
  `geometry: { preset: "head" | "headNeck" | "bust" | "custom"; parts?: PartId[] }`.
- `components/viewer/geometry-system.ts` — reads the Model Descriptor, toggles
  primitive/cap visibility, reports visible bounds. Never edits vertices.
- Framing and the contact shadow use **visible** bounds: head-only re-frames
  the camera and moves the floor shadow to the neck cap.
- MaterialSystem stays per mesh/primitive, which later enables per-part
  materials (e.g. gold hair on an obsidian head) without new architecture.
- Effects read anchors (eyes, crown, chin, neck base) from the same descriptor.

## 6. UI

A **Model** entry on the inspector rail (icon: shapes/cube), first in order:
segmented control Head · Head & neck · Bust · Custom; Custom shows a part list
with checkboxes and hover-highlight of the part in the viewport. Unavailable
parts are disabled with a reason ("This model's hair is merged with the
head"). Transitions between presets cross-fade (dissolve shader hook shared
with the Effects "Reveal" transition).

## 7. Acceptance

- Sample and at least three generated models from the chosen provider show
  all three presets with closed caps and no seams under every material.
- Switching parts never changes vertex data (geometry key unchanged) and
  frames the visible parts correctly at 390/1024/1440 px.
- Failed segmentation degrades to Full bust with a clear message.
- Exports (M11) include only visible parts.

## 8. Tests

Unit: profile analysis and cut placement on synthetic meshes; exact triangle
split; cap generation (watertightness); descriptor parsing. Pipeline: golden
tests on the sample and recorded provider fixtures. Browser: presets toggle
real visibility, re-framing, pixel checks for caps.
