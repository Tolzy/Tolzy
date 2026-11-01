import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { startGeneration } from "@/lib/server/generation";
import { handle, noStore } from "@/lib/server/http";

/** Starts a reconstruction from the user's uploaded photos (consent required). */
export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as {
      photoIds?: string[];
      consent?: { accepted: boolean; version: string };
      name?: string;
      scenario?: string;
    };
    const job = await startGeneration(user.id, {
      photoIds: Array.isArray(body.photoIds) ? body.photoIds.filter((x) => typeof x === "string").slice(0, 5) : [],
      consent: body.consent ?? { accepted: false, version: "" },
      name: body.name,
      scenario: typeof body.scenario === "string" ? body.scenario : null,
    });
    return NextResponse.json({ job }, { status: 201, headers: noStore });
  });
}
