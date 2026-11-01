import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { backendKind } from "./config";
import { mutate, newId, now, readDb, type UserRow } from "./store";

export const SESSION_COOKIE = "ps_session";
const SESSION_DAYS = 14;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export class AuthError extends Error {
  status = 401;
}

/** The signed-in user for a session token, or null. */
export async function userForToken(token: string | undefined): Promise<UserRow | null> {
  if (!token || backendKind() !== "local") return null;
  const db = await readDb();
  const session = db.sessions.find((s) => s.tokenHash === hash(token) && s.expiresAt > now());
  return (session && db.users.find((u) => u.id === session.userId)) ?? null;
}

/** The user for the current request (reads the httpOnly session cookie). */
export async function currentUser(): Promise<UserRow | null> {
  const store = await cookies();
  // Session checks read the clock (expiry): request time only, never prefetch/prerender.
  await connection();
  return userForToken(store.get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<UserRow> {
  const user = await currentUser();
  if (!user) throw new AuthError("Sign in to continue.");
  return user;
}

/**
 * Local development sign-in: one account per email on this machine, no
 * password (the local backend never runs on a hosted deployment). The
 * production backend replaces this with Supabase Auth (magic link / OAuth).
 */
export async function signInLocal(email: string, name: string): Promise<{ token: string; user: UserRow }> {
  if (backendKind() !== "local") throw new AuthError("Sign-in isn’t available in this build.");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  const user = await mutate((db) => {
    let u = db.users.find((x) => x.email === email);
    if (!u) {
      u = { id: newId("usr"), email, name, createdAt: now() };
      db.users.push(u);
    }
    db.sessions = db.sessions.filter((s) => s.expiresAt > now());
    db.sessions.push({ tokenHash: hash(token), userId: u.id, expiresAt });
    return u;
  });
  return { token, user };
}

export async function signOut(token: string | undefined) {
  if (!token) return;
  await mutate((db) => {
    db.sessions = db.sessions.filter((s) => s.tokenHash !== hash(token));
  });
}

export const sessionCookie = (token: string) => ({
  name: SESSION_COOKIE,
  value: token,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && !process.env.LOCAL_BACKEND_HTTP,
  path: "/",
  maxAge: SESSION_DAYS * 86_400,
});
