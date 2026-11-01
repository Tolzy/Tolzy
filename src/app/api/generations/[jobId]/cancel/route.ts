import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { cancelJob } from "@/lib/server/generation";
import { handle, noStore } from "@/lib/server/http";

export function POST(_: Request, ctx: RouteContext<"/api/generations/[jobId]/cancel">) {
  return handle(async () => {
    const user = await requireUser();
    const { jobId } = await ctx.params;
    return NextResponse.json({ job: await cancelJob(user.id, jobId) }, { headers: noStore });
  });
}
