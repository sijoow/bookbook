// PUT /api/library/order — 책장 순서 바꾸기 { ids: [책 id, …] } (앞에서부터)

import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/server/http";
import { reorderBooks } from "@/lib/server/library";
import { currentUser } from "@/lib/server/session";

const Body = z.object({ ids: z.array(z.string().regex(/^[a-f0-9]{24}$/)).max(5000) });

export async function PUT(req: NextRequest) {
  try {
    const { ids } = Body.parse(await req.json());
    return Response.json({ books: await reorderBooks(await currentUser(), ids) });
  } catch (e) {
    return errorResponse(e);
  }
}
