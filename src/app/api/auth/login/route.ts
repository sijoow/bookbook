// POST /api/auth/login { handle, password } — 일반 회원 로그인 (5번 틀리면 15분 잠금) → 세션 쿠키

import { cookies } from "next/headers";
import { z } from "zod";
import { SESSION_COOKIE, endLogin, sessionCookie } from "@/lib/server/auth";
import { errorResponse } from "@/lib/server/http";
import { isAdmin } from "@/lib/server/admin";
import { logInWithPassword } from "@/lib/server/members";
import { DEV_COOKIE, OUT_COOKIE } from "@/lib/server/session";

const Body = z.object({ handle: z.string().trim().toLowerCase().min(1, "아이디를 적어 주세요").max(40), password: z.string().min(1, "비밀번호를 적어 주세요").max(100) });

export async function POST(req: Request) {
  try {
    const b = Body.parse(await req.json());
    const { user, token } = await logInWithPassword(b.handle, b.password, req.headers.get("user-agent"));
    const jar = await cookies();
    const old = jar.get(SESSION_COOKIE)?.value;
    if (old) await endLogin(old).catch(() => {});
    jar.set(sessionCookie(token));
    jar.delete(DEV_COOKIE);
    jar.delete(OUT_COOKIE);
    return Response.json({ handle: user.handle, onboarded: user.onboarded !== false, admin: isAdmin(user) });
  } catch (e) {
    return errorResponse(e);
  }
}
