// GET /api/books/isbn/9788937460449 — 책을 고를 때·바코드를 찍었을 때 한 번. 쪽수·크기·책등까지 (detail=Y)
// ISBN-10 도 받아서 13 으로 바꾼다. 같은 ISBN 은 원본 응답을 24시간 캐시(lib/yes24/client).

import type { NextRequest } from "next/server";
import { toIsbn13 } from "@/lib/books/isbn";
import { ATTRIBUTION } from "@/lib/yes24/candidate";
import { getBookByIsbn } from "@/lib/yes24/client";
import { errorResponse } from "@/lib/server/http";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/books/isbn/[isbn13]">) {
  const { isbn13: raw } = await ctx.params;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // 잘못된 % 인코딩은 그대로 두고 아래 검사에서 거른다
  }
  const isbn13 = toIsbn13(decoded);
  if (!isbn13) {
    return Response.json({ error: "BAD_ISBN", message: "올바른 ISBN 이 아니에요 (978·979로 시작하는 13자리)" }, { status: 400 });
  }

  try {
    const result = await getBookByIsbn(isbn13);
    return Response.json({ ...result, isbn13, attribution: ATTRIBUTION }, { status: result.item ? 200 : 404 });
  } catch (e) {
    return errorResponse(e);
  }
}
