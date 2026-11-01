import "server-only";

import sharp, { type Metadata, type OutputInfo } from "sharp";
import { MAX_BYTES, MAX_PIXELS, MIN_SHORT_EDGE, sniffFormat } from "@/lib/photos/file-checks";
import type { SlotId } from "@/lib/photos/types";
import { PHOTO_RETENTION_DAYS } from "./config";
import { mutate, newId, now, readDb, removeRel, writeFileRel, type PhotoRow } from "./store";

const SLOTS: SlotId[] = ["front", "leftThreeQuarter", "rightThreeQuarter", "leftProfile", "rightProfile"];
/** Long edge kept for reconstruction (providers accept ≤ 20 MB; 2048 px keeps facial detail). */
const STORED_EDGE = 2048;

export class UploadError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export const isSlot = (s: unknown): s is SlotId => SLOTS.includes(s as SlotId);

/**
 * Server-side validation and re-encode of one uploaded photo. The browser's
 * checks are a convenience; these are authoritative: signature (not name or
 * declared type), size, decodability, resolution. The stored copy is a JPEG
 * with EXIF orientation applied and **all metadata (including GPS) removed**.
 */
export async function storePhoto(ownerId: string, slot: SlotId, data: Buffer): Promise<PhotoRow> {
  if (data.length === 0) throw new UploadError("The file is empty.");
  if (data.length > MAX_BYTES) throw new UploadError("The file is over the 20 MB limit.", 413);
  const format = sniffFormat(new Uint8Array(data.subarray(0, 32)));
  if (!format) throw new UploadError("This isn’t a supported image (JPG, PNG, WebP or HEIC).", 415);

  let meta: Metadata;
  try {
    meta = await sharp(data, { limitInputPixels: MAX_PIXELS }).metadata();
  } catch {
    throw new UploadError(
      format === "heic"
        ? "HEIC photos can’t be processed yet. Export the photo as JPEG and try again."
        : "The image couldn’t be read — the file may be damaged.",
      422,
    );
  }
  // EXIF orientations 5–8 swap width and height.
  const swap = (meta.orientation ?? 1) >= 5;
  const width = (swap ? meta.height : meta.width) ?? 0;
  const height = (swap ? meta.width : meta.height) ?? 0;
  if (Math.min(width, height) < MIN_SHORT_EDGE)
    throw new UploadError(
      `The photo is ${width} × ${height}; the shorter side needs at least ${MIN_SHORT_EDGE} px.`,
      422,
    );

  let jpeg: { data: Buffer; info: OutputInfo };
  try {
    jpeg = await sharp(data, { limitInputPixels: MAX_PIXELS })
      .rotate() // apply EXIF orientation, then metadata is dropped (sharp's default)
      .resize({ width: STORED_EDGE, height: STORED_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new UploadError("The image couldn’t be processed.", 422);
  }

  const id = newId("pho");
  const path = `files/${ownerId}/photos/${id}.jpg`;
  await writeFileRel(path, jpeg.data);
  const row: PhotoRow = {
    id,
    ownerId,
    slot,
    path,
    bytes: jpeg.data.length,
    width: jpeg.info.width,
    height: jpeg.info.height,
    createdAt: now(),
    deleteAfter: null,
    keep: false,
  };
  await mutate((db) => db.photos.push(row));
  return row;
}

/** Photos owned by the user, by id (others are silently excluded). */
export async function ownedPhotos(ownerId: string, ids: string[]): Promise<PhotoRow[]> {
  const db = await readDb();
  return ids.map((id) => db.photos.find((p) => p.id === id && p.ownerId === ownerId)).filter((p): p is PhotoRow => !!p);
}

export async function deletePhotos(ownerId: string, ids: string[] | "all") {
  const removed = await mutate((db) => {
    const doomed = db.photos.filter((p) => p.ownerId === ownerId && (ids === "all" || ids.includes(p.id)));
    db.photos = db.photos.filter((p) => !doomed.includes(p));
    return doomed;
  });
  await Promise.all(removed.map((p) => removeRel(p.path)));
  return removed.length;
}

/** Photos uploaded but never used by a generation are removed after this. */
const UNUSED_PHOTO_MS = 24 * 3_600_000;

/**
 * Retention (decision 3): photos are deleted 30 days after generation (7 after
 * a failed or cancelled one) unless the owner chose to keep them; uploads no
 * generation used are deleted after a day. Run by the cron route and
 * opportunistically.
 */
export async function purgeExpiredPhotos(at = new Date()): Promise<number> {
  const removed = await mutate((db) => {
    const used = new Set(db.jobs.flatMap((j) => j.photoIds));
    const stale = new Date(at.getTime() - UNUSED_PHOTO_MS).toISOString();
    const expired = db.photos.filter(
      (p) =>
        !p.keep && ((p.deleteAfter && p.deleteAfter <= at.toISOString()) || (!used.has(p.id) && p.createdAt <= stale)),
    );
    db.photos = db.photos.filter((p) => !expired.includes(p));
    return expired;
  });
  await Promise.all(removed.map((p) => removeRel(p.path)));
  return removed.length;
}

/**
 * Keep photos beyond the retention period, or return to automatic deletion.
 * Turning "keep" off schedules photos that were already used by a finished
 * generation (30 days from now), so nothing is kept indefinitely by accident.
 */
export async function setKeepPhotos(ownerId: string, keep: boolean): Promise<void> {
  await mutate((db) => {
    const finished = new Set(
      db.jobs
        .filter((j) => j.ownerId === ownerId && ["completed", "failed", "cancelled"].includes(j.status))
        .flatMap((j) => j.photoIds),
    );
    const later = new Date(Date.now() + PHOTO_RETENTION_DAYS * 86_400_000).toISOString();
    for (const p of db.photos) {
      if (p.ownerId !== ownerId) continue;
      p.keep = keep;
      if (keep) p.deleteAfter = null;
      else if (!p.deleteAfter && finished.has(p.id)) p.deleteAfter = later;
    }
  });
}
