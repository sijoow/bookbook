import { describe, expect, it } from "vitest";
import { DEFAULT_PPM, formatClock, formatMinutes, lastWeek, minutesLeft, minutesPerBook, readingSpeed } from "./reading";

const s = (minutes: number, pagesRead: number, endedAt = "2026-11-12T10:00:00") => ({ bookId: "b", minutes, pagesRead, endedAt });

describe("readingSpeed", () => {
  it("기록이 적으면 어림값", () => {
    expect(readingSpeed([])).toEqual({ ppm: DEFAULT_PPM, measured: false });
    expect(readingSpeed([s(10, 20)])).toEqual({ ppm: DEFAULT_PPM, measured: false }); // 15분 미만
  });

  it("쌓이면 내 속도 = 읽은 쪽 ÷ 읽은 분 (쪽 없는 기록은 뺀다)", () => {
    const sp = readingSpeed([s(30, 24), s(20, 16), s(40, 0)]);
    expect(sp.measured).toBe(true);
    expect(sp.ppm).toBeCloseTo(40 / 50);
  });
});

describe("minutesLeft", () => {
  it("남은 쪽 ÷ 속도", () => {
    expect(minutesLeft({ pages: 320, currentPage: 132 }, { ppm: 0.8, measured: true })).toBe(235);
    expect(minutesLeft({ pages: 320, currentPage: null }, { ppm: 1, measured: true })).toBe(320);
  });

  it("쪽수를 모르면 null, 다 읽었으면 0", () => {
    expect(minutesLeft({ pages: null, currentPage: 10 }, { ppm: 1, measured: true })).toBeNull();
    expect(minutesLeft({ pages: 100, currentPage: 120 }, { ppm: 1, measured: true })).toBe(0);
  });
});

describe("minutesPerBook", () => {
  it("다 읽고 시간 기록이 있는 책만 평균", () => {
    expect(minutesPerBook([{ status: "read", readMinutes: 300 }, { status: "read", readMinutes: 100 }, { status: "read", readMinutes: 0 }, { status: "reading", readMinutes: 50 }])).toBe(200);
    expect(minutesPerBook([{ status: "reading", readMinutes: 50 }])).toBeNull();
  });
});

describe("lastWeek", () => {
  it("오늘을 끝으로 7일, 날마다 합", () => {
    const w = lastWeek([s(30, 10, "2026-11-12T08:00:00"), s(15, 5, "2026-11-12T21:00:00"), s(20, 5, "2026-11-10T09:00:00"), s(99, 9, "2026-11-01T09:00:00")], new Date("2026-11-12T23:00:00"));
    expect(w).toHaveLength(7);
    expect(w[6]).toMatchObject({ day: "2026-11-12", label: "목", minutes: 45 });
    expect(w[4]).toMatchObject({ day: "2026-11-10", minutes: 20 });
    expect(w.reduce((t, d) => t + d.minutes, 0)).toBe(65); // 11-01 은 7일 밖
  });
});

describe("format", () => {
  it("분 → 한국어", () => {
    expect(formatMinutes(135)).toBe("2시간 15분");
    expect(formatMinutes(120)).toBe("2시간");
    expect(formatMinutes(45)).toBe("45분");
    expect(formatMinutes(0)).toBe("0분");
  });

  it("타이머", () => {
    expect(formatClock(83_000)).toBe("01:23");
    expect(formatClock(3_725_000)).toBe("1:02:05");
    expect(formatClock(-5)).toBe("00:00");
  });
});
