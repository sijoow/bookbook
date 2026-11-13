import { describe, expect, it } from "vitest";
import { ADD_SLOT_W, SPINE_GAP, packRows, rowWidth, spineSize } from "./shelf";

const book = (thicknessMm: number | null, lengthMm: number | null = 225) => ({ thicknessMm, lengthMm });

describe("spineSize", () => {
  it("높이 = 세로 × 0.62, 폭 = 두께 × 0.62 × 1.5 (14~56px)", () => {
    expect(spineSize(book(20))).toEqual({ w: 19, h: 140 });
    expect(spineSize(book(5))).toEqual({ w: 14, h: 140 }); // 얇아도 14px
    expect(spineSize(book(120))).toEqual({ w: 56, h: 140 }); // 두꺼워도 56px
    expect(spineSize(book(null, null))).toEqual({ w: 14, h: 130 }); // 모르면 15mm·210mm
  });
});

describe("packRows", () => {
  it("폭을 넘지 않게 칸을 나눈다", () => {
    const books = Array.from({ length: 30 }, () => book(20)); // 19px 씩
    const rows = packRows(books, 200);
    expect(rows.flat()).toHaveLength(30);
    for (const r of rows) expect(rowWidth(r)).toBeLessThanOrEqual(200);
  });

  it("마지막 칸에 '+' 자리가 안 남으면 빈 칸을 하나 더", () => {
    const n = 9; // 9×19 + 8×2 = 187 → +2+30 = 219 > 200
    const rows = packRows(Array.from({ length: n }, () => book(20)), 200);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual([]);
    expect(rowWidth(rows[0]) + SPINE_GAP + ADD_SLOT_W).toBeGreaterThan(200);
  });

  it("빈 책장은 빈 칸 하나 ('+' 자리만)", () => {
    expect(packRows([], 300)).toEqual([[]]);
  });

  it("'+' 자리가 없는 책장(친구 책장)은 빈 칸을 더하지 않는다", () => {
    expect(packRows(Array.from({ length: 9 }, () => book(20)), 200, false)).toHaveLength(1);
  });
});
