// POST /api/auth/logout — 로그아웃: 로그인 세션을 지우고 쿠키를 지운다 (개발 중엔 시험 계정 쿠키도 지우고 '로그아웃했다' 표시)

import { cookies } from "next/headers";
import { SESSION_COOKIE, endLogin } from "@/lib/server/auth";
import { DEV_COOKIE, OUT_COOKIE } from "@/lib/server/session";

export async function POST() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await endLogin(token).catch(() => {});
  jar.delete(SESSION_COOKIE);
  jar.delete(DEV_COOKIE);
  jar.set(OUT_COOKIE, "1", { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 30 });
  return Response.json({ ok: true });
}
