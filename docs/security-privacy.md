# Privacy and security

Status: policy draft, updated for Milestones 6–7 (1 Nov 2026). Needs legal
review before public launch — photos of faces and 3D models derived from them
are biometric or biometric-adjacent personal data under the Nigeria Data
Protection Act 2023, GDPR and some US state laws (e.g. Illinois BIPA, Texas
CUBI). User consent alone does not discharge every obligation (§7).

## 1. Principles

1. **Private by default.** Source photos, generated models and renders are
   visible only to their owner.
2. **Publishing is explicit.** Only a deliberate "Public embed" action creates
   a publicly reachable copy, and it can be withdrawn at any time.
3. **Secrets stay on the server.** Provider, R2 and Supabase service-role keys
   are never sent to the browser. Only `NEXT_PUBLIC_SUPABASE_URL` and the
   anon key are public, and the anon key is safe only because of RLS.
4. **Least data.** Strip EXIF (including GPS) on upload; store only what the
   pipeline needs; delete source photos on a schedule.
5. **No training.** Personal photos are never used to train models — ours or a
   provider's. A separate, explicit, revocable consent would be required, and
   is not collected in the initial product.

## 1a. Photo checks run on the device (M5)

Photo validation on the New Portrait page runs entirely in the browser
(file signature, size, decoding, resolution, MediaPipe Face Landmarker served
from our own origin). No photo data leaves the device during the checks — verified by a browser
test that records every request. Uploading starts only after sign-in, consent
and the provider disclosure (§1b).

## 1b. As built in Milestone 6 (local backend)

| Requirement                        | Implementation                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication before upload       | Every upload, generation, photo, portrait and model route calls `requireUser()`; 401 otherwise (tested). Session: random token, only its SHA-256 stored; httpOnly, SameSite=Lax cookie, 14 days.                                                                                                                                   |
| Explicit consent before processing | Generation refuses without `consent.accepted` and the current `CONSENT_VERSION`; each consent is stored with version, time and photo ids.                                                                                                                                                                                          |
| Provider disclosure                | The review step names the provider, where it processes photos and that photos are never used for training, before “Upload and generate”.                                                                                                                                                                                           |
| No spending without approval       | External providers are disabled unless `RECONSTRUCTION_API_KEY` **and** `RECONSTRUCTION_PROVIDER_APPROVED=1` are set; neither is set anywhere.                                                                                                                                                                                     |
| Keys never in the browser          | Provider code is `server-only`; `/api/status` returns availability only; e2e test checks status and pages for key material.                                                                                                                                                                                                        |
| Private by default                 | Photos and models are stored outside `public/`; served only to their owner by authenticated routes with `Cache-Control: no-store`; other users get 404 (tested). There are no public model URLs.                                                                                                                                   |
| Upload hygiene                     | Signature sniffing, 20 MB cap, decode check, minimum resolution; re-encoded with Sharp (orientation applied, all metadata incl. EXIF/GPS dropped, ≤ 2048 px).                                                                                                                                                                      |
| Retention                          | Photos: deleted 30 days after a successful generation unless the owner keeps them; 7 days after a failed or cancelled one; 1 day after upload if no generation used them. Enforced by `/api/cron/maintenance` and opportunistically. Owners can delete all photos (`DELETE /api/photos`) or a portrait with or without its photos. |
| Temporary files                    | Provider results are downloaded into memory, validated and written once; nothing is staged on disk. Remote provider copies are deleted after download where the provider supports it (Meshy adapter: `DELETE` task).                                                                                                               |
| Original asset preserved           | The model is stored byte-for-byte as returned; normalisation is metadata (manifest), applied on load.                                                                                                                                                                                                                              |

The local backend (JSON + files under `DATA_DIR`) is for development and tests
only and is refused on hosted deployments. Production needs managed auth and
private object storage (Supabase Auth/Storage + R2, `docs/data-model.md`) with
encryption at rest and signed, short-lived URLs.

## 2. Controls

