// POST /api/universe/{handle}/visit — 친구 도서관에 놀러 왔다 (3시간에 한 번만 센다)

import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/server/http";
import { currentUser } from "@/lib/server/session";
import { recordVisit } from "@/lib/server/visits";

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/universe/[handle]/visit">) {
  try {
    const { handle } = await ctx.params;
    return Response.json(await recordVisit(await currentUser(), handle));
  } catch (e) {
    return errorResponse(e);
  }
}
