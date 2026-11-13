import { describe, expect, it } from "vitest";
import { CASE, SPINE_INSET, bookDims, layoutLibrary, unitX, SHELF_WIDE_INNER, SHELF_TALL_ROWS } from "./layout";

const book = (id: string, thicknessMm: number | null = 20, lengthMm: number | null = 220) => ({ id, thicknessMm, lengthMm });

describe("bookDims", () => {
  it("두께는 부풀리되 최소·최대가 있다", () => {
    expect(bookDims({ thicknessMm: 20, lengthMm: 220 }).t).toBe(3.4);
    expect(bookDims({ thicknessMm: 3, lengthMm: 220 }).t).toBe(1.8);
    expect(bookDims({ thicknessMm: 90, lengthMm: 220 }).t).toBe(6.5);
  });
  it("크기를 모르면 보통 책 크기로", () => {
    const d = bookDims({ thicknessMm: null, lengthMm: null });
    expect(d.h).toBe(21);
    expect(d.t).toBeGreaterThan(2);
    expect(d.d).toBeCloseTo(21 * 0.68, 1);
  });
});

describe("layoutLibrary", () => {
  it("빈 책장도 책장 하나·한 줄과 '+' 자리", () => {
    const l = layoutLibrary([]);
    expect(l.units).toHaveLength(1);
    expect(l.units[0].rows).toBe(1);
    expect(l.slots).toHaveLength(0);
    expect(l.add).not.toBeNull();
  });

  it("위 줄 왼쪽부터 순서대로 꽂힌다", () => {
    const l = layoutLibrary([book("a"), book("b"), book("c")]);
    const [a, b, c] = l.slots;
    expect([a.id, b.id, c.id]).toEqual(["a", "b", "c"]);
    expect(a.x).toBeLessThan(b.x);
    expect(b.x).toBeLessThan(c.x);
    expect(a.row).toBe(0);
    // 책등 앞면은 책장 앞에서 조금 들어가 있다
    expect(a.z + a.d / 2).toBeCloseTo(-SPINE_INSET, 5);
  });

  it("한 줄이 넘치면 다음 줄, 줄이 늘면 책장이 자란다 (위 줄이 먼저)", () => {
    const many = Array.from({ length: 30 }, (_, i) => book(`b${i}`, 30)); // 5.1cm 씩
    const l = layoutLibrary(many);
    const u = l.units[0];
    expect(u.rows).toBeGreaterThan(1);
    // 첫 책은 맨 위 줄(row 0) = 가장 높은 바닥
    const first = l.slots[0];
    const last = l.slots[l.slots.length - 1];
    expect(first.row).toBe(0);
    expect(first.y).toBeGreaterThan(last.y);
    // 어느 줄도 칸 폭을 넘지 않는다
    for (let r = 0; r < u.rows; r++) {
      const inRow = l.slots.filter((s) => s.unit === 0 && s.row === r);
      const right = Math.max(...inRow.map((s) => s.x + s.t / 2));
      expect(right).toBeLessThanOrEqual(u.x + u.innerW / 2);
    }
  });

  it("3줄이 넘으면 옆에 책장이 하나 더", () => {
    const many = Array.from({ length: 60 }, (_, i) => book(`b${i}`, 30));
    const l = layoutLibrary(many);
    expect(l.units.length).toBe(2);
    expect(l.units[0].rows).toBe(CASE.maxRows);
    expect(l.units[1].x).toBe(unitX(1));
    expect(l.slots.filter((s) => s.unit === 1).length).toBeGreaterThan(0);
    expect(l.slots.map((s) => s.index)).toEqual(many.map((_, i) => i));
  });

  it("'+' 자리는 남는 자리가 있을 때만 — 그 때문에 줄을 늘리지 않는다", () => {
    // 한 줄을 거의 꽉 채운다 (6.5cm × 9 = 58.5 + 틈 2.4 = 60.9, 남는 자리 1.5cm)
    const full = Array.from({ length: 9 }, (_, i) => book(`f${i}`, 90));
    const l = layoutLibrary(full);
    expect(l.units[0].rows).toBe(1);
    expect(l.add).toBeNull();
    expect(layoutLibrary(full, false).add).toBeNull();
    expect(layoutLibrary([book("x")]).add?.row).toBe(0);
  });

  it("책이 적으면 책장이 좁아지고(책이 크게 보이게), 늘면 64cm 까지 넓어진다", () => {
    const few = layoutLibrary([book("a"), book("b"), book("c")]);
    expect(few.units[0].innerW).toBe(CASE.minInnerW);
    const some = layoutLibrary(Array.from({ length: 12 }, (_, i) => book(`s${i}`, 20)));
    expect(some.units[0].innerW).toBeGreaterThan(CASE.minInnerW);
    expect(some.units[0].innerW).toBeLessThanOrEqual(CASE.innerW);
    expect(some.units[0].rows).toBe(1);
    // 책이 칸 안에 다 들어가고 끝에 북엔드 자리가 남는다
    const u = some.units[0];
    const right = Math.max(...some.slots.map((sl) => sl.x + sl.t / 2));
    expect(u.x + u.innerW / 2 - right).toBeGreaterThanOrEqual(CASE.endRoom - 1);
    // 두 줄이 되면 다시 가장 넓게
    const many = layoutLibrary(Array.from({ length: 30 }, (_, i) => book(`m${i}`, 30)));
    expect(many.units[0].innerW).toBe(CASE.innerW);
  });

  it("줄 높이는 가장 큰 책에 맞추되 한도 안", () => {
    expect(layoutLibrary([book("a", 20, 300)]).rowH).toBeCloseTo(33.5, 5);
    expect(layoutLibrary([book("a", 20, 150)]).rowH).toBe(24);
  });
});

