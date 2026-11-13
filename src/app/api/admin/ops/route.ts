// GET /api/admin/ops — 운영 상태: DB(응답 ms) · YES24(키·오늘 남은 호출) · 구글 키 · 앱 주소 · 서버(Node·켜진 시간) · 컬렉션 수. 관리자만

import { connection } from "next/server";
import { opsStatus, requireAdmin } from "@/lib/server/admin";
import { errorResponse } from "@/lib/server/http";

export async function GET() {
  await connection();
  try {
    await requireAdmin();
    return Response.json(await opsStatus());
  } catch (e) {
    return errorResponse(e);
  }
}
