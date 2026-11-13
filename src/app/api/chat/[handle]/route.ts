// GET /api/chat/{handle}?after=ISO — 그 친구와의 이야기 (내게 온 건 읽음으로) / POST {text?, book?} — 보내기 (책 추천 포함)

import type { NextRequest } from "next/server";
import { chatInput, chatWith, sendChat } from "@/lib/server/chat";
import { errorResponse } from "@/lib/server/http";
import { currentUser } from "@/lib/server/session";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/chat/[handle]">) {
  const { handle } = await ctx.params; // 요청값을 먼저 (try 밖에)
  const after = req.nextUrl.searchParams.get("after");
  try {
    const t = after ? new Date(after) : undefined;
    return Response.json(await chatWith(await currentUser(), handle, t && !Number.isNaN(t.getTime()) ? t : undefined));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request, ctx: RouteContext<"/api/chat/[handle]">) {
  try {
    const { handle } = await ctx.params;
    const msg = await sendChat(await currentUser(), handle, chatInput.parse(await req.json()));
    return Response.json({ message: msg }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
