// GET /api/sessions — 최근 120일 독서 기록 (읽는 속도·주간 시간·기록 화면)

import { connection } from "next/server";
import { errorResponse } from "@/lib/server/http";
import { listSessions } from "@/lib/server/library";
import { currentUser } from "@/lib/server/session";

export async function GET() {
  // 요청값을 안 읽는 GET 이라 빌드 때 미리 만들지 않게. try 밖에 둔다 — 미리 그리기를 멈추는 신호(reject)를 잡아 버리면 빌드에 오류 로그가 남는다
  await connection();
  try {
    return Response.json({ sessions: await listSessions(await currentUser()) });
  } catch (e) {
    return errorResponse(e);
  }
}
