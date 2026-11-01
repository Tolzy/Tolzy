import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { retryJob } from "@/lib/server/generation";
import { handle, noStore } from "@/lib/server/http";

export function POST(_: Request, ctx: RouteContext<"/api/generations/[jobId]/retry">) {
  return handle(async () => {
    const user = await requireUser();
    const { jobId } = await ctx.params;
    return NextResponse.json({ job: await retryJob(user.id, jobId) }, { headers: noStore });
  });
}
