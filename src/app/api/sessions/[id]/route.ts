// DELETE /api/sessions/{id} — 잘못 남긴 독서 기록 지우기 (그 책의 읽은 시간에서 뺀다)

import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/server/http";
import { deleteSession } from "@/lib/server/library";
import { currentUser } from "@/lib/server/session";

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/sessions/[id]">) {
  try {
    const { id } = await ctx.params;
    await deleteSession(await currentUser(), id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
