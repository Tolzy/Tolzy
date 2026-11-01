import { NextResponse } from "next/server";
import { sessionCookie, signInLocal } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

/** Local development sign-in (LOCAL_BACKEND=1 only; refused on hosted deployments). */
export function POST(req: Request) {
  return handle(async () => {
    const body = (await req.json().catch(() => ({}))) as { email?: string; name?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const { token, user } = await signInLocal(email, (body.name ?? "").trim().slice(0, 60) || email.split("@")[0]);
    const res = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
    res.cookies.set(sessionCookie(token));
    return res;
  });
}
