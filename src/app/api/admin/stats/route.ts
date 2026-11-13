// GET /api/admin/stats — 대시보드: 합계 · 최근 14일(가입·하루 사용자·읽은 시간·다 읽은 책) · 많이 꽂힌 책 · 많이 산 물건. 관리자만 (아니면 404)

import { connection } from "next/server";
import { requireAdmin, stats } from "@/lib/server/admin";
import { errorResponse } from "@/lib/server/http";

export async function GET() {
  await connection(); // 요청마다 (try 밖에)
  try {
    await requireAdmin();
    return Response.json(await stats());
  } catch (e) {
    return errorResponse(e);
  }
}
