// PATCH /api/admin/notices/{id} { active } — 켜기/끄기 / DELETE — 지우기. 관리자만

import type { NextRequest } from "next/server";
import { z } from "zod";
import { deleteNotice, requireAdmin, setNotice } from "@/lib/server/admin";
import { errorResponse } from "@/lib/server/http";

const Body = z.object({ active: z.boolean() });

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/admin/notices/[id]">) {
  const { id } = await ctx.params;
  try {
    await requireAdmin();
    await setNotice(id, Body.parse(await req.json()).active);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/admin/notices/[id]">) {
  const { id } = await ctx.params;
  try {
    await requireAdmin();
    await deleteNotice(id);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
