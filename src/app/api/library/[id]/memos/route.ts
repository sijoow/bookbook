// POST /api/library/{id}/memos — 메모 남기기 { text, page? }

import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/server/http";
import { addMemo } from "@/lib/server/library";
import { currentUser } from "@/lib/server/session";

const Body = z.object({
  text: z.string().trim().min(1, "메모를 적어 주세요").max(1000, "메모는 1000자까지"),
  page: z.number().int().min(1).max(20000).nullish(),
});

export async function POST(req: NextRequest, ctx: RouteContext<"/api/library/[id]/memos">) {
  try {
    const { id } = await ctx.params;
    const memo = await addMemo(await currentUser(), id, Body.parse(await req.json()));
    return Response.json({ memo }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
