// DELETE /api/friends/{handle} — 책장 친구 끊기

import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/server/http";
import { unfriend } from "@/lib/server/friends";
import { currentUser } from "@/lib/server/session";

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/friends/[handle]">) {
  try {
    const { handle } = await ctx.params;
    await unfriend(await currentUser(), handle);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
