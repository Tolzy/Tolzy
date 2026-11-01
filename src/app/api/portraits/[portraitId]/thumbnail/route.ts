import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { portraitThumbnail, saveThumbnail } from "@/lib/server/portraits";

export function GET(_: Request, ctx: RouteContext<"/api/portraits/[portraitId]/thumbnail">) {
  return handle(async () => {
    const user = await requireUser();
    const { portraitId } = await ctx.params;
    const data = await portraitThumbnail(user.id, portraitId);
    if (!data) return NextResponse.json({ error: "No thumbnail." }, { status: 404 });
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store" },
    });
  });
}

/** The Studio uploads a render of the finished model as its thumbnail. */
export function PUT(req: Request, ctx: RouteContext<"/api/portraits/[portraitId]/thumbnail">) {
  return handle(async () => {
    const user = await requireUser();
    const { portraitId } = await ctx.params;
    const ok = await saveThumbnail(user.id, portraitId, Buffer.from(await req.arrayBuffer()));
    return ok ? NextResponse.json({ ok }) : NextResponse.json({ error: "Thumbnail rejected." }, { status: 400 });
  });
}
