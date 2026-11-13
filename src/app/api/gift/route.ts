// POST /api/gift { to, id } — 친구에게 선물 (내 포인트로 사서 친구 방에 배달 상자, 둘만의 이야기에 '선물' 한 줄)

import { z } from "zod";
import { giftItem } from "@/lib/server/gift";
import { errorResponse } from "@/lib/server/http";
import { currentUser } from "@/lib/server/session";

const Body = z.object({ to: z.string().min(1).max(40), id: z.string().min(1).max(40) });

export async function POST(req: Request) {
  try {
    const { to, id } = Body.parse(await req.json());
    return Response.json(await giftItem(await currentUser(), to, id), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
