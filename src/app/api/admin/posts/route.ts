// GET /api/admin/posts?kind=all|stamp|review — 남에게 보이는 글 (발도장 한마디 · 한줄평) 최근 순
// PATCH /api/admin/posts { kind, id, hide } — 숨기기/보이기 (메모는 본인만 보는 글이라 여기 없다). 관리자만

import type { NextRequest } from "next/server";
import { z } from "zod";
import { hidePost, listPosts, requireAdmin } from "@/lib/server/admin";
import { errorResponse } from "@/lib/server/http";

export async function GET(req: NextRequest) {
  const k = req.nextUrl.searchParams.get("kind"); // 요청값을 먼저
  const kind = k === "stamp" || k === "review" ? k : "all";
  try {
    await requireAdmin();
    return Response.json({ posts: await listPosts(kind) });
  } catch (e) {
    return errorResponse(e);
  }
}

const Body = z.object({ kind: z.enum(["stamp", "review"]), id: z.string().min(1), hide: z.boolean() });

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const b = Body.parse(await req.json());
    return Response.json(await hidePost(b.kind, b.id, b.hide));
  } catch (e) {
    return errorResponse(e);
  }
}
