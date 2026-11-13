// GET /api/invites/{code} — 초대 미리보기(초대한 사람 책장) · POST — 친구 되기

import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/server/http";
import { acceptInvite, viewInvite } from "@/lib/server/friends";
import { currentUser } from "@/lib/server/session";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/invites/[code]">) {
  try {
    const { code } = await ctx.params;
    return Response.json(await viewInvite(await currentUser(), code));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/invites/[code]">) {
  try {
    const { code } = await ctx.params;
    return Response.json({ friend: await acceptInvite(await currentUser(), code) });
  } catch (e) {
    return errorResponse(e);
  }
}
