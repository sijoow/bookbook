import { describe, expect, it } from "vitest";
import { dayNumber, kstStart, missionRef, missionsView, todaysMissions, weekDays } from "./missions";

describe("오늘의 미션", () => {
  it("20쪽 읽기는 늘, 나머지 둘은 날마다 돌아가며 — 겹치지 않는다", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const day = new Date(Date.UTC(2026, 10, 13 + i)).toISOString().slice(0, 10);
      const ids = todaysMissions(day, true);
      expect(ids[0]).toBe("read20");
      expect(new Set(ids).size).toBe(3);
      ids.forEach((x) => seen.add(x));
    }
    expect([...seen].sort()).toEqual(["memo", "read20", "shelve", "stamp", "visit"]);
  });

  it("친구가 없으면 친구 미션은 안 나온다", () => {
    for (let i = 0; i < 4; i++) {
      const day = new Date(Date.UTC(2026, 10, 13 + i)).toISOString().slice(0, 10);
      expect(todaysMissions(day, false).some((x) => x === "visit" || x === "stamp")).toBe(false);
    }
  });

  it("주는 월요일부터 — 2026-11-13(금)이면 11-09(월)~11-15(일)", () => {
    expect(weekDays("2026-11-13")).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]);
    expect(weekDays("2026-11-09")[0]).toBe("2026-11-09");
    expect(weekDays("2026-11-15")[0]).toBe("2026-11-09");
    expect(dayNumber("1970-01-02")).toBe(1);
  });

  it("한국 날짜 0시 = 전날 15시(UTC)", () => {
    expect(kstStart("2026-11-13").toISOString()).toBe("2026-11-12T15:00:00.000Z");
  });

  it("진행·받을 수 있는 수·이번 주 도장", () => {
    const v = missionsView(
      "2026-11-13",
      ["read20", "memo", "visit"],
      { read20: 32, memo: 0, visit: 1, shelve: 0, stamp: 0 },
      new Set(["visit"]),
      new Set(["2026-11-09", "2026-11-10", "2026-11-12", "2026-11-13", "2026-11-11"]),
    );
    expect(v.missions.map((m) => [m.id, m.now, m.done, m.claimed])).toEqual([
      ["read20", 20, true, false],
      ["memo", 0, false, false],
      ["visit", 1, true, true],
    ]);
    expect(v.week.count).toBe(5);
    expect(v.week.done).toBe(true);
    expect(v.week.days.map((d) => d.label + (d.read ? "✓" : "") + (d.today ? "*" : "") + (d.future ? "-" : "")).join(" ")).toBe("월✓ 화✓ 수✓ 목✓ 금✓* 토- 일-");
    expect(v.ready).toBe(3); // 20쪽 + 이번 주 + 출석 (아직 안 받음)
  });

  it("장부 ref — 하루 미션은 날짜, 주 보너스는 그 주 월요일", () => {
    expect(missionRef("2026-11-13", "read20")).toBe("2026-11-13:read20");
    expect(missionRef("2026-11-13", "week")).toBe("week:2026-11-09");
  });
});

describe("출석 체크 (11-13)", () => {
  it("이어서 들어온 날 — 오늘부터 거꾸로, 하루라도 빠지면 끊긴다", async () => {
    const { streakOf } = await import("./missions");
    expect(streakOf(new Set(["2026-11-11", "2026-11-12", "2026-11-13"]), "2026-11-13")).toBe(3);
    expect(streakOf(new Set(["2026-11-10", "2026-11-12", "2026-11-13"]), "2026-11-13")).toBe(2);
    expect(streakOf(new Set(), "2026-11-13")).toBe(0);
  });
  it("오늘은 늘 출석 · 7일째엔 보너스 · 받을 수 있는 수에 출석도", async () => {
    const seven = new Set(["2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"]);
    const v = missionsView("2026-11-13", ["read20", "memo", "visit"], { read20: 0, memo: 0, visit: 0, shelve: 0, stamp: 0 }, new Set(), new Set(), seven);
    expect(v.attend.streak).toBe(7);
    expect(v.attend.bonus).toBe(50);
    expect(v.attend.claimed).toBe(false);
    expect(v.attend.days.filter((d) => d.on).map((d) => d.label)).toEqual(["월", "화", "수", "목", "금"]);
    expect(v.ready).toBe(1); // 출석만
    const done = missionsView("2026-11-13", ["read20", "memo", "visit"], { read20: 0, memo: 0, visit: 0, shelve: 0, stamp: 0 }, new Set(["attend"]), new Set());
    expect(done.attend.claimed).toBe(true);
    expect(done.attend.bonus).toBe(0); // 오늘만 들어옴 → 1일째
    expect(done.ready).toBe(0);
  });
});
