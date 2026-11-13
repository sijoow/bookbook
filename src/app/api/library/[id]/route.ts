// GET/PATCH/DELETE /api/library/{id} — 서재 책 한 권 (+ 메모)

import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/server/http";
import { deleteBook, getBook, updateBook } from "@/lib/server/library";
import { currentUser } from "@/lib/server/session";

const Patch = z.object({
  status: z.enum(["want", "reading", "read", "stopped"]).optional(),
  rating: z.number().min(0.5).max(5).multipleOf(0.5).nullable().optional(),
  oneLiner: z.string().max(120, "한줄평은 120자까지").nullable().optional(),
  pages: z.number().int().min(1).max(20000).nullable().optional(),
  currentPage: z.number().int().min(0).max(20000).nullable().optional(),
});

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/library/[id]">) {
  try {
    const { id } = await ctx.params;
    return Response.json(await getBook(await currentUser(), id));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/library/[id]">) {
  try {
    const { id } = await ctx.params;
    const book = await updateBook(await currentUser(), id, Patch.parse(await req.json()));
    return Response.json({ book });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/library/[id]">) {
  try {
    const { id } = await ctx.params;
    await deleteBook(await currentUser(), id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
