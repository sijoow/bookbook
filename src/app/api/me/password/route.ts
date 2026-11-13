// POST /api/me/password { current, next } — 비밀번호 바꾸기 (관리자가 준 임시 비밀번호도 여기서 바꾼다)

import { z } from "zod";
import { passwordSchema } from "@/lib/auth/password";
import { errorResponse } from "@/lib/server/http";
import { changePassword } from "@/lib/server/members";
import { currentUser } from "@/lib/server/session";

const Body = z.object({ current: z.string().min(1, "지금 비밀번호를 적어 주세요").max(100), next: passwordSchema });

export async function POST(req: Request) {
  try {
    const u = await currentUser();
    const b = Body.parse(await req.json());
    await changePassword(u, b.current, b.next);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
