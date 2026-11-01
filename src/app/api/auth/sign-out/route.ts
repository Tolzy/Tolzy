import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, signOut } from "@/lib/server/auth";

export async function POST() {
  const store = await cookies();
  await signOut(store.get(SESSION_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
