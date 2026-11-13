// GET /api/chat — 친구마다 안 읽은 이야기 + 지금 읽는 친구 (홈 서랍)

import { connection } from "next/server";
import { readingFriends, unreadChats } from "@/lib/server/chat";
import { errorResponse } from "@/lib/server/http";
import { currentUser } from "@/lib/server/session";

export async function GET() {
  await connection(); // 빌드 때 미리 만들지 않게 (try 밖에)
  try {
    const u = await currentUser();
    const [unread, reading] = await Promise.all([unreadChats(u), readingFriends(u)]);
    return Response.json({ unread, reading });
  } catch (e) {
    return errorResponse(e);
  }
}
