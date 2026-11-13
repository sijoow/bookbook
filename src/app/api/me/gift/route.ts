// POST /api/me/gift — 배달 상자 하나 열기 (상점에서 산 물건이 상자로 온다). 열린 물건은 바로 하고/놓는다.

import { errorResponse } from "@/lib/server/http";
import { openOneGift } from "@/lib/server/deco";
import { BadRequestError } from "@/lib/server/errors";
import { currentUser } from "@/lib/server/session";

export async function POST() {
  try {
    const r = await openOneGift(await currentUser());
    if (!r) throw new BadRequestError("열 상자가 없어요 — 상점에서 물건을 사면 상자로 와요");
    return Response.json(r);
  } catch (e) {
    return errorResponse(e);
  }
}
