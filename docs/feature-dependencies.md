# Feature dependencies

How the planned features depend on each other and on milestones. Arrows point
from a prerequisite to what needs it. See ADR 0006 for the shared
architecture and `docs/specs/` for each feature.

```mermaid
flowchart LR
  subgraph M4["M4 · Materials, lighting, colour, theme ✅"]
    T[Theme in every surface ✅]
    C[Advanced colour picker ✅]
    MS[MaterialSystem ✅]
    LR[Lighting rigs ✅]
  end
  subgraph M5["M5 · Photo upload and validation"]
    MP[MediaPipe Face Landmarker ✅]
  end
  subgraph M6["M6 · Reconstruction"]
    PL[Versioned asset pipeline]
  end
  subgraph M7["M7 · Model parts"]
    SEG[Segmentation stage + backfill]
    MD[Model Descriptor: parts + anchors]
    GEO[Geometry tool]
  end
  subgraph M8["M8 · Eye Effects"]
    RT[Effects runtime + scheduler]
    EYE[Eye effects]
  end
  subgraph M9["M9 · Effects Studio"]
    FX[Smoke · particles · fog · glow · trails]
    TL[Transitions + triggers]
  end
  subgraph Later["M10–M12"]
    PER[Settings schema v2 + persistence]
    EXP[Exports]
    EMB[Embeds]
  end

  C --> EYE
  C --> FX
  MS -->|emissive + dissolve hooks| EYE
  MS -->|dissolve hook| TL
  MP --> SEG
  PL --> SEG
  SEG --> MD
  MD --> GEO
  MD -->|eye anchors| EYE
  MD -->|anchors, bounds| FX
  RT --> EYE
  RT --> FX
  TL --> FX
  GEO --> EXP
  FX --> EXP
  FX --> EMB
  EYE --> EMB
  GEO --> PER
  FX --> PER
  T --> C
```

| Feature                    | Hard prerequisites                                      | Soft / nice-to-have                                     |
| -------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| Theme completion           | —                                                       | —                                                       |
| Colour picker              | Theme tokens (popover must be themed)                   | Viewer sampler for eyedropper fallback                  |
| Model parts                | Versioned pipeline (M6), MediaPipe (M5), descriptor     | Sample build labels (MakeHuman weights)                 |
| Eye effects                | Descriptor anchors (M7), effects runtime, colour picker | Eye meshes (sample), eyelid blend shapes for real blink |
| Effects Studio             | Effects runtime, colour picker, descriptor anchors      | Material dissolve hook (for Reveal)                     |
| Exports with parts/effects | Geometry tool, effects (PNG frame)                      | Video export (future)                                   |
| Embeds with effects        | Effects runtime as lazy chunk                           | Quality tiers                                           |

Order rationale: segmentation must run on real reconstruction output, so it
follows M6; eye effects need anchors that segmentation produces for
generated models, so effects follow M7. The colour picker is needed by
everything that has a colour and lands first, in M4.
