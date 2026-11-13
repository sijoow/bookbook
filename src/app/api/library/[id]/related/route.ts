// GET /api/library/{id}/related — 이어지는 책: 같은 작가의 다른 책 · 이 책이 꽂힌 친구 책장 · 그 친구들이 좋아한 다른 책

import type { NextRequest } from "next/server";
import { ATTRIBUTION } from "@/lib/yes24/candidate";
import { errorResponse } from "@/lib/server/http";
import { relatedFor } from "@/lib/server/picks";
import { currentUser } from "@/lib/server/session";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/library/[id]/related">) {
  const { id } = await ctx.params; // 요청값을 먼저 (try 밖에)
  try {
    return Response.json({ ...(await relatedFor(await currentUser(), id)), attribution: ATTRIBUTION });
  } catch (e) {
    return errorResponse(e);
  }
}
