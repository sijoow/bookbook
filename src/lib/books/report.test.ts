import { describe, expect, it } from "vitest";
import { monthReport } from "./report";
import type { LibraryBook } from "./types";

const book = (title: string, finishedAt: string | null, category = "국내도서-소설/시/희곡", author = "한강 저"): LibraryBook =>
  ({ id: title, title, author, status: finishedAt ? "read" : "reading", finishedAt, category } as unknown as LibraryBook);

describe("이달의 독서 카드", () => {
  it("이번 달(한국 날짜)에 다 읽은 책·읽은 시간·쪽·날 수", () => {
    const r = monthReport(
      [book("소년이 온다", "2026-11-03T10:00:00Z"), book("채식주의자", "2026-11-10T10:00:00Z"), book("데미안", "2026-10-30T10:00:00Z"), book("코스모스", null)],
      [
        { endedAt: "2026-11-02T12:00:00Z", minutes: 40, pagesRead: 30 },
        { endedAt: "2026-11-02T14:00:00Z", minutes: 20, pagesRead: 12 },
        { endedAt: "2026-11-09T12:00:00Z", minutes: 75, pagesRead: 60 },
        { endedAt: "2026-10-31T16:30:00Z", minutes: 30, pagesRead: 20 }, // 한국 날짜로 11-01 → 이번 달
        { endedAt: "2026-10-20T12:00:00Z", minutes: 99, pagesRead: 99 }, // 지난달
      ],
      new Date("2026-11-13T05:00:00Z"),
    );
    expect(r.label).toBe("11월");
    expect(r.finished.map((b) => b.title)).toEqual(["소년이 온다", "채식주의자"]);
    expect(r.minutes).toBe(165);
    expect(r.pages).toBe(122);
    expect(r.days).toBe(3);
    expect(r.topGenre).toBe("소설");
    expect(r.topAuthor).toEqual({ name: "한강", count: 2 });
    expect(r.line).toBe("11월엔 2권을 다 읽었어요 · 2시간 45분 · 소설을 가장 많이");
  });
  it("아직 아무것도 없으면 첫 책 권하기", () => {
    expect(monthReport([], [], new Date("2026-11-13T05:00:00Z")).line).toBe("11월의 첫 책을 꺼내 볼까요?");
  });
});
