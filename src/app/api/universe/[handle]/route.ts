// GET /api/universe/{handle} — 친구 책장 (친구끼리만) + 나와의 통로

import type { NextRequest } from "next/server";
import { ATTRIBUTION } from "@/lib/yes24/candidate";
import { errorResponse } from "@/lib/server/http";
import { friendShelf } from "@/lib/server/friends";
import { currentUser } from "@/lib/server/session";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/universe/[handle]">) {
  try {
    const { handle } = await ctx.params;
    return Response.json({ ...(await friendShelf(await currentUser(), handle)), attribution: ATTRIBUTION });
  } catch (e) {
    return errorResponse(e);
  }
}