| Area           | Control                                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Authentication | Supabase Auth (email magic link + OAuth); session cookies via `@supabase/ssr`; server checks on every route handler          |
| Authorisation  | Postgres RLS on every table; server writes job/asset rows with service role only after ownership check                       |
| Uploads        | Signed upload URLs, size limit, MIME sniffing (not extension), Sharp re-encode to JPEG/WebP, EXIF stripped, dimension limits |
| Asset access   | Presigned R2 GET URLs, ≤ 15 min; source photos via Supabase signed URLs, ≤ 10 min                                            |
| Provider calls | Server-only; inputs passed as short-lived signed URLs; webhook signatures verified; idempotent handlers                      |
| Embeds         | Separate public bucket containing only published copies; unguessable slugs; `frame-ancestors` only on embed routes           |
| Headers        | CSP, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`                      |
| Rate limiting  | Per-user limits on uploads and generation starts (cost protection)                                                           |
| Logging        | No image URLs or personal data in logs; job errors stored as codes + user-safe messages                                      |
| Dependencies   | Lockfile, `npm audit` in CI, minimal dependency set                                                                          |

## 3. Retention policy (approved defaults, ADR 0002)

| Data                      | Retention                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source photos             | Deleted **30 days** after a successful generation, or immediately on user request. Users may choose "Keep my photos" to allow regeneration later. |
| Failed-job photos         | Deleted after 7 days (unused uploads: 1 day).                                                                                                     |
| Provider copies           | Deleted via provider API right after result download, where supported; provider retention terms recorded per provider.                            |
| Generated models, exports | Kept until the user deletes the portrait or account.                                                                                              |
| Public embed copies       | Deleted immediately on unpublish or portrait deletion.                                                                                            |
| Account deletion          | All rows and objects removed within 30 days (immediately where possible).                                                                         |

A daily cron route enforces `source_images.delete_after`.

## 4. User-facing disclosure (draft copy)

> Your photo is sent securely to our 3D reconstruction partner to build your
> model. It is never used to train AI models. We delete your photo after
> 30 days unless you choose to keep it, and you can delete it — and your
> portrait — at any time.
>
> ☐ I am the person in this photo, or I have their permission to create a 3D
> portrait of them.

The consent version is recorded in `consents`.

## 5. Regions

Nigeria is the first market. Production image processing is enabled per region
by configuration only after provider availability, licensing and privacy
requirements are reviewed for that region. Nothing is hard-coded per country.

## 6. Open items (blocking production)

- Legal review of biometric-data obligations per launch region.
- Data Processing Agreement with the chosen reconstruction provider.
- Abuse policy: generating portraits of people without consent (public
  figures, minors). Minimum: consent attestation, reporting route, takedown of
  public embeds.
- Written answers from the chosen provider on training, retention and
  deletion of inputs/outputs; DPA signed (`docs/research/provider-comparison.md` §3).
- Account deletion flow (all rows and files) — routes for photo and portrait
  deletion exist; whole-account deletion arrives with M10.
- Separate, opt-in consent for any use of photos to improve models — not
  collected; photos are never used for training.

## 7. Nigeria Data Protection Act 2023 — requirements to resolve

The NDPA 2023 is enforced by the Nigeria Data Protection Commission (NDPC).
This is an engineering checklist, not legal advice; a Nigerian data-protection
practitioner should confirm it.

| Topic                             | Why it applies                                                                                                  | Status                                                                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Sensitive personal data           | Face photos processed to build a 3D likeness are biometric data, a category of sensitive personal data.         | Explicit, versioned consent collected; lawful basis to be confirmed by counsel.                                                           |
| Consent quality                   | Consent must be informed, specific and withdrawable; the person in the photo may not be the uploader.           | Attestation (“I am the person or have their permission”); withdrawal = delete photos/portrait. Third-party subjects need a review.        |
| Data Protection Impact Assessment | Large-scale processing of biometric data with a new technology is high-risk processing.                         | **Not done** — required before launch.                                                                                                    |
| Cross-border transfer             | Hosted providers (e.g. Meshy, US) receive photos outside Nigeria.                                               | **Open** — needs an adequacy basis or appropriate safeguards (contractual clauses/DPA), and disclosure. Self-hosting in-region avoids it. |
| Registration with the NDPC        | Controllers/processors “of major importance” must register; thresholds are set by the Commission.               | **Open** — assess once volumes are known.                                                                                                 |
| Data Protection Officer           | Required for controllers of major importance.                                                                   | **Open**.                                                                                                                                 |
| Data subject rights               | Access, rectification, erasure, objection, portability.                                                         | Erasure of photos and portraits implemented; export (M11) and access request process open.                                                |
| Security and breach notification  | Appropriate technical measures; breaches notified to the NDPC promptly (72-hour window) and to affected people. | Access control and private storage implemented; incident process **open**.                                                                |
| Retention limitation              | Keep data no longer than necessary.                                                                             | Implemented (§1b).                                                                                                                        |
| Processor contracts               | The reconstruction provider is a processor.                                                                     | **Open** — DPA with the selected provider.                                                                                                |

Consent does not settle licensing either: provider output rights and every
model/library licence in the pipeline must allow commercial use independently
of what the user agrees to (ADR 0008, provider comparison §3).
