// GET /api/visits — 내 도서관에 놀러 온 친구 (14일, 사람마다 마지막 방문·발도장)

import { connection } from "next/server";
import { errorResponse } from "@/lib/server/http";
import { currentUser } from "@/lib/server/session";
import { listGuests } from "@/lib/server/visits";

export async function GET() {
  await connection(); // 쿠키를 읽는다 (try 밖에)
  try {
    return Response.json({ guests: await listGuests(await currentUser()) });
  } catch (e) {
    return errorResponse(e);
  }
}
