import { describe, expect, it } from "vitest";
import { alsoLiked, authorPicks, friendPicks, genreOf, genreShort, readingTaste, tasteWeight, type FriendBook, type TasteBook } from "./picks";
import { workKey } from "./workKey";

const tb = (title: string, author: string, status: TasteBook["status"], rating: number | null = null, category = "국내도서-소설/시/희곡", at = 0): TasteBook => ({
  title,
  author,
  category,
  status,
  rating,
  workKey: workKey(title, author),
  at,
});
const fb = (title: string, author: string, status: TasteBook["status"], rating: number | null = null, oneLiner: string | null = null): FriendBook => ({
  ...tb(title, author, status, rating),
  coverUrl: `https://img/${title}`,
  isbn13: null,
  itemId: null,
  oneLiner,
});

describe("독서 취향", () => {
  it("무게 — 다 읽음 3 · 읽는 중 2 · 읽고 싶은 1 · 그만둠 0, 별 4개 넘으면 +1", () => {
    expect(tasteWeight({ status: "read", rating: 5 })).toBe(4);
    expect(tasteWeight({ status: "read", rating: 3 })).toBe(3);
    expect(tasteWeight({ status: "reading", rating: null })).toBe(2);
    expect(tasteWeight({ status: "want", rating: null })).toBe(1);
    expect(tasteWeight({ status: "stopped", rating: 5 })).toBe(0);
  });

  it("분야 이름", () => {
    expect(genreOf("국내도서-소설/시/희곡")).toBe("소설/시/희곡");
    expect(genreOf("국내도서-자연과학")).toBe("자연과학");
    expect(genreOf(null)).toBeNull();
    expect(genreShort("소설/시/희곡")).toBe("소설");
  });

  it("많이 읽은 분야·작가와 한 줄 분석 (그만둔 책·읽고 싶기만 한 작가는 빼고)", () => {
    const t = readingTaste([
      tb("데미안", "헤르만 헤세 저/전영애 역", "read", 5),
      tb("싯다르타", "헤르만 헤세 저/박병덕 역", "reading"),
      tb("소년이 온다", "한강 저", "read", 5, "국내도서-소설/시/희곡", 10),
      tb("코스모스", "칼 세이건 저/홍승수 역", "reading", null, "국내도서-자연과학"),
      tb("모순", "양귀자 저", "want"),
      tb("그만둔 책", "누구 저", "stopped", null, "국내도서-경제 경영"),
    ]);
    expect(t.books).toBe(5);
    expect(t.genres[0].name).toBe("소설/시/희곡");
    expect(t.genres.find((g) => g.name === "경제 경영")).toBeUndefined();
    expect(t.authors.map((a) => a.name)).toEqual(["헤르만 헤세", "한강", "칼 세이건"]); // 양귀자(읽고 싶은 것만)는 빠짐
    expect(t.authors[0].count).toBe(2);
    expect(t.line).toBe("소설을 가장 많이 읽어요 · 헤르만 헤세 작가 책이 2권");
  });

  it("책이 없으면 한 줄 분석도 없다", () => {
    expect(readingTaste([]).line).toBeNull();
  });
});

describe("같은 작가의 다른 책", () => {
  const items = [
    { title: "데미안", author: "헤르만 헤세 저/안인희 역", coverUrl: null, isbn13: "1", itemId: 1 }, // 내 책장 (다른 번역) → 빠짐
    { title: "수레바퀴 아래서", author: "헤르만 헤세 저/김이섭 역", coverUrl: "c", isbn13: "2", itemId: 2 },
    { title: "수레바퀴 아래서 (리커버 에디션)", author: "헤르만 헤세 저", coverUrl: "c", isbn13: "3", itemId: 3 }, // 같은 책 다른 판 → 빠짐
    { title: "헤르만 헤세 세트", author: "헤르만 헤세 저", coverUrl: "c", isbn13: "4", itemId: 4 }, // 세트 → 빠짐
    { title: "헤세를 읽는 밤", author: "다른 사람 저", coverUrl: "c", isbn13: "5", itemId: 5 }, // 다른 작가 → 빠짐
    { title: "헤르만 헤세의 꿈의 선물", author: "헤르만 헤세 저", coverUrl: "c", isbn13: "7", itemId: 7 }, // 작가 이름이 든 엮은 책 → 뒤로
    { title: "하루 필사 : 데미안 편", author: "헤르만 헤세 저", coverUrl: "c", isbn13: "8", itemId: 8 }, // 필사 책 → 빠짐
    { title: "크눌프", author: "헤르만 헤세 저", coverUrl: "c", isbn13: "6", itemId: 6 },
  ];
  it("그 작가 책만, 내 책장·판본 겹침·세트·필사 빼고, 작가 이름이 든 엮은 책은 뒤로", () => {
    const mine = new Set([workKey("데미안", "헤르만 헤세 저/전영애 역")]);
    const out = authorPicks(items, "헤르만헤세", mine);
    expect(out.map((b) => b.title)).toEqual(["수레바퀴 아래서", "크눌프", "헤르만 헤세의 꿈의 선물"]);
  });
});

describe("친구 책장에서", () => {
  const mine = new Set([workKey("데미안", "헤르만 헤세 저")]);
  const friends = [
    { handle: "jimin", nickname: "지민", books: [fb("데미안", "헤르만 헤세 저", "read", 5), fb("아몬드", "손원평 저", "read", 4.5, "마음이 말랑해져요"), fb("모순", "양귀자 저", "want")] },
    { handle: "hyunwoo", nickname: "현우", books: [fb("아몬드", "손원평 저", "read", 4, "좋았다"), fb("코스모스", "칼 세이건 저", "reading")] },
  ];
  it("내 책장에 없는 책을 친구 여럿·높은 별 순으로, 한줄평은 별이 가장 높은 친구 것", () => {
    const out = friendPicks(friends, mine);
    expect(out.map((p) => p.book.title)).toEqual(["아몬드", "코스모스"]); // 모순(읽고 싶은 것 하나)은 빠짐
    expect(out[0].who.map((w) => w.nickname)).toEqual(["지민", "현우"]);
    expect(out[0].say).toEqual({ nickname: "지민", text: "마음이 말랑해져요" });
  });

  it("이 책을 읽은 친구가 좋아한 다른 책 — 같은 책을 읽은 친구만", () => {
    const out = alsoLiked(friends, workKey("데미안", "헤르만 헤세 저"), new Set());
    expect(out.map((p) => p.book.title)).toEqual(["아몬드"]); // 현우는 데미안을 안 읽었다
    expect(out[0].who.map((w) => w.nickname)).toEqual(["지민"]);
  });
});
