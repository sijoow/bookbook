// GET /api/shop — 상점: 물건(값·가졌나·배달 중인가) · 내 포인트 · 최근 포인트 내역
// POST /api/shop { id } — 사기 (포인트를 빼고 배달 상자로). 11-13 사용자: "포인트로 장식품을 구매해서 내 집을 꾸미는 시스템"

import { connection } from "next/server";
import { z } from "zod";
import { POINTS, TRACK, itemIdSchema } from "@/lib/deco/items";
import { buyItem, decoState, pointHistory } from "@/lib/server/deco";
import { errorResponse } from "@/lib/server/http";
import { currentUser } from "@/lib/server/session";

export async function GET() {
  await connection(); // 요청마다 (try 밖에)
  try {
    const u = await currentUser();
    const { points, deco } = await decoState(u);
    return Response.json({
      points,
      rules: POINTS,
      items: TRACK.map((t) => ({ ...t, owned: deco.owned.includes(t.id), coming: deco.boxes.includes(t.id) })),
      history: await pointHistory(u, 20),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

const Body = z.object({ id: itemIdSchema });

export async function POST(req: Request) {
  try {
    const u = await currentUser();
    const { id } = Body.parse(await req.json());
    const r = await buyItem(u, id);
    return Response.json({ item: r.item, points: r.points, pending: r.deco.boxes.length, deco: r.deco }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
