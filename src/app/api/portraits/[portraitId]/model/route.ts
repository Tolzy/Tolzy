import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";
import { portraitModel } from "@/lib/server/portraits";

/** The owner's GLB. Private: session-checked on every request, never cached publicly. */
export function GET(_: Request, ctx: RouteContext<"/api/portraits/[portraitId]/model">) {
  return handle(async () => {
    const user = await requireUser();
    const { portraitId } = await ctx.params;
    const model = await portraitModel(user.id, portraitId);
    if (!model) return NextResponse.json({ error: "Model not found." }, { status: 404 });
    return new Response(new Uint8Array(model.data), {
      headers: {
        "Content-Type": "model/gltf-binary",
        "Content-Length": String(model.data.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
