// POST /api/library/{id}/sessions — 책을 덮을 때: { startedAt?, endedAt?, minutes?, toPage?, finished? }
// 타이머로 읽었으면 startedAt~endedAt, 직접 적으면 minutes. 남은 기록으로 읽는 속도·남은 시간을 어림한다.

import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/server/http";
import { addSession } from "@/lib/server/library";
import { currentUser } from "@/lib/server/session";

const Body = z.object({
  startedAt: z.iso.datetime({ offset: true }).nullish(),
  endedAt: z.iso.datetime({ offset: true }).nullish(),
  minutes: z.number().int().min(0).max(720, "한 번에 12시간까지").nullish(),
  toPage: z.number().int().min(0).max(20000).nullish(),
  finished: z.boolean().optional(),
});

export async function POST(req: NextRequest, ctx: RouteContext<"/api/library/[id]/sessions">) {
  try {
    const { id } = await ctx.params;
    const res = await addSession(await currentUser(), id, Body.parse(await req.json()));
    return Response.json(res, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
