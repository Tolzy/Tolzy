# Reconstruction provider comparison (Milestone 6)

Status: **comparison complete as desk research; no provider selected.**
Nothing has been sent to any external provider and no money has been spent.
The decision needs a paid hands-on benchmark, which needs product-owner
approval (see §7). Until then the app runs on a development fixture, and the
Meshy adapter exists but is switched off (§6).

This document supersedes the shortlist in
[`reconstruction-providers.md`](reconstruction-providers.md) (Milestone 0), which
keeps the evaluation criteria, weights and bake-off protocol.

Legend: ✅ documented by the provider · ◐ third-party or partial evidence ·
❓ unknown until tested or asked · ⛔ disqualifying for production as-is.

## 1. Candidates

| Group                          | Candidate                                              | Access                           |
| ------------------------------ | ------------------------------------------------------ | -------------------------------- |
| General image-to-3D API        | **Meshy** (Multi-Image to 3D, meshy-7.1)               | Hosted REST API                  |
| General image-to-3D API        | **Tripo AI** (image / multiview to model)              | Hosted REST API                  |
| General image-to-3D API        | **Hyper3D Rodin** (Gen-2 / 2.5)                        | Hosted REST API, also fal.ai     |
| Dedicated facial/head          | **Avatar SDK (MetaPerson)**                            | Hosted API (Enterprise), on-prem |
| Dedicated facial/head          | **Avaturn** and similar photo-to-avatar services       | Hosted (API terms unverified)    |
| Open weights (custom pipeline) | **TRELLIS.2** (Microsoft), **Hunyuan3D 2.x** (Tencent) | Self-host on GPUs                |
| Research face models           | **DECA, EMOCA, MICA** (FLAME-based)                    | Research code                    |
| Parametric head model          | **FLAME** (2023 Open release, CC BY 4.0) + own fitting | Self-host                        |

## 2. Comparison

| Criterion                                            | Meshy                                                                                                                | Tripo                                                          | Rodin                                                | Avatar SDK                                | TRELLIS.2 / Hunyuan3D (self-host)                                                                                                              | DECA / EMOCA                                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Facial likeness**                                  | ❓ general model; tends to "average" faces (◐)                                                                       | ❓ same family as Meshy                                        | ❓ rated highest for detail (◐), not tested on faces | ◐ built for recognisable faces            | ❓ general models                                                                                                                              | ◐ strong identity geometry                                                            |
| **Geometry**                                         | ✅ triangle mesh, optional remesh; fused single mesh (hair = surface)                                                | ◐ clean topology reported                                      | ◐ quad mesh option                                   | ✅ rigged template mesh, blendshapes      | ❓ marching-cubes style meshes, needs cleanup                                                                                                  | face-only mesh (FLAME)                                                                |
| **Texture**                                          | ✅ PBR, 2K–8K options                                                                                                | ◐ PBR                                                          | ◐ PBR, highest fidelity reported                     | ◐ stylised-to-realistic skins             | ◐ baked colour                                                                                                                                 | albedo only, face area                                                                |
| **Completeness** (hair, ears, back, neck, shoulders) | ◐ whole object incl. hair and shoulders; unseen sides invented                                                       | ◐ whole object                                                 | ◐ whole object                                       | ◐ head + template body; hair from library | ◐ whole object                                                                                                                                 | ⛔ face only, no hair or back                                                         |
| **Multi-view input**                                 | ✅ 1–4 images, front first                                                                                           | ◐ "multiview to model" endpoint; docs not readable from here   | ◐ multiple images supported (◐)                      | ❓ single photo documented                | ◐ TRELLIS supports multi-image conditioning                                                                                                    | single image                                                                          |
| **Output**                                           | ✅ GLB / FBX / OBJ / USDZ                                                                                            | ◐ GLB and others                                               | ◐ GLB / OBJ / FBX / USDZ / STL                       | ✅ GLB / glTF / FBX                       | GLB via own export                                                                                                                             | OBJ / own export                                                                      |
| **Performance**                                      | ◐ minutes per task                                                                                                   | ◐ fastest of the hosted APIs                                   | ◐ 2–5 min                                            | ❓                                        | depends on GPU; ~1 min on A100-class (◐)                                                                                                       | seconds on GPU                                                                        |
| **Cost per portrait** (§5)                           | ◐ ≈ 30 credits textured ≈ $0.30–$0.60                                                                                | ◐ ≈ $0.10–$0.30                                                | ◐ ≈ $0.40–$1.50 + $120/mo plan for API               | ❓ Enterprise quote                       | GPU time ≈ $0.05–$0.30 + always-on/ops cost                                                                                                    | n/a (not commercial)                                                                  |
| **Licensing / output rights**                        | ◐ paid plans own outputs; confirm API terms and DPA in writing                                                       | ◐ free-tier output CC BY non-commercial; paid tiers commercial | ◐ commercial on paid plans; confirm                  | ❓ Enterprise contract                    | ⛔ TRELLIS.2: nvdiffrast dependency is NVIDIA non-commercial. ⛔ Hunyuan3D: licence excludes EU, UK, South Korea; approval above MAU threshold | ⛔ non-commercial research licences; FLAME needs MPI licence for the original release |
| **Data handling**                                    | ❓ privacy policy covers uploads; training/retention for API inputs not stated; deletion endpoint ✅ (`DELETE` task) | ❓                                                             | ❓                                                   | ❓ (on-prem option removes transfer)      | ✅ stays on our infrastructure                                                                                                                 | ✅                                                                                    |
| **Scalability**                                      | ✅ managed; rate limits per plan                                                                                     | ✅ managed                                                     | ✅ managed                                           | ✅ managed or on-prem                     | ⚠ we operate GPUs, queues and autoscaling                                                                                                      | n/a                                                                                   |
| **Data location**                                    | United States (cross-border transfer from Nigeria)                                                                   | ❓ (China/Singapore entity — confirm)                          | ❓                                                   | ❓ / on-prem possible                     | our choice of region                                                                                                                           | our choice                                                                            |

