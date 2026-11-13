// PUT /api/me/reading { bookId: string | null } — 책을 꺼내 읽기 시작/덮음 (책마을 — 친구에게 '읽는 중')

import { z } from "zod";
import { setReadingNow } from "@/lib/server/chat";
import { errorResponse } from "@/lib/server/http";
import { currentUser } from "@/lib/server/session";

const Body = z.object({ bookId: z.string().max(40).nullable() });

export async function PUT(req: Request) {
  try {
    const { bookId } = Body.parse(await req.json());
    await setReadingNow(await currentUser(), bookId);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
