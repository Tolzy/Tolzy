import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { CONSENT_VERSION, publicStatus } from "@/lib/server/config";
import { noStore } from "@/lib/server/http";

/** What this build supports (backend, provider) and who is signed in. No secrets. */
export async function GET() {
  const user = await currentUser();
  return NextResponse.json(
    {
      ...publicStatus(),
      consentVersion: CONSENT_VERSION,
      user: user ? { id: user.id, name: user.name, email: user.email } : null,
    },
    { headers: noStore },
  );
}
