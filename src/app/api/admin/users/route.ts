// GET /api/admin/users?q=&page= — 회원 목록 (닉네임·아이디·이메일로 찾기, 30명씩). 관리자만

import type { NextRequest } from "next/server";
import { listUsers, requireAdmin } from "@/lib/server/admin";
import { errorResponse } from "@/lib/server/http";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60); // 요청값을 먼저 (cacheComponents)
  const page = Math.max(0, Math.floor(Number(req.nextUrl.searchParams.get("page")) || 0));
  try {
    await requireAdmin();
    return Response.json(await listUsers(q, page));
  } catch (e) {
    return errorResponse(e);
  }
}
