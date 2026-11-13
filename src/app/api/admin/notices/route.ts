// GET /api/admin/notices — 공지 목록 / POST { text, level } — 새 공지 (켜면 전에 켜진 공지는 꺼진다 — 한 번에 하나). 관리자만

import { connection } from "next/server";
import { z } from "zod";
import { addNotice, listNotices, requireAdmin } from "@/lib/server/admin";
import { errorResponse } from "@/lib/server/http";

export async function GET() {
  await connection();
  try {
    await requireAdmin();
    return Response.json({ notices: await listNotices() });
  } catch (e) {
    return errorResponse(e);
  }
}

const Body = z.object({ text: z.string().trim().min(2, "공지를 적어 주세요").max(120, "공지는 120자까지예요"), level: z.enum(["info", "event", "warn"]) });

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const b = Body.parse(await req.json());
    return Response.json(await addNotice(admin, b.text, b.level), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
