// GET /api/friends — 내 책장 친구들 + 친구마다 통로 수(열린·희미)

import { connection } from "next/server";
import { errorResponse } from "@/lib/server/http";
import { listFriends } from "@/lib/server/friends";
import { currentUser } from "@/lib/server/session";

export async function GET() {
  await connection(); // 빌드 때 미리 만들지 않게 (try 밖에)
  try {
    return Response.json(await listFriends(await currentUser()));
  } catch (e) {
    return errorResponse(e);
  }
}
