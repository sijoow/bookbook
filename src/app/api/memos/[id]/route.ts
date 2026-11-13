// DELETE /api/memos/{id} — 메모 지우기

import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/server/http";
import { deleteMemo } from "@/lib/server/library";
import { currentUser } from "@/lib/server/session";

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/memos/[id]">) {
  try {
    const { id } = await ctx.params;
    await deleteMemo(await currentUser(), id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