### Notes per candidate

- **Meshy** — the only provider whose API we could read in full: Multi-Image to
  3D takes 1–4 images (front first), returns status values PENDING /
  IN_PROGRESS / SUCCEEDED / FAILED / CANCELED with a progress percentage and
  signed model URLs, and supports deleting tasks. That is why the first real
  adapter targets it. It is a general object model: hair, face and clothes come
  back as **one fused surface**, so hair and eyes cannot be separate parts
  (Milestone 7 reports this instead of faking it).
- **Tripo** — cheapest and fastest by third-party reports, with a multiview
  endpoint. Its API documentation could not be read from this environment, so
  **no adapter was written**; free-tier outputs are reportedly CC BY
  non-commercial, so only paid output may be used.
- **Rodin** — best detail in reviews; API needs the Business plan
  (~$120/month) on top of per-generation cost. Strong candidate for the
  benchmark's quality ceiling.
- **Avatar SDK / dedicated facial solutions** — likely the best likeness of the
  face, but hair comes from a library and output is an avatar template. Pricing
  is by Enterprise contract. Worth requesting a trial and DPA.
- **Custom pipeline (open weights)** — avoids sending biometric data abroad and
  can be cheapest at scale, but: TRELLIS.2's rendering dependency
  (nvdiffrast) carries NVIDIA's non-commercial licence, and Hunyuan3D's licence
  excludes the EU, UK and South Korea. Both need legal review before any
  production use, plus GPU operations we don't have yet.
- **DECA / EMOCA / MICA** — research code under non-commercial licences, built
  on FLAME. **Excluded from production** (user requirement). FLAME's 2023 open
  release (CC BY 4.0) could underpin a future custom face-fitting step, but
  each fitting codebase still needs its own licence review, and FLAME models
  the face/skull only — no hair.

## 3. Hard gates (pass/fail before any production use)

1. Commercial use of outputs allowed, users own their models. → Meshy, Tripo,
   Rodin: verify contract wording. Open models: blocked pending legal review.
2. No training on user photos or models without separate consent. → **no
   hosted provider has confirmed this in writing yet.**
3. Deletion of inputs and outputs on request, with a stated retention period.
   → Meshy: deletion endpoint exists; retention not stated.
4. A Data Processing Agreement and a lawful basis for transferring facial
   images out of Nigeria (NDPA 2023, §7).
5. No research-only or non-commercial component anywhere in the pipeline.

