import { describe, expect, it, vi } from "vitest";
import { authUrl, challengeOf, exchangeCode, pkcePair, readIdToken, safeNext } from "./google";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = (p: object) => `${b64({ alg: "RS256" })}.${b64(p)}.sig`;
const NOW = 1_800_000_000;
const ok = { aud: "client-1", iss: "https://accounts.google.com", exp: NOW + 600, sub: "1234567890", email: "reader@example.com", email_verified: true };

describe("구글 로그인", () => {
  it("PKCE — RFC 7636 예시 값과 같다", () => {
    expect(challengeOf("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    const p = pkcePair();
    expect(p.verifier.length).toBeGreaterThanOrEqual(43);
    expect(challengeOf(p.verifier)).toBe(p.challenge);
  });

  it("구글로 보낼 주소에 state·PKCE·돌아올 주소가 들어간다", () => {
    const u = new URL(authUrl({ clientId: "client-1", redirectUri: "https://bb.example/api/auth/google/callback", state: "st", challenge: "ch" }));
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("state")).toBe("st");
    expect(u.searchParams.get("code_challenge")).toBe("ch");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("redirect_uri")).toBe("https://bb.example/api/auth/google/callback");
    expect(u.searchParams.get("scope")).toBe("openid email profile");
  });

  it("id_token — 우리 앱·구글·안 만료만 받는다", () => {
    expect(readIdToken(token(ok), "client-1", NOW)).toEqual({ sub: "1234567890", email: "reader@example.com", emailVerified: true });
    expect(() => readIdToken(token({ ...ok, aud: "other" }), "client-1", NOW)).toThrow("다른 앱");
    expect(() => readIdToken(token({ ...ok, iss: "https://evil.example" }), "client-1", NOW)).toThrow("구글 토큰이 아니에요");
    expect(() => readIdToken(token({ ...ok, exp: NOW - 3600 }), "client-1", NOW)).toThrow("만료");
    expect(() => readIdToken(token({ ...ok, sub: "" }), "client-1", NOW)).toThrow("계정 번호");
    expect(() => readIdToken("이상한값", "client-1", NOW)).toThrow("모양");
  });

  it("code 를 토큰으로 바꾼다 (verifier 를 같이 보낸다)", async () => {
    const f = vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => {
      const body = new URLSearchParams(String(init?.body));
      expect(body.get("code_verifier")).toBe("ver");
      expect(body.get("grant_type")).toBe("authorization_code");
      return new Response(JSON.stringify({ id_token: "abc" }), { status: 200 });
    });
    await expect(exchangeCode({ code: "c", verifier: "ver", redirectUri: "r", clientId: "i", clientSecret: "s" }, f as unknown as typeof fetch)).resolves.toBe("abc");
    const bad = vi.fn(async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }));
    await expect(exchangeCode({ code: "c", verifier: "v", redirectUri: "r", clientId: "i", clientSecret: "s" }, bad as unknown as typeof fetch)).rejects.toThrow("invalid_grant");
  });

  it("돌아갈 곳은 우리 앱 안 주소만", () => {
    expect(safeNext("/decorate")).toBe("/decorate");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("/login")).toBe("/");
    expect(safeNext("/api/me")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});
