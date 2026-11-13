// GET /api/notice — 앱에 띄울 공지 (지금 켜진 것 하나, 없으면 null). 로그인 없이도.

import { connection } from "next/server";
import { currentNotice } from "@/lib/server/admin";
import { errorResponse } from "@/lib/server/http";

export async function GET() {
  await connection();
  try {
    return Response.json({ notice: await currentNotice() });
  } catch (e) {
    return errorResponse(e);
  }
}
