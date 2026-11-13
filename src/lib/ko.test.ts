import { describe, expect, it } from "vitest";
import { hasBatchim, josa } from "./ko";

describe("josa", () => {
  it.each([
    ["코스모스", "를"],
    ["데미안", "을"],
    ["소년이 온다", "를"],
    ["프로젝트 헤일메리", "를"],
    ["급류", "를"],
    ["아몬드", "를"],
    ["모순", "을"],
  ])("『%s』 + %s", (title, want) => {
    expect(josa(title, "을", "를")).toBe(want);
  });

  it("숫자로 끝나면 읽는 소리로 (토지 1 = 일 → 받침, 토지 2 = 이 → 없음)", () => {
    expect(josa("토지 1", "을", "를")).toBe("을");
    expect(josa("토지 2", "을", "를")).toBe("를");
  });

  it("영어로 끝나면 둘 다", () => {
    expect(josa("COSMOS", "을", "를")).toBe("을(를)");
  });

  it("끝의 괄호·따옴표는 건너뛴다", () => {
    expect(hasBatchim("데미안 (리커버)")).toBe(false); // '버'
    expect(hasBatchim("『아몬드』")).toBe(false);
    expect(hasBatchim("")).toBeNull();
  });
});
