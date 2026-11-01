import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { handle, noStore } from "@/lib/server/http";
import { deletePortrait, getPortrait } from "@/lib/server/portraits";

export function GET(_: Request, ctx: RouteContext<"/api/portraits/[portraitId]">) {
  return handle(async () => {
    const user = await requireUser();
    const { portraitId } = await ctx.params;
    const portrait = await getPortrait(user.id, portraitId);
    if (!portrait) return NextResponse.json({ error: "Portrait not found." }, { status: 404 });
    return NextResponse.json({ portrait }, { headers: noStore });
  });
}

/** Deletes the portrait's model, thumbnail and records (?photos=1 also deletes its source photos). */
export function DELETE(req: Request, ctx: RouteContext<"/api/portraits/[portraitId]">) {
  return handle(async () => {
    const user = await requireUser();
    const { portraitId } = await ctx.params;
    const withPhotos = new URL(req.url).searchParams.get("photos") === "1";
    const ok = await deletePortrait(user.id, portraitId, withPhotos);
    return ok ? NextResponse.json({ ok }) : NextResponse.json({ error: "Portrait not found." }, { status: 404 });
  });
}
