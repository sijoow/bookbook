// POST /api/auth/signup { handle, password } — 일반 회원 가입 → 바로 로그인(세션 쿠키) → 화면은 처음 가입 3단계(/welcome)로
// 11-13 사용자: "구글로 일단 하지 말고 오늘은 일반 회원으로"

import { cookies } from "next/headers";
import { z } from "zod";
import { handleSchema, passwordSchema } from "@/lib/auth/password";
import { sessionCookie } from "@/lib/server/auth";
import { errorResponse } from "@/lib/server/http";
import { signUpWithPassword } from "@/lib/server/members";
import { DEV_COOKIE, OUT_COOKIE, betaUser } from "@/lib/server/session";
import { BadRequestError } from "@/lib/server/errors";

const Body = z.object({ handle: handleSchema, password: passwordSchema });

export async function POST(req: Request) {
  try {
    if (betaUser()) throw new BadRequestError("지금은 베타라 새 가입을 받지 않아요");
    const b = Body.parse(await req.json());
    const { user, token } = await signUpWithPassword(b.handle, b.password, req.headers.get("user-agent"));
    const jar = await cookies();
    jar.set(sessionCookie(token));
    jar.delete(DEV_COOKIE);
    jar.delete(OUT_COOKIE);
    return Response.json({ handle: user.handle, onboarded: false }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