## 4. Recommendation

1. **Do not select a provider yet.** None has passed gates 2–4.
2. **Shortlist for a paid benchmark:** Meshy (multi-image), Rodin (quality
   ceiling) and Tripo (cost floor), plus Avatar SDK if it grants a trial. Run
   the protocol in `reconstruction-providers.md` §5 on 8–12 consenting
   volunteers, front + optional angles, and score with the weighted criteria.
3. **In parallel, send the written questions** (training, retention, deletion,
   DPA, data location, output rights) to each shortlisted provider.
4. **Architecture is already provider-independent** (ADR 0008): adding Tripo or
   Rodin is one adapter file plus tests; the job pipeline, validation,
   normalisation, segmentation and Studio don't change.
5. A **custom pipeline** is the long-term option for cost and data residency,
   but only after legal clearance of every component.

## 5. Cost estimates

Per-portrait figures are estimates from public pricing pages and third-party
reviews (prices change; confirm before approval). One portrait = one
multi-image generation with texture.

| Provider    | Per portrait (est.) | Fixed cost              | 1,000 portraits/month  | 10,000/month |
| ----------- | ------------------- | ----------------------- | ---------------------- | ------------ |
| Meshy       | $0.30–$0.60         | API plan (from ~$20/mo) | ~$320–$620             | ~$3k–$6k     |
| Tripo       | $0.10–$0.30         | prepaid credits         | ~$100–$300             | ~$1k–$3k     |
| Rodin       | $0.40–$1.50         | ~$120/mo Business       | ~$520–$1,620           | ~$4k–$15k    |
| Avatar SDK  | quote               | Enterprise              | —                      | —            |
| Self-hosted | $0.05–$0.30 GPU     | GPUs idle + ops         | depends on utilisation | —            |

Retries add cost: the pipeline allows at most 3 attempts per job, and failed
provider tasks are usually not charged (confirm per provider). **Benchmark
budget:** ~12 subjects × 4 providers × 2 input modes ≈ 96 generations ≈
**$50–$150** plus one month of any required plan (Rodin ~$120). Needs approval.

## 6. What exists in code

| Piece                                           | Status                                                                                                                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider interface, registry, job pipeline      | Implemented and tested                                                                                                                                                                         |
| Development fixture provider (no external call) | Implemented; development and tests only, refused on hosted deployments                                                                                                                         |
| Meshy adapter                                   | Implemented against the published API, unit-tested with mocked responses; **never called live**; disabled unless `RECONSTRUCTION_API_KEY` **and** `RECONSTRUCTION_PROVIDER_APPROVED=1` are set |
| Tripo / Rodin / Avatar SDK adapters             | Not written (awaiting benchmark decision)                                                                                                                                                      |

## 7. Decisions needed from the product owner

1. Approve the benchmark budget (~$50–$150 + possibly one Rodin month).
2. Approve contacting providers for DPAs and written data-handling answers.
3. After the benchmark: choose the provider and approve production spending.

## Sources

- [Meshy API — Multi-Image to 3D](https://docs.meshy.ai/api/multi-image-to-3d)
- [Meshy API — Pricing](https://docs.meshy.ai/en/api/pricing)
- [Meshy — Multi-view image to 3D guide](https://www.meshy.ai/tutorials/multi-view-image-to-3d)
- [3D AI Studio — Best 3D model generation APIs 2026](https://www.3daistudio.com/blog/best-3d-model-generation-apis-2026)
- [Pixazo — closed-source 3D generation APIs](https://www.pixazo.ai/blog/best-closed-source-3d-model-generation-apis)
- [Makerstack — Rodin review](https://makerstack.co/reviews/hyper3d-rodin-review/)
- [Avatar SDK — Avatar API](https://avatarsdk.com/avatar-api/)
- [microsoft/TRELLIS issue #298 (licensing)](https://github.com/microsoft/TRELLIS/issues/298)
- [Hunyuan3D-2 licence](https://huggingface.co/tencent/Hunyuan3D-2/commit/61f7f039268937ff365927372b4f2f5c9f486792)
- [FLAME-Universe](https://github.com/TimoBolkart/FLAME-Universe)
- Earlier sources: [`reconstruction-providers.md`](reconstruction-providers.md)
