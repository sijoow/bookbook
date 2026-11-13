// PATCH /api/admin/users/{handle} { suspend?: {reason}|null, points?: {delta, note}, resetNickname?: true, resetPassword?: true } — 정지·해제 · 포인트 · 닉네임 초기화 · 임시 비밀번호
// DELETE /api/admin/users/{handle}?confirm={handle} — 탈퇴 처리 (그 사람 데이터 모두 지움). 관리자만

import type { NextRequest } from "next/server";
import { z } from "zod";
import { changeUser, removeUser, requireAdmin } from "@/lib/server/admin";
import { BadRequestError } from "@/lib/server/errors";
import { errorResponse } from "@/lib/server/http";

const Body = z
  .object({
    suspend: z.object({ reason: z.string().trim().min(1, "정지 이유를 적어 주세요").max(100) }).nullable().optional(),
    points: z.object({ delta: z.number().int().min(-100000).max(100000).refine((n) => n !== 0, "0 은 안 돼요"), note: z.string().trim().min(1, "이유를 적어 주세요").max(60) }).optional(),
    resetNickname: z.literal(true).optional(),
    resetPassword: z.literal(true).optional(),
  })
  .refine((b) => b.suspend !== undefined || b.points || b.resetNickname || b.resetPassword, { message: "바꿀 것이 없어요" });

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/admin/users/[handle]">) {
  const { handle } = await ctx.params;
  try {
    const admin = await requireAdmin();
    return Response.json(await changeUser(admin, handle, Body.parse(await req.json())));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/admin/users/[handle]">) {
  const { handle } = await ctx.params;
  const confirm = req.nextUrl.searchParams.get("confirm");
  try {
    const admin = await requireAdmin();
    if (confirm !== handle) throw new BadRequestError("확인용 아이디가 맞지 않아요");
    return Response.json({ removed: await removeUser(admin, handle) });
  } catch (e) {
    return errorResponse(e);
  }
}
