import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { dataDir } from "./config";

/*
 * Local development backend: a small JSON database plus private files under
 * DATA_DIR. Mirrors the production tables in docs/data-model.md so the
 * Supabase implementation is a drop-in replacement for these functions.
 */

export interface UserRow {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}
export interface SessionRow {
  /** SHA-256 of the cookie token (the token itself is never stored). */
  tokenHash: string;
  userId: string;
  expiresAt: string;
}
export type PhotoSlot = "front" | "leftThreeQuarter" | "rightThreeQuarter" | "leftProfile" | "rightProfile";
export interface PhotoRow {
  id: string;
  ownerId: string;
  slot: PhotoSlot;
  /** Relative to DATA_DIR. Re-encoded JPEG without metadata. */
  path: string;
  bytes: number;
  width: number;
  height: number;
  createdAt: string;
  /** Deletion date: 30 days after a completed generation, 7 after a failed/cancelled one; null while in use or kept. */
  deleteAfter: string | null;
  keep: boolean;
}
export interface ConsentRow {
  id: string;
  ownerId: string;
  version: string;
  providerId: string;
  photoIds: string[];
  acceptedAt: string;
}
export type JobStatus =
  | "queued"
  | "preparing"
  | "submitted"
  | "processing"
  | "downloading"
  | "validating"
  | "completed"
  | "failed"
  | "cancelled";
export interface JobRow {
  id: string;
  ownerId: string;
  portraitId: string;
  providerId: string;
  providerJobId: string | null;
  status: JobStatus;
  /** 0–100 as reported by the provider; null when it reports none. */
  progress: number | null;
  photoIds: string[];
  consentId: string;
  attempts: number;
  error: { code: string; message: string; retryable: boolean } | null;
  /** Test/development scenario for the fixture provider only. */
  scenario: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  finishedAt: string | null;
  nextPollAt: string | null;
}
export interface PortraitRow {
  id: string;
  ownerId: string;
  name: string;
  status: "generating" | "ready" | "failed";
  providerId: string;
  jobId: string;
  assetId: string | null;
  thumbnailPath: string | null;
  createdAt: string;
}
export interface AssetRow {
  id: string;
  ownerId: string;
  portraitId: string;
  path: string;
  bytes: number;
  triangles: number;
  /** Normalisation and analysis results (docs/data-model.md: model_assets.manifest). */
  manifest: Record<string, unknown>;
  createdAt: string;
}

export interface Db {
  users: UserRow[];
  sessions: SessionRow[];
  photos: PhotoRow[];
  consents: ConsentRow[];
  jobs: JobRow[];
  portraits: PortraitRow[];
  assets: AssetRow[];
}

const EMPTY: Db = { users: [], sessions: [], photos: [], consents: [], jobs: [], portraits: [], assets: [] };

export const newId = (prefix: string) => `${prefix}_${randomBytes(9).toString("base64url")}`;
export const now = () => new Date().toISOString();

const dbPath = () => join(dataDir(), "db.json");

let chain: Promise<unknown> = Promise.resolve();
/** Serialises all access so concurrent requests never interleave writes. */
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

async function load(): Promise<Db> {
  try {
    return { ...EMPTY, ...(JSON.parse(await readFile(dbPath(), "utf8")) as Partial<Db>) };
  } catch {
    return structuredClone(EMPTY);
  }
}

async function save(db: Db) {
  await mkdir(dataDir(), { recursive: true });
  const tmp = `${dbPath()}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(db, null, 1));
  await rename(tmp, dbPath()); // atomic replace
}

export function readDb(): Promise<Db> {
  return locked(load);
}

/** Read–modify–write under the lock. */
export function mutate<T>(fn: (db: Db) => T): Promise<T> {
  return locked(async () => {
    const db = await load();
    const result = fn(db);
    await save(db);
    return result;
  });
}

/* ───────────────────────── Private files ───────────────────────── */

/** Resolves a stored relative path, refusing anything outside DATA_DIR. */
export function filePath(rel: string): string {
  const root = resolve(dataDir());
  const full = resolve(root, rel);
  if (full !== root && !full.startsWith(root + sep)) throw new Error("Path outside data directory");
  return full;
}

export async function writeFileRel(rel: string, data: Uint8Array | Buffer) {
  const full = filePath(rel);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, data);
}

export async function readFileRel(rel: string): Promise<Buffer> {
  return readFile(filePath(rel));
}

export async function removeRel(rel: string) {
  await rm(filePath(rel), { recursive: true, force: true });
}
