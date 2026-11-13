// GET /api/books/picks — 맞춤 추천: 나의 독서 취향(분야·작가) + 많이 읽은 작가의 다른 책 + 친구 책장에서 (lib/server/picks)

import { connection } from "next/server";
import { ATTRIBUTION } from "@/lib/yes24/candidate";
import { errorResponse } from "@/lib/server/http";
import { picksFor } from "@/lib/server/picks";
import { currentUser } from "@/lib/server/session";

export async function GET() {
  await connection(); // 빌드 때 미리 만들지 않게 (try 밖에)
  try {
    return Response.json({ ...(await picksFor(await currentUser())), attribution: ATTRIBUTION });
  } catch (e) {
    return errorResponse(e);
  }
}
