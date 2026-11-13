import { describe, expect, it } from "vitest";
import { COST_LOG, costTotals } from "./costs";

describe("비용 기록", () => {
  it("달러 합계와 크레딧(도구별)을 따로 센다", () => {
    const t = costTotals([
      { date: "2026-11-13", what: "a", tool: "GPT 그림", amount: 0.27, unit: "usd" },
      { date: "2026-11-13", what: "b", tool: "GPT 그림", amount: 0.536, unit: "usd" },
      { date: "2026-11-13", what: "c", tool: "Typecast", amount: 484, unit: "credits" },
    ]);
    expect(t.usd).toBeCloseTo(0.806);
    expect(t.credits).toEqual({ Typecast: 484 });
    expect(t.krw).toBe(1130);
  });

  it("기록 파일 모양이 맞다 (날짜·단위)", () => {
    expect(COST_LOG.length).toBeGreaterThan(0);
    for (const e of COST_LOG) {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(["usd", "credits"]).toContain(e.unit);
      expect(e.amount).toBeGreaterThan(0);
    }
  });
});
