// GET /api/library — 내 서재 전체 + 우주 설정
// POST /api/library — 책 추가: { isbn13 | itemId, status } (YES24 에서 서버가 직접 채움) 또는 { manual: { title, author, pages }, status }

import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import { toIsbn13 } from "@/lib/books/isbn";
import { ATTRIBUTION } from "@/lib/yes24/candidate";
import { errorResponse } from "@/lib/server/http";
import { addFromYes24, addManual, listBooks } from "@/lib/server/library";
import { currentUser } from "@/lib/server/session";

const Status = z.enum(["want", "reading", "read", "stopped"]);

// 직접 입력을 먼저 — ISBN 쪽은 필드가 다 선택이라 앞에 두면 { manual } 요청도 통과해 버린다 (11-12 발견)
const Add = z.union([
  z.object({
    manual: z.object({
      title: z.string().trim().min(1, "제목을 넣어 주세요").max(200),
      author: z.string().trim().max(100).nullish(),
      pages: z.number().int().min(1).max(20000).nullish(),
      isbn13: z.string().trim().nullish(), // 바코드는 찍었는데 YES24 에 없는 책
    }),
    status: Status,
  }),
  z.object({
    isbn13: z.string().trim().optional(),
    itemId: z.number().int().positive().optional(),
    status: Status,
    from: z.enum(["search", "barcode"]).optional(),
  }),
]);

export async function GET() {
  // 요청값을 안 읽는 GET 이라 빌드 때 미리 만들지 않게. try 밖에 둔다 — 미리 그리기를 멈추는 신호(reject)를 잡으면 안 된다
  await connection();
  try {
    const user = await currentUser();
    const books = await listBooks(user);
    return Response.json({ books, goalCm: user.goalCm, universeName: user.universeName, attribution: ATTRIBUTION });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    const body = Add.parse(await req.json());
    if ("manual" in body) {
      const isbn13 = body.manual.isbn13 ? toIsbn13(body.manual.isbn13) : null;
      const book = await addManual(user, { ...body.manual, isbn13, status: body.status });
      return Response.json({ book, duplicate: false }, { status: 201 });
    }
    const isbn13 = body.isbn13 ? (toIsbn13(body.isbn13) ?? undefined) : undefined;
    if (!isbn13 && !body.itemId) return Response.json({ error: "BAD_INPUT", message: "ISBN 이나 상품 번호가 필요해요" }, { status: 400 });
    const res = await addFromYes24(user, { isbn13, itemId: body.itemId, status: body.status, from: body.from });
    return Response.json(res, { status: res.duplicate ? 200 : 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
