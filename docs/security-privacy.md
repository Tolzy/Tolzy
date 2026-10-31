# Privacy and security

Status: Milestone 0 policy draft. Needs legal review before public launch —
photos of faces are biometric-adjacent personal data under GDPR and some US
state laws (e.g. Illinois BIPA, Texas CUBI).

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
from our own origin). No photo data is sent anywhere — verified by a browser
test that records every request. Uploading is disabled until sign-in and the
private storage backend exist (ADR 0007); the interface says so rather than
simulating an upload.

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
| Failed-job photos         | Deleted after 7 days.                                                                                                                             |
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

Nigeria is the first market. The Nigeria Data Protection Act 2023 treats
biometric data as sensitive personal data, and photographs sent to a provider
outside Nigeria are a cross-border transfer. Production image processing is
enabled per region by configuration only after provider availability,
licensing and privacy requirements are reviewed for that region. Nothing is
hard-coded per country.

## 6. Open items

- Legal review of biometric-data obligations per launch region.
- Data Processing Agreement with the chosen reconstruction provider.
- Abuse policy: generating portraits of people without consent (public
  figures, minors). Minimum: consent attestation, reporting route, takedown of
  public embeds.
