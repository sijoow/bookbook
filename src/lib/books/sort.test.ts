import { describe, expect, it } from "vitest";
import { dropTarget, moveTo } from "./drop";
import { sortBooks } from "./sort";

const b = (id: string, title: string, o: Partial<{ author: string; status: "want" | "reading" | "read" | "stopped"; lengthMm: number; createdAt: string }> = {}) => ({
  id,
  title,
  author: o.author ?? null,
  status: o.status ?? "want",
  lengthMm: o.lengthMm ?? 210,
  createdAt: o.createdAt ?? "2026-11-01T00:00:00.000Z",
});

describe("책장 정리", () => {
  const books = [
    b("a", "코스모스", { author: "칼 세이건 저", status: "read", lengthMm: 230, createdAt: "2026-11-03T00:00:00.000Z" }),
    b("b", "데미안", { author: "헤르만 헤세 저/전영애 역", status: "reading", lengthMm: 200, createdAt: "2026-11-01T00:00:00.000Z" }),
    b("c", "싯다르타", { author: "헤르만 헤세 저", status: "want", lengthMm: 190, createdAt: "2026-11-05T00:00:00.000Z" }),
    b("d", "가호", { author: "무라카미 하루키", status: "read", lengthMm: 250, createdAt: "2026-11-02T00:00:00.000Z" }),
  ];
  it("제목 가나다", () => expect(sortBooks(books, "title")).toEqual(["d", "b", "c", "a"]));
  it("읽는 중 먼저 → 다 읽음 → 읽고 싶음", () => expect(sortBooks(books, "status")).toEqual(["b", "d", "a", "c"]));
  it("작가끼리 (같은 작가는 제목순)", () => expect(sortBooks(books, "author")).toEqual(["d", "a", "b", "c"]));
  it("큰 책부터", () => expect(sortBooks(books, "tall")).toEqual(["d", "a", "b", "c"]));
  it("최근 꽂은 책부터", () => expect(sortBooks(books, "recent")).toEqual(["c", "a", "d", "b"]));
});

describe("끌어다 놓을 자리", () => {
  // 위 줄 a b c (바닥 100), 아래 줄 d e (바닥 200)
  const r = (id: string, left: number, bottom: number) => ({ id, left, right: left + 20, top: bottom - 80, bottom });
  const rects = [r("a", 0, 100), r("b", 22, 100), r("c", 44, 100), r("d", 0, 200), r("e", 22, 200)];
  it("가운데를 넘은 첫 책 앞", () => expect(dropTarget(rects, 25, 60)).toEqual({ before: "b", after: null }));
  it("줄 끝을 지나면 그 줄 마지막 책 뒤", () => expect(dropTarget(rects, 90, 60)).toEqual({ before: null, after: "c" }));
  it("세로로 가장 가까운 줄", () => expect(dropTarget(rects, 5, 190)).toEqual({ before: "d", after: null }));
  it("놓은 뒤 순서", () => {
    const ids = ["a", "b", "c", "d", "e"];
    expect(moveTo(ids, "e", { before: "b", after: null })).toEqual(["a", "e", "b", "c", "d"]);
    expect(moveTo(ids, "a", { before: null, after: "c" })).toEqual(["b", "c", "a", "d", "e"]);
    expect(moveTo(ids, "c", { before: null, after: null })).toEqual(["a", "b", "d", "e", "c"]);
  });
});