describe("책장 꾸미기 (넓은·높은 책장)", () => {
  const many = Array.from({ length: 60 }, (_, i) => book(`w${i}`, 20));
  it("넓은 책장은 칸 폭 88 · 앞표지가 앞으로 — 한 권이 책 가로만큼 차지 (11-13)", () => {
    const base = layoutLibrary(many);
    const wide = layoutLibrary(many, true, { wide: true });
    expect(wide.units[0].innerW).toBe(SHELF_WIDE_INNER);
    expect(wide.slots.every((s) => s.face)).toBe(true);
    expect(base.slots.some((s) => s.face)).toBe(false);
    const row0 = wide.slots.filter((s) => s.unit === 0 && s.row === 0);
    for (let i = 1; i < row0.length; i++) expect(row0[i].x - row0[i - 1].x).toBeGreaterThanOrEqual((row0[i].d + row0[i - 1].d) / 2); // 표지끼리 안 겹친다
    expect(row0.length).toBeLessThanOrEqual(7); // 한 줄 5~6권 안팎
    expect(wide.units.length > 1 ? wide.units[1].x : unitX(1, SHELF_WIDE_INNER)).toBe(unitX(1, SHELF_WIDE_INNER));
  });
  it("높은 책장은 4줄까지 — 옆 책장이 늦게 생긴다", () => {
    const base = layoutLibrary(many);
    const tall = layoutLibrary(many, true, { tall: true });
    expect(tall.units[0].rows).toBe(SHELF_TALL_ROWS);
    expect(tall.units[0].height).toBeGreaterThan(base.units[0].height);
    expect(tall.units.length).toBeLessThanOrEqual(base.units.length);
  });
  it("책이 적어도 넓은 책장은 넓고, 높은 책장은 4줄 — 산 게 바로 보이게 (11-13)", () => {
    expect(layoutLibrary([book("a"), book("b")], true, { wide: true }).units[0].innerW).toBe(SHELF_WIDE_INNER);
    expect(layoutLibrary([book("a"), book("b")], true, { tall: true }).units[0].rows).toBe(4);
    expect(layoutLibrary([book("a"), book("b")], true).units[0].innerW).toBeLessThan(SHELF_WIDE_INNER);
  });
});
