import { describe, expect, it } from "vitest";
import { normalizeFirstAuthor, normalizeTitle, workKey } from "./workKey";

describe("normalizeTitle — 판본이 달라도 같은 책", () => {
  const base = normalizeTitle("데미안");

  it.each([
    "데미안 (리커버 에디션)",
    "[큰글자도서] 데미안",
    "데미안 - 에밀 싱클레어의 청소년 시절 이야기",
    "데미안 : 에밀 싱클레어의 청소년 시절 이야기",
    "데미안(양장본)",
    "데미안 리커버 에디션",
    "데미안（리커버）", // 전각 괄호
    "데미안 개정판",
  ])("%s → 데미안", (t) => {
    expect(normalizeTitle(t)).toBe(base);
  });

  it("권 번호는 남긴다 (1권과 2권은 다른 책)", () => {
    expect(normalizeTitle("토지 1")).not.toBe(normalizeTitle("토지 2"));
    expect(normalizeTitle("해리 포터와 마법사의 돌 1")).toBe(normalizeTitle("해리 포터와 마법사의 돌 (1)"));
  });

  it("세트(전집)는 낱권과 다른 책", () => {
    expect(normalizeTitle("해리 포터 세트")).not.toBe(normalizeTitle("해리 포터"));
  });

  it("단어 속 하이픈은 부제로 자르지 않는다", () => {
    expect(normalizeTitle("X-MEN")).toBe("xmen");
  });

  it("제목 전체가 괄호여도 비지 않는다", () => {
    expect(normalizeTitle("[데미안]")).toBe("데미안");
  });
});

describe("normalizeFirstAuthor", () => {
  it.each([
    ["헤르만 헤세 저/전영애 역", "헤르만헤세"],
    ["헤르만 헤세(Hermann Hesse) 저", "헤르만헤세"],
    ["손원평 지음", "손원평"],
    ["김난도, 전미영 외 5명 저", "김난도"],
    ["백희나 글·그림", "백희나"],
    ["한강", "한강"],
    ["이편", "이편"], // 띄어쓰기 없는 끝 글자는 역할 표기로 보지 않는다
  ])("%s → %s", (raw, want) => {
    expect(normalizeFirstAuthor(raw)).toBe(want);
  });

  it("없으면 빈 문자열", () => {
    expect(normalizeFirstAuthor(null)).toBe("");
  });
});

describe("workKey", () => {
  it("번역자가 달라도 원저자가 같으면 같은 책", () => {
    expect(workKey("데미안", "헤르만 헤세 저/전영애 역")).toBe(workKey("데미안 (리커버 에디션)", "헤르만 헤세 저/안인희 역"));
  });

  it("제목이 같아도 저자가 다르면 다른 책", () => {
    expect(workKey("어린 왕자", "생텍쥐페리 저")).not.toBe(workKey("어린 왕자", "다른 사람 저"));
  });
});
