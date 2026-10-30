# AI reconstruction: provider evaluation

Status: Milestone 0 — **desk research only**. No provider has been tested yet.
The paid bake-off budget is **not approved** (ADR 0002); no paid plan may be
purchased without the product owner's approval.
The decision is deferred to a hands-on bake-off (section 5) that must finish
before Milestone 6. Nothing in the codebase may hard-code a provider.

## 1. Why this is the highest product risk

The product promise is _likeness_: the person must be recognisable from the
front, three-quarter and side views, with their hairstyle. Two families of
technology exist, and each solves only part of the problem:

| Family                                                                       | Strength                                                                    | Typical weakness                                                                                        |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Dedicated face/head reconstruction** (parametric head models, avatar SDKs) | Identity-preserving facial geometry, clean topology, correct ears and skull | Hair is often a template or missing; stylised textures; neck/shoulders generic                          |
| **General image-to-3D** (large reconstruction / diffusion models)            | Complete object including hair, clothes, shoulders; photoreal textures      | Face drifts toward a "generic attractive" average; back of head hallucinated; asymmetry and melted ears |

A single front-facing photo leaves the side and back unobserved, so every
system _invents_ those regions. Optional extra angles reduce invention and
should be supported by the abstraction from day one.

## 2. Candidates found

| Candidate                                             | Family                          | Output                                    | What the research says                                                                                                                   | Open questions                                                                         |
| ----------------------------------------------------- | ------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Avatar SDK — MetaPerson / Avatar API**              | Dedicated head/avatar           | Rigged GLB/glTF, FBX, facial blendshapes  | REST API, one frontal photo → recognisable avatar; API on Enterprise plan; cloud or on-prem                                              | Price, hair quality, whether head-only crop is available, licence for end-user exports |
| **Hyper3D Rodin (Gen-2 / 2.5)**                       | General image-to-3D             | GLB, OBJ, FBX, USDZ, STL; quad mesh + PBR | Rated highest for detail by reviewers; API from Business plan (~$120/mo), ~$0.40–$1.50 per model; 2–5 min per generation; also on fal.ai | Facial likeness untested; multi-image input support                                    |
| **Tripo (Tripo3D)**                                   | General image-to-3D             | GLB and others                            | Cheaper and faster (~$0.05–$0.30 per model); clean topology                                                                              | Lower top-end fidelity; likeness untested                                              |
| **Meshy**                                             | General image-to-3D             | GLB, FBX, OBJ                             | Documented image-to-3D API; avatar marketing is stylised characters                                                                      | Not positioned for real-person likeness                                                |
| **TRELLIS.2 (Microsoft)**                             | Open model, self-host           | Mesh / GLB                                | MIT for model + code, but rendering deps (nvdiffrast) carry an NVIDIA non-commercial licence — must be resolved                          | GPU hosting cost, ops burden                                                           |
| **Hunyuan3D 2.x (Tencent)**                           | Open model, self-host or hosted | Mesh / GLB                                | Community licence **excludes EU, UK and South Korea**; approval needed above an MAU threshold                                            | Territorial exclusion likely disqualifying for a global product                        |
| **FLAME-based research (DECA, MICA, PercHead, etc.)** | Parametric face/head            | Mesh                                      | Strong identity geometry                                                                                                                 | FLAME is **non-commercial** without an MPI licence; hair not modelled; research code   |
| Ready Player Me                                       | Avatar platform                 | GLB                                       | Docs found cover fetching existing avatars only                                                                                          | Stylised; not a likeness tool. Low priority                                            |

Unverified in this research (search returned nothing usable): Avaturn and other
photo-to-avatar services. They should be added to the bake-off if they still
offer an API.

## 3. Evaluation criteria and weights

| Criterion                                                  | Weight | How measured                                                                        |
| ---------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| Facial likeness                                            | 30 %   | Blind human panel (1–5) + face-embedding similarity between photo and renders       |
| Side / three-quarter fidelity                              | 15 %   | Panel rating against held-out side photos                                           |
| Hairstyle preservation                                     | 10 %   | Panel rating                                                                        |
| Complete head (scalp, ears, back, neck to upper shoulders) | 10 %   | Checklist; manual inspection in the viewer                                          |
| Geometry quality                                           | 10 %   | Manifold check, triangle count, artefacts, normals                                  |
| Texture quality                                            | 5 %    | Resolution, seams, baked lighting                                                   |
| Processing time                                            | 5 %    | p50 / p95 wall-clock                                                                |
| GLB compatibility                                          | 5 %    | Loads in our viewer; survives glTF Transform pipeline                               |
| Commercial licensing                                       | gate   | Pass/fail: must permit commercial SaaS use and user ownership of outputs            |
| Data handling                                              | gate   | Pass/fail: no training on uploads (or opt-out), deletion API or retention guarantee |
| Cost                                                       | 10 %   | Per-portrait cost at expected volume                                                |

