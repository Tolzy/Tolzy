/**
 * Whether photos can be uploaded from this build.
 *
 * Uploading requires sign-in (product-owner decision 1) and an approved
 * private storage backend (Supabase Auth + Storage with RLS, signed upload
 * URLs, server-side re-encode and EXIF stripping — docs/security-privacy.md).
 * None of that is configured yet, so uploads are off and the UI says so;
 * nothing is faked. When the backend exists this becomes a server check.
 */
export const UPLOADS = {
  available: false,
  reason: "Uploads need an account, and sign-in isn’t enabled in this preview build.",
} as const;
