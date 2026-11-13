// GET /api/auth/google/callback?code&state — 구글이 돌려보내는 곳.
// state 확인 → code+verifier 로 토큰 교환 → id_token 확인 → 사용자 찾기/만들기 → 세션 쿠키 → 처음이면 가입 화면, 아니면 원래 가려던 곳

import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, readIdToken, safeNext } from "@/lib/auth/google";
import { OAUTH_COOKIE, appOrigin, createLogin, googleKeys, googleUser, sessionCookie } from "@/lib/server/auth";
import { DEV_COOKIE, OUT_COOKIE } from "@/lib/server/session";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams; // 요청값을 먼저 (cacheComponents)
  const code = sp.get("code");
  const state = sp.get("state");
  const denied = sp.get("error");
  const saved = req.cookies.get(OAUTH_COOKIE)?.value;
  const origin = appOrigin(req);
  const to = (path: string) => {
    const r = NextResponse.redirect(new URL(path, origin));
    r.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth/google" });
    return r;
  };
  if (denied) return to("/login?error=google_cancel");
  let st: { state?: string; verifier?: string; next?: string } = {};
  try {
    st = JSON.parse(saved ?? "{}");
  } catch {
    st = {};
  }
  if (!code || !state || !st.state || st.state !== state || !st.verifier) return to("/login?error=google_state");
  const keys = googleKeys();
  if (!keys) return to("/login?error=google_off");
  try {
    const idToken = await exchangeCode({ code, verifier: st.verifier, redirectUri: `${origin}/api/auth/google/callback`, ...keys });
    const profile = readIdToken(idToken, keys.clientId, Math.floor(Date.now() / 1000));
    const user = await googleUser(profile);
    if (user.suspendedAt) return to("/login?error=suspended");
    const token = await createLogin(user._id, req.headers.get("user-agent"));
    const res = to(user.onboarded === false ? "/welcome" : safeNext(st.next));
    res.cookies.set(sessionCookie(token));
    res.cookies.delete(DEV_COOKIE);
    res.cookies.delete(OUT_COOKIE);
    return res;
  } catch (e) {
    console.error("[google]", (e as Error).message);
    return to("/login?error=google");
  }
}
