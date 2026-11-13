// 구글 로그인 (OAuth 2.0 + OpenID Connect) — 서버와 시험이 같이 쓰는 순수 부분.
// 11-13 사용자: "일단은 베타일 땐 구글만" — 카카오는 출시 뒤에.
// 흐름: /api/auth/google 이 state·PKCE 를 쿠키에 두고 구글로 → 구글이 /api/auth/google/callback?code&state 로 돌려보냄
//   → state 확인 → code + verifier 로 토큰 교환 → id_token 의 aud·iss·exp 확인 → 사용자 찾기/만들기 → 세션 쿠키

import { createHash, randomBytes } from "node:crypto";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/** PKCE — 코드를 가로채도 verifier 없이는 못 쓰게 */
export function challengeOf(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: challengeOf(verifier) };
}

export function authUrl(o: { clientId: string; redirectUri: string; state: string; challenge: string }): string {
  const u = new URL(GOOGLE_AUTH_URL);
  u.search = new URLSearchParams({
    client_id: o.clientId,
    redirect_uri: o.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: o.state,
    code_challenge: o.challenge,
    code_challenge_method: "S256",
    prompt: "select_account", // 폰에 구글 계정이 여럿이면 고르게
  }).toString();
  return u.toString();
}

export type GoogleProfile = { sub: string; email: string | null; emailVerified: boolean };

/**
 * id_token 확인 — 토큰 끝점에서 TLS 로 바로 받은 토큰이라 서명 대신 aud·iss·exp 를 본다 (OpenID Connect Core 3.1.3.7).
 * 이름·사진은 쓰지 않는다 (닉네임은 가입 화면에서 직접, 실명이 친구에게 보이지 않게).
 */
export function readIdToken(idToken: string, clientId: string, nowSec: number): GoogleProfile {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("id_token 모양이 이상해요");
  let p: Record<string, unknown>;
  try {
    p = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("id_token 을 읽지 못했어요");
  }
  if (p.aud !== clientId) throw new Error("다른 앱의 토큰이에요");
  if (typeof p.iss !== "string" || !ISSUERS.includes(p.iss)) throw new Error("구글 토큰이 아니에요");
  if (typeof p.exp !== "number" || p.exp < nowSec - 60) throw new Error("토큰이 만료됐어요");
  if (typeof p.sub !== "string" || !p.sub) throw new Error("구글 계정 번호가 없어요");
  return { sub: p.sub, email: typeof p.email === "string" ? p.email : null, emailVerified: p.email_verified === true || p.email_verified === "true" };
}

/** code → id_token (fetch 는 시험에서 바꿔 끼운다) */
export async function exchangeCode(
  o: { code: string; verifier: string; redirectUri: string; clientId: string; clientSecret: string },
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const r = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: o.code,
      client_id: o.clientId,
      client_secret: o.clientSecret,
      redirect_uri: o.redirectUri,
      grant_type: "authorization_code",
      code_verifier: o.verifier,
    }),
  });
  const j = (await r.json().catch(() => ({}))) as { id_token?: unknown; error?: unknown };
  if (!r.ok || typeof j.id_token !== "string") throw new Error(`구글 토큰 교환 실패 (${r.status}${typeof j.error === "string" ? ` ${j.error}` : ""})`);
  return j.id_token;
}

/** 로그인 뒤 돌아갈 곳 — 우리 앱 안 주소만 (다른 사이트로 튕기지 않게) */
export function safeNext(v: string | null | undefined): string {
  return v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/login") && !v.startsWith("/api/") ? v : "/";
}

/** 로그인 화면이 보여 줄 말 (?error=…) */
export const LOGIN_ERROR: Record<string, string> = {
  google_off: "구글 로그인은 곧 열려요. 조금만 기다려 주세요.",
  google_cancel: "구글 로그인을 그만뒀어요.",
  google_state: "로그인 시간이 지났어요. 다시 눌러 주세요.",
  google: "구글 로그인 중에 문제가 생겼어요. 다시 해 주세요.",
  suspended: "이용이 정지된 계정이에요. 문의해 주세요.",
};
