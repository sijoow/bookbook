// POST /api/universe/{handle}/stamp { kind: star|heart|flower|book, note? } — 친구 도서관에 발도장 남기기

import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/server/http";
import { currentUser } from "@/lib/server/session";
import { leaveStamp, stampSchema } from "@/lib/server/visits";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/universe/[handle]/stamp">) {
  try {
    const { handle } = await ctx.params;
    await leaveStamp(await currentUser(), handle, stampSchema.parse(await req.json()));
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
