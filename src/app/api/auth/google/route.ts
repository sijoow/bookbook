// GET /api/auth/google?next=/… — 구글로 보낸다 (state·PKCE 는 10분짜리 쿠키에). 11-13 사용자: "일단은 베타일 땐 구글만"
// 키: GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET (서버에만), 돌아올 주소 = APP_URL(없으면 들어온 주소) + /api/auth/google/callback

import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authUrl, pkcePair, safeNext } from "@/lib/auth/google";
import { appOrigin, googleKeys, oauthCookie } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get("next")); // 요청값을 먼저 (cacheComponents)
  const origin = appOrigin(req);
  const keys = googleKeys();
  if (!keys) return NextResponse.redirect(new URL("/login?error=google_off", origin));
  const state = randomBytes(16).toString("base64url");
  const { verifier, challenge } = pkcePair();
  const res = NextResponse.redirect(authUrl({ clientId: keys.clientId, redirectUri: `${origin}/api/auth/google/callback`, state, challenge }));
  res.cookies.set(oauthCookie(JSON.stringify({ state, verifier, next })));
  return res;
}
