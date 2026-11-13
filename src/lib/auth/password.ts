// 일반 회원 (아이디 · 비밀번호) — 11-13 사용자: "구글로 일단 하지 말고 오늘은 일반 회원으로 해서 넣어 놓자 (구글은 추후에)"
// 비밀번호는 되돌릴 수 없게 scrypt 로 바꿔서만 저장한다 (원문은 어디에도 남기지 않는다). 서버·시험이 같이 쓰는 순수 부분.

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/** 아이디 = 친구에게 보이는 @아이디 (초대·친구 집 주소). 영어 소문자·숫자·_ 4~16자 */
const RESERVED = new Set(["admin", "root", "dev", "jimin", "hyunwoo", "mom", "api", "login", "logout", "welcome", "terms", "me", "bookbook", "system", "support", "help"]);
export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{4,16}$/, "아이디는 영어 소문자·숫자·_ 로 4~16자예요")
  .refine((h) => !RESERVED.has(h) && !h.startsWith("new_") && !/^new-/.test(h), "쓸 수 없는 아이디예요");

/** 비밀번호 — 8~64자, 글자와 숫자를 섞어서 */
export const passwordSchema = z
  .string()
  .min(8, "비밀번호는 8자 이상이에요")
  .max(64, "비밀번호는 64자까지예요")
  .refine((p) => /[A-Za-z가-힣]/.test(p) && /\d/.test(p), "비밀번호에 글자와 숫자를 섞어 주세요");

const N = 16384;
const R = 8;
const P = 1;
const LEN = 32;

/** "scrypt$N$r$p$salt$hash" (base64) */
export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, LEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(pw: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [kind, n, r, p, saltB64, hashB64] = stored.split("$");
  if (kind !== "scrypt" || !saltB64 || !hashB64) return false;
  const want = Buffer.from(hashB64, "base64");
  const got = scryptSync(pw, Buffer.from(saltB64, "base64"), want.length, { N: Number(n), r: Number(r), p: Number(p) });
  return got.length === want.length && timingSafeEqual(got, want);
}

/** 관리자가 주는 임시 비밀번호 — 헷갈리는 글자(0·o·1·l) 없이 글자+숫자 10자 */
export function tempPassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (s: string) => s[randomBytes(1)[0] % s.length];
  const chars = Array.from({ length: 7 }, () => pick(letters)).concat(Array.from({ length: 3 }, () => pick(digits)));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** 로그인 잠금 — 5번 틀리면 15분 */
export const LOCK = { fails: 5, minutes: 15 } as const;
export function lockState(lock: { fails?: number; until?: Date | null } | undefined, now: number): { locked: boolean; minutesLeft: number } {
  const until = lock?.until ? new Date(lock.until).getTime() : 0;
  if (until > now) return { locked: true, minutesLeft: Math.ceil((until - now) / 60_000) };
  return { locked: false, minutesLeft: 0 };
}
