import "server-only";

import sharp from "sharp";
import { mutate, readDb, readFileRel, removeRel, writeFileRel, type AssetRow, type PortraitRow } from "./store";

export interface PortraitSummary {
  id: string;
  name: string;
  status: PortraitRow["status"];
  providerId: string;
  jobId: string;
  createdAt: string;
  hasThumbnail: boolean;
}

export interface PortraitDetail extends PortraitSummary {
  manifest: Record<string, unknown> | null;
}

const summary = (p: PortraitRow): PortraitSummary => ({
  id: p.id,
  name: p.name,
  status: p.status,
  providerId: p.providerId,
  jobId: p.jobId,
  createdAt: p.createdAt,
  hasThumbnail: !!p.thumbnailPath,
});

export async function listPortraits(ownerId: string): Promise<PortraitSummary[]> {
  const db = await readDb();
  return db.portraits
    .filter((p) => p.ownerId === ownerId && p.status !== "failed")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(summary);
}

export async function getPortrait(ownerId: string, id: string): Promise<PortraitDetail | null> {
  const db = await readDb();
  const p = db.portraits.find((x) => x.id === id && x.ownerId === ownerId);
  if (!p) return null;
  const asset = p.assetId ? db.assets.find((a) => a.id === p.assetId) : null;
  return { ...summary(p), manifest: asset?.manifest ?? null };
}

/** The owner's model file (never served publicly). */
export async function portraitModel(ownerId: string, id: string): Promise<{ data: Buffer; asset: AssetRow } | null> {
  const db = await readDb();
  const p = db.portraits.find((x) => x.id === id && x.ownerId === ownerId);
  const asset = p?.assetId ? db.assets.find((a) => a.id === p.assetId) : null;
  if (!asset) return null;
  return { data: await readFileRel(asset.path), asset };
}

/** Stores a thumbnail rendered by the Studio (validated and re-encoded). */
export async function saveThumbnail(ownerId: string, id: string, image: Buffer): Promise<boolean> {
  const db = await readDb();
  const p = db.portraits.find((x) => x.id === id && x.ownerId === ownerId);
  if (!p || p.status !== "ready" || image.length > 4 * 1024 * 1024) return false;
  let webp: Buffer;
  try {
    webp = await sharp(image, { limitInputPixels: 16_000_000 })
      .resize({ width: 640, height: 800, fit: "cover", position: "top" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return false;
  }
  const path = `files/${ownerId}/thumbs/${id}.webp`;
  await writeFileRel(path, webp);
  await mutate((d) => {
    const row = d.portraits.find((x) => x.id === id);
    if (row) row.thumbnailPath = path;
  });
  return true;
}

export async function portraitThumbnail(ownerId: string, id: string): Promise<Buffer | null> {
  const db = await readDb();
  const p = db.portraits.find((x) => x.id === id && x.ownerId === ownerId);
  return p?.thumbnailPath ? readFileRel(p.thumbnailPath) : null;
}

/**
 * Deletes a portrait: model, thumbnail and job records. Source photos have
 * their own controls (retention, Settings → Storage) and are kept unless
 * `withPhotos` is set.
 */
export async function deletePortrait(ownerId: string, id: string, withPhotos = false): Promise<boolean> {
  const removed = await mutate((db) => {
    const p = db.portraits.find((x) => x.id === id && x.ownerId === ownerId);
    if (!p) return null;
    const jobs = db.jobs.filter((j) => j.portraitId === id);
    const photoIds = new Set(jobs.flatMap((j) => j.photoIds));
    const assets = db.assets.filter((a) => a.portraitId === id);
    const photos = withPhotos ? db.photos.filter((x) => photoIds.has(x.id) && x.ownerId === ownerId) : [];
    db.portraits = db.portraits.filter((x) => x.id !== id);
    db.jobs = db.jobs.filter((j) => j.portraitId !== id);
    db.assets = db.assets.filter((a) => a.portraitId !== id);
    db.photos = db.photos.filter((x) => !photos.includes(x));
    return {
      paths: [
        ...assets.map((a) => a.path),
        ...photos.map((x) => x.path),
        ...(p.thumbnailPath ? [p.thumbnailPath] : []),
      ],
    };
  });
  if (!removed) return false;
  await Promise.all(removed.paths.map(removeRel));
  return true;
}
