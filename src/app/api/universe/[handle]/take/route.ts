// POST /api/universe/{handle}/take — 친구 책을 내 책장 '읽고 싶은'으로 담기 { bookId }

import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/server/http";
import { takeFromFriend } from "@/lib/server/friends";
import { currentUser } from "@/lib/server/session";

const Body = z.object({ bookId: z.string().regex(/^[a-f0-9]{24}$/, "책을 찾을 수 없어요") });

export async function POST(req: NextRequest, ctx: RouteContext<"/api/universe/[handle]/take">) {
  try {
    const { handle } = await ctx.params;
    const { bookId } = Body.parse(await req.json());
    const res = await takeFromFriend(await currentUser(), handle, bookId);
    return Response.json(res, { status: res.duplicate ? 200 : 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
