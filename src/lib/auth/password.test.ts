import { describe, expect, it } from "vitest";
import { LOCK, handleSchema, hashPassword, lockState, passwordSchema, tempPassword, verifyPassword } from "./password";

describe("일반 회원 — 아이디·비밀번호", () => {
  it("비밀번호는 바꿔서만 저장되고, 맞는 것만 통과한다", () => {
    const h = hashPassword("book1234");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(h).not.toContain("book1234");
    expect(verifyPassword("book1234", h)).toBe(true);
    expect(verifyPassword("book12345", h)).toBe(false);
    expect(verifyPassword("book1234", null)).toBe(false);
    expect(verifyPassword("book1234", "엉터리")).toBe(false);
    expect(hashPassword("book1234")).not.toBe(h); // 소금이 달라 같은 비밀번호도 다르게
  });

  it("아이디 규칙 — 소문자로 바꾸고, 4~16자, 예약어·시험 계정 이름은 못 씀", () => {
    expect(handleSchema.parse(" Reader_01 ")).toBe("reader_01");
    expect(handleSchema.safeParse("abc").success).toBe(false);
    expect(handleSchema.safeParse("한글아이디").success).toBe(false);
    expect(handleSchema.safeParse("admin").success).toBe(false);
    expect(handleSchema.safeParse("jimin").success).toBe(false);
    expect(handleSchema.safeParse("a".repeat(17)).success).toBe(false);
  });

  it("비밀번호 규칙 — 8자 이상, 글자와 숫자를 섞어서", () => {
    expect(passwordSchema.safeParse("book1234").success).toBe(true);
    expect(passwordSchema.safeParse("책읽기좋아1234").success).toBe(true);
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
    expect(passwordSchema.safeParse("abcdefgh").success).toBe(false);
    expect(passwordSchema.safeParse("ab12").success).toBe(false);
  });

  it("임시 비밀번호는 10자, 글자·숫자가 섞여 규칙을 통과한다", () => {
    for (let i = 0; i < 20; i++) {
      const t = tempPassword();
      expect(t).toHaveLength(10);
      expect(passwordSchema.safeParse(t).success).toBe(true);
    }
  });

  it("잠금 — 정해진 때까지 잠기고 남은 분을 알려 준다", () => {
    const now = Date.now();
    expect(lockState(undefined, now).locked).toBe(false);
    const s = lockState({ fails: LOCK.fails, until: new Date(now + 14.5 * 60_000) }, now);
    expect(s).toEqual({ locked: true, minutesLeft: 15 });
    expect(lockState({ fails: LOCK.fails, until: new Date(now - 1000) }, now).locked).toBe(false);
  });
});
