// 개발용 시험 계정 — GET: 계정 목록·지금 계정(로그아웃이면 null), POST { handle }: 그 계정으로 / POST { fresh: true }: 새로 가입해 보기
// / POST { google: { sub, email } }: 가짜 구글 로그인 — 키 없이도 진짜 세션(bb_session)·가입·정지·탈퇴 길을 시험한다. 운영에선 404.

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/server/http";
import { SESSION_COOKIE, createLogin, endLogin, googleUser, sessionCookie } from "@/lib/server/auth";
import { DEV_ACCOUNTS, DEV_COOKIE, OUT_COOKIE, currentUser, betaUser, devAllowed } from "@/lib/server/session";

const notFound = () => Response.json({ error: "NOT_FOUND", message: "개발 중에만 쓰는 기능이에요" }, { status: 404 });

export async function GET() {
  await connection(); // 쿠키를 읽는다 (try 밖에)
  if (!devAllowed()) return notFound();
  const me = await currentUser().catch(() => null);
  return Response.json({ accounts: DEV_ACCOUNTS, current: me?.handle ?? null, beta: Boolean(betaUser()) }); // 베타면 '새로 가입해 보기' 꺼짐
}

const Body = z.union([
  z.object({ fresh: z.literal(true) }),
  z.object({ handle: z.enum(DEV_ACCOUNTS.map((a) => a.handle) as [string, ...string[]]) }),
  z.object({ google: z.object({ sub: z.string().min(3).max(40), email: z.string().email().max(120).optional() }) }),
]);

export async function POST(req: NextRequest) {
  if (!devAllowed()) return notFound();
  try {
    const body = Body.parse(await req.json());
    const jar = await cookies();
    if ("google" in body) {
      const user = await googleUser({ sub: `dev-${body.google.sub}`, email: body.google.email ?? null, emailVerified: true });
      if (user.suspendedAt) return Response.json({ error: "AUTH", message: "이용이 정지된 계정이에요" }, { status: 401 });
      const old = jar.get(SESSION_COOKIE)?.value;
      if (old) await endLogin(old).catch(() => {});
      jar.set(sessionCookie(await createLogin(user._id, req.headers.get("user-agent"))));
      jar.delete(DEV_COOKIE);
      jar.delete(OUT_COOKIE);
      return Response.json({ current: user.handle, onboarded: user.onboarded !== false });
    }
    const handle = "fresh" in body ? `new-${randomBytes(4).toString("hex").slice(0, 6)}` : body.handle;
    jar.delete(SESSION_COOKIE); // 시험 계정으로 바꾸면 진짜 로그인은 나간다
    jar.set(DEV_COOKIE, handle, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 30 });
    jar.delete(OUT_COOKIE);
    return Response.json({ current: handle, fresh: "fresh" in body });
  } catch (e) {
    return errorResponse(e);
  }
}
