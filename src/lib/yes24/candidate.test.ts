import { describe, expect, it } from "vitest";
import { applySpine, fromYes24Item, isReadable, itemsOf, rankByTitle, toIsoDate } from "./candidate";
import { MOCK_ITEMS } from "./fixtures";

describe("fromYes24Item", () => {
  it("상세 응답 한 건을 책 후보로 (책등 전에는 쪽수 추정)", () => {
    const b = fromYes24Item(MOCK_ITEMS[0], "mock")!;
    expect(b.isbn13).toBe("9788937460449");
    expect(b.workKey).toBe("데미안|헤르만헤세");
    expect(b.thicknessMm).toBe(14); // 239쪽 × 0.05 + 2
    expect(b.thicknessSource).toBe("estimate");
    expect(b.dims).toEqual({ width: 132, height: 20, length: 225, weight: 327 });
    expect(b.publishDate).toBe("2000-12-20");
    expect(b.category).toBe("국내도서-소설/시/희곡");
  });

  it("같은 책 다른 판본은 workKey 가 같다", () => {
    const a = fromYes24Item(MOCK_ITEMS[0])!;
    const b = fromYes24Item(MOCK_ITEMS[1])!;
    expect(a.workKey).toBe(b.workKey);
    expect(a.isbn13).not.toBe(b.isbn13);
  });

  it("쪽수가 없으면 YES24 크기, 그것도 없으면 모름", () => {
    expect(fromYes24Item({ title: "책", width: 128, height: 20, length: 188 })).toMatchObject({ thicknessMm: 20, thicknessSource: "yes24" });
    expect(fromYes24Item({ title: "책" })).toMatchObject({ thicknessMm: null, thicknessSource: null });
  });

  it("숫자가 문자열로 와도 읽는다", () => {
    expect(fromYes24Item({ title: "책", pages: "320", itemId: "123", starScore: "9.3" })).toMatchObject({ pages: 320, itemId: 123, yes24Rating: 9.3 });
  });

  it("상품 링크는 애드온 → 모바일 → PC 순서, 애드온 미신청의 빈 문자열은 건너뛴다", () => {
    expect(fromYes24Item({ title: "책", link: "pc", mobileLink: "m", addOnLink: "add" })!.link).toBe("add");
    expect(fromYes24Item({ title: "책", link: "pc", mobileLink: "m", addOnLink: "" })!.link).toBe("m");
    expect(fromYes24Item({ title: "책", link: "pc" })!.link).toBe("pc");
  });

  it("책 소개는 bookIntroduction, 없으면 bookSummary", () => {
    expect(fromYes24Item({ title: "책", contentDetail: { bookIntroduction: "소개", bookSummary: "요약" } })!.intro).toBe("소개");
    expect(fromYes24Item({ title: "책", contentDetail: { bookIntroduction: "", bookSummary: "요약" } })!.intro).toBe("요약");
  });

  it("틀린 ISBN-13 이면 ISBN-10 으로 바꿔 쓴다", () => {
    expect(fromYes24Item({ title: "책", isbn13: "123", isbn10: "0306406152" })!.isbn13).toBe("9780306406157");
  });

  it("제목이 없으면 버린다", () => {
    expect(fromYes24Item({ title: "" })).toBeNull();
    expect(fromYes24Item({})).toBeNull();
  });
});

describe("applySpine", () => {
  const base = fromYes24Item({ ...MOCK_ITEMS[0], sideCover: "https://image.yes24.com/goods/176787/SIDE/L" })!;

  it("진짜 책등이면 비율로 두께를 바꾼다", () => {
    const b = applySpine(base, { w: 19, h: 400 });
    expect(b).toMatchObject({ thicknessMm: 10.7, thicknessSource: "spine", spinePx: { w: 19, h: 400 } });
    expect(b.sideCoverUrl).toBe(base.sideCoverUrl);
  });

  it("'이미지 준비중' 대체 그림이면 책등을 지우고 두께는 그대로", () => {
    const b = applySpine(base, { w: 280, h: 400 });
    expect(b.sideCoverUrl).toBeNull();
    expect(b.thicknessSource).toBe("estimate");
  });

  it("못 쟀으면(null) 그대로", () => {
    expect(applySpine(base, null)).toBe(base);
  });

  it("세로 길이가 없으면 비율만 남기고 두께는 그대로", () => {
    const noLen = { ...base, dims: { ...base.dims, length: null } };
    expect(applySpine(noLen, { w: 19, h: 400 })).toMatchObject({ spinePx: { w: 19, h: 400 }, thicknessSource: "estimate" });
  });
});

describe("rankByTitle", () => {
  const items = [
    { workKey: "필사의힘|알베르카뮈", name: "필사책" },
    { workKey: "이방인|알베르카뮈", name: "이방인" },
    { workKey: "이방인의노래|누군가", name: "딴 책" },
  ];

  it("제목이 검색어 안에 통째로 있으면 위로 ('이방인 카뮈' → 이방인)", () => {
    expect(rankByTitle(items, "이방인 카뮈").map((x) => x.name)).toEqual(["이방인", "필사책", "딴 책"]);
  });

  it("제목이 검색어와 같으면 맨 위, 같은 순위끼리는 원래 순서", () => {
    // '이방인의노래' 안에 '이방인' 이 통째로 있어 이방인이 필사책보다 위
    expect(rankByTitle(items, "이방인의 노래").map((x) => x.name)).toEqual(["딴 책", "이방인", "필사책"]);
  });
});

describe("helpers", () => {
  it("책 아닌 상품(클래스24·도서관련) 거르기", () => {
    expect(isReadable(fromYes24Item({ title: "책", goodsType: "도서" })!)).toBe(true);
    expect(isReadable(fromYes24Item({ title: "만화책", goodsType: "만화" })!)).toBe(true);
    expect(isReadable(fromYes24Item({ title: "강의", goodsType: "클래스24" })!)).toBe(false);
  });

  it("날짜 형식 맞추기", () => {
    expect(toIsoDate("20001220")).toBe("2000-12-20");
    expect(toIsoDate("2021-04-20T00:00:00.000+09:00")).toBe("2021-04-20");
    expect(toIsoDate("2021.04.20")).toBe("2021-04-20");
    expect(toIsoDate("")).toBeNull();
  });

  it("목록은 data.items, 단건 래퍼는 data.data", () => {
    expect(itemsOf({ items: [{ title: "a" }] })).toHaveLength(1);
    expect(itemsOf({ data: { title: "a" } })).toHaveLength(1);
    expect(itemsOf({ data: [{ title: "a" }, { title: "b" }] })).toHaveLength(2);
    expect(itemsOf(null)).toEqual([]);
  });
});