Licensing and data handling are **gates**: a provider that fails either is
excluded regardless of score.

## 4. Likely architecture outcome (hypothesis, to be validated)

The most probable winning setup is not a single API but a **pipeline**:

1. Head-specialised reconstruction for the face region, _or_
2. A general model fed with optional extra angles, _followed by_
3. Our own post-processing: crop at upper shoulders, re-centre pivot, decimate,
   texture resize, compression (glTF Transform).

The provider abstraction (see `architecture.md` §6) is designed so that a
pipeline of several providers looks like one provider to the rest of the app.

## 5. Bake-off protocol (Milestone 6, step 1)

Before any spend: narrow the shortlist using free tiers and credits, providers'
published samples, licence and data-handling terms, and availability for users
in Nigeria (the first market). Then request budget approval for the steps below.

1. **Test set:** 8–12 consenting participants (written consent, internal use
   only), covering age, skin tone, gender presentation, facial hair, glasses,
   short/long/curly/covered hair. For each: one frontal photo used as input,
   plus held-out 3/4 and profile photos used only for judging.
2. **Run** each shortlisted provider on single-photo input, and multi-photo
   input where supported. Record cost and timing.
3. **Normalise** outputs through the same glTF Transform pipeline and render
   front / 3/4 / profile at fixed camera and lighting in our own viewer.
4. **Score** with a blind panel (≥ 5 raters) plus automated face-embedding
   similarity. Check the embedding model's licence before use; restrict to
   internal evaluation if required.
5. **Decide** in an ADR (`docs/decisions/`), including fallback provider.

Budget estimate for the bake-off: roughly 12 subjects × 5 providers × 2 input
modes ≈ 120 generations; at $0.10–$1.50 each, under $200 plus any plan fees.

## 6. Questions to send providers before integration

- Do you train on, or retain, uploaded images or outputs? For how long?
- Is there a deletion endpoint for inputs and outputs?
- Who owns the generated asset? Any attribution or usage restrictions?
- Webhook support, signature scheme, rate limits, SLA.
- Multi-image input support; maximum input resolution.
- Data-processing region (GDPR) and DPA availability.

## Sources

- [Avatar SDK — Avatar API](https://avatarsdk.com/avatar-api/)
- [Avatar SDK — Realistic avatar from a photo](https://avatarsdk.com/realistic-avatar/)
- [Meshy — Image to 3D API quickstart](https://www.meshy.ai/tutorials/api-quickstart-image-to-3d)
- [Ready Player Me — 3D avatar GET API](https://docs.readyplayer.me/ready-player-me/api-reference/rest-api/avatars/player-zero/get-3d-avatars)
- [3D AI Studio — Best 3D model generation APIs 2026](https://www.3daistudio.com/blog/best-3d-model-generation-apis-2026)
- [Pixazo — Best closed-source 3D generation APIs](https://www.pixazo.ai/blog/best-closed-source-3d-model-generation-apis)
- [Dupple — Rodin AI review 2026](https://dupple.com/reviews/rodin-ai)
- [Makerstack — Rodin review](https://makerstack.co/reviews/hyper3d-rodin-review/)
- [Lemonlama — Hyper3D Rodin review](https://lemonlama.net/ai/hyper3d-rodin-ai/)
- [3D AI Studio — Is TRELLIS 2 free?](https://www.3daistudio.com/blog/is-trellis-2-free-pricing-how-to-get-started)
- [microsoft/TRELLIS issue #298 (licensing)](https://github.com/microsoft/TRELLIS/issues/298)
- [Hunyuan3D-2 — commercial licensing issue](https://github.com/Tencent-Hunyuan/Hunyuan3D-2/issues/6)
- [Hunyuan3D-2 LICENSE](https://huggingface.co/tencent/Hunyuan3D-2/commit/61f7f039268937ff365927372b4f2f5c9f486792)
- [FLAME-Universe](https://github.com/TimoBolkart/FLAME-Universe)
- [PercHead (arXiv 2511.02777)](https://arxiv.org/html/2511.02777v1)
