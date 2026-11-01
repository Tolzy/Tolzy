# Segmentation architecture (Milestone 7)

How a portrait model becomes selectable, hideable, styleable regions. The
decisions are in ADR 0008 §5–6, and the original plan is in
`docs/specs/model-parts.md`.

## Flow

```
GLB (original, unchanged)
  │  GLTFLoader → PortraitModel normalises (manifest orientation, scale, pivot)
  ▼
GeometrySystem(scene)                       components/viewer/geometry-system.ts
  │  per mesh: role (body / hair / eyes / brows / lashes / base) from name + material
  │  attributes unpacked to plain float arrays (interleaved / quantised safe)
  ▼
segmentModel(inputs)                        lib/segmentation/segment.ts  (pure TS)
  1. analyzeProfile(body vertices)          profile.ts — width/depth slices along Y:
       neck (narrowest), chin, nape, shoulders → head cut plane (throat → nape),
       shoulder cut plane (width > 1.18 × neck)
  2. cutTriangles(store, tris, plane)       cut.ts — exact split of crossing triangles,
       new vertices appended to a VertexStore (originals untouched, deduplicated)
  3. loopsFrom → outerLoops → buildCaps     boundary loops per cut, nested loops dropped,
       fan caps facing down with a skin UV; > 2 outlines → fail with reason
  4. label head triangles                   ears: lateral extremes in an ear band, largest
       connected component; face: front band; rest = head
  5. separate meshes by role                hair, eyes (left/right by side), brows, lashes
  ▼
Segmentation { ok, reason, parts[], caps[], regions[], loops }
  ▼
GeometrySystem builds one Mesh per part/cap sharing the store's buffers,
detaches the original mesh (restored on dispose), toggles visibility.
```

## Region data structure

| Field         | Where                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| `id`, `name`  | `REGION_DEFS` (`lib/segmentation/regions.ts`)                                                               |
| `parent`      | `REGION_DEFS` — `face` ⊂ `head`, eyes ⊂ `face`, `shoulders` ⊂ `bust`                                        |
| geometry refs | `Part.indices` into a per-mesh `VertexStore`; part meshes carry `userData.region`                           |
| visibility    | `GeometrySystem.show(preset, hidden)`; reasons tracked per mesh (`setHiddenBy`)                             |
| materials     | `settings.regionMaterials[id]`, inherited via `lineage(id)`, applied by `MaterialSystem`                    |
| selection     | `studio-store.selectedRegion`; viewport raycast or Model panel list; rim highlight                          |
| capabilities  | `HIDEABLE` (hair, neck, bust); `RegionDef.effects` for M8/M9; `RegionReport.available` + `reason` per model |

## Show presets

| Preset      | Hidden                | Cap shown                      |
| ----------- | --------------------- | ------------------------------ |
| Head        | neck, bust, shoulders | head cap (under the jaw)       |
| Head & neck | bust, shoulders       | shoulder cap (top of the bust) |
| Bust        | —                     | none                           |

Hiding the neck always hides the bust, so nothing floats. Hair can also be
hidden on its own when it is a separate mesh.

## Guarantees and tests

- Original vertices never move; skin surface area is preserved
  (`segment.test.ts`).
- Each cut produces one closed outline on the sample and on the fused fixture
  (`loops.head === 1`).
- Interleaved or quantised attributes give the same result
  (`geometry-system.test.ts`).
- Regions that a model doesn't have, or that can't be separated, are reported
  with a reason (“same surface”, “no distinct ear shape”), never faked.
- Browser tests cover presets, triangle counts, lossless switching, undo,
  hiding, viewport and list selection, per-region materials and unchanged
  geometry (`tests/e2e/segmentation.spec.ts`).

## Known limitations

- Two topologies tested: separate parts (sample) and a fused single mesh
  (fixture). Real provider meshes may be non-manifold or self-intersecting at
  the neck. Segmentation then refuses, with a reason, rather than producing
  holes. It does not try to repair the mesh.
- Face and ear areas come from geometric rules, not landmarks. A strongly
  turned head or an unusual crop (e.g. head only, no neck) won't segment.
- On fused meshes, hair and eyes are part of the skin surface and can't be
  separated. M8 eye glow on such models will need landmark-based eye anchors.
- Segmentation runs on every load (~0.1 s on the sample, ~1 s on the fused
  fixture in software WebGL test browsers). Caching a descriptor is the next
  step if models grow.
