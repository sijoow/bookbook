// GET /api/books/search?q=데미안&page=1 — YES24 국내도서 정확도순 검색 (docs/02 5장)
// 검색은 입력이 끝나고 한 번만 부른다(글자마다 X). 같은 검색어는 원본 응답을 24시간 캐시(lib/yes24/client).

import type { NextRequest } from "next/server";
import { z } from "zod";
import { ATTRIBUTION } from "@/lib/yes24/candidate";
import { searchBooks } from "@/lib/yes24/client";
import { errorResponse } from "@/lib/server/http";

const Query = z.object({
  q: z.string().trim().min(1, "검색어를 넣어 주세요").max(100),
  page: z.coerce.number().int().min(1).max(50).default(1),
});

export async function GET(req: NextRequest) {
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return Response.json({ error: "BAD_QUERY", message: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const { q, page } = parsed.data;

  try {
    const result = await searchBooks(q, page);
    return Response.json({ ...result, query: q, page, attribution: ATTRIBUTION });
  } catch (e) {
    return errorResponse(e);
  }
}
