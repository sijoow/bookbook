import { describe, expect, it } from "vitest";
import { fromPos, isFree, placeSpot, roomFrame, toPos, wallRect, type Spot } from "./roomPlace";

// 책장 하나(폭 50, 높이 62) · 방석 (13, 41) · 뒷벽 z=-27
const base = { cases: [{ x: 0, width: 50, height: 62 }], cushion: { x: 13, z: 41 }, wallZ: -27, lights: false };
const grid = roomFrame({ ...base, house: "grid" });
const at = (s: Spot["s"], x: number, y: number, z: number): Spot => ({ s, x, y, z });

describe("책장 위", () => {
  it("빈자리면 그대로, 밖이면 책장 끝 안으로", () => {
    expect(placeSpot("plant", at("top", 0, 62, -11), grid, [])).toEqual({ s: "top", x: 0, y: 62, z: -11 });
    expect(placeSpot("plant", at("top", 100, 62, -11), grid, [])?.x).toBe(20); // 25 - 반지름 4.5 - 0.5
  });
  it("다른 물건과 겹치면 옆 빈자리로", () => {
    const lamp = { id: "lamp", spot: at("top", 20, 62, -11) };
    const p = placeSpot("plant", at("top", 20, 62, -11), grid, [lamp]);
    expect(p?.x).toBe(10);
  });
  it("책장이 너무 좁으면 못 놓는다", () => {
    const narrow = roomFrame({ ...base, cases: [{ x: 0, width: 8, height: 62 }], house: "grid" });
    expect(placeSpot("plant", at("top", 0, 62, -11), narrow, [])).toBeNull();
  });
});

describe("바닥", () => {
  it("책장 앞(아바타가 책 꺼내는 자리)은 비워 두고 앞으로 민다", () => {
    const p = placeSpot("plant", at("floor", 0, 0, 5), grid, []);
    expect(p).not.toBeNull();
    expect(p!.z).toBeGreaterThanOrEqual(20.5);
    expect(Math.abs(p!.x)).toBeLessThan(2);
  });
  it("방석(앉은 아바타)과 겹치지 않는다", () => {
    const p = placeSpot("cat", at("floor", 13, 0, 41), grid, [])!;
    expect(Math.hypot(p.x - 13, p.z - 43)).toBeGreaterThanOrEqual(25);
  });
  it("책장 옆 벽 쪽은 놓을 수 있다", () => {
    expect(placeSpot("plant", at("floor", -40, 0, -15), grid, [])).toEqual({ s: "floor", x: -40, y: 0, z: -15 });
  });
  it("다른 바닥 물건과 겹치지 않는다", () => {
    const table = { id: "table", spot: at("floor", -40, 0, 30) };
    const p = placeSpot("cat", at("floor", -40, 0, 30), grid, [table])!;
    expect(Math.hypot(p.x + 40, p.z - 30)).toBeGreaterThanOrEqual(18);
    expect(isFree("cat", p, grid, [table])).toBe(true);
  });
  it("못 가는 면은 null (고양이를 벽에)", () => {
    expect(placeSpot("cat", at("wall", 0, 80, -26.6), grid, [])).toBeNull();
  });
});

describe("벽", () => {
  it("책장 위쪽 벽은 그대로", () => {
    expect(placeSpot("window", at("wall", 0, 70, -26.6), grid, [])).toEqual({ s: "wall", x: 0, y: 70, z: -26.6 });
  });
  it("책장에 가리는 높이면 위로 올린다", () => {
    const p = placeSpot("window", at("wall", 0, 30, -26.6), grid, [])!;
    expect(p.y).toBeGreaterThanOrEqual(66.5); // 아래 끝(창턱) 이 책장 위 + 3 보다 높게
  });
  it("줄 전구가 걸려 있으면 그 아래로는 못 간다", () => {
    const lit = roomFrame({ ...base, house: "grid", lights: true });
    const p = placeSpot("frame", at("wall", 0, 66, -26.4), lit, [])!;
    expect(wallRect("frame", p.x, p.y)!.y0).toBeGreaterThanOrEqual(73);
  });
  it("창가 원룸의 큰 창과 겹치지 않는다", () => {
    const sunny = roomFrame({ ...base, house: "sunny" });
    const p = placeSpot("frame", at("wall", 40, 70, -26.4), sunny, [])!;
    expect(isFree("frame", p, sunny, [])).toBe(true);
    const r = wallRect("frame", p.x, p.y)!;
    expect(r.x1 <= 18 || r.y1 <= 40 || r.y0 >= 106).toBe(true);
  });
  it("다락방은 기울어진 천장 아래로", () => {
    const attic = roomFrame({ ...base, house: "attic" });
    const p = placeSpot("window", at("wall", -50, 40, -26.6), attic, [])!;
    expect(p).not.toBeNull();
    expect(isFree("window", p, attic, [])).toBe(true);
    const r = wallRect("window", p.x, p.y)!;
    expect(r.y1).toBeLessThanOrEqual(60 + (r.x0 - (-65)) * Math.tan(0.75) - 2 + 1e-6);
  });
});

describe("저장값", () => {
  it("기준점에서 떨어진 만큼 — 되돌리면 같은 자리", () => {
    const floor = at("floor", -40, 0, -15);
    const p = toPos(floor, grid);
    expect(p).toEqual({ s: "floor", x: -53, z: -56 });
    expect(fromPos(p, grid, 0)).toEqual(floor);
    expect(fromPos(toPos(at("top", 7.5, 62, -11), grid), grid, 0)).toEqual(at("top", 7.5, 62, -11));
    expect(fromPos(toPos(at("wall", -12, 80, -26.6), grid), grid, -26.6)).toEqual(at("wall", -12, 80, -26.6));
  });
  it("방석이 옮겨 가면 바닥 물건도 같이 (책장이 넓어진 뒤)", () => {
    const wide = roomFrame({ ...base, cases: [{ x: 0, width: 69, height: 62 }], cushion: { x: 22.5, z: 41 }, house: "grid" });
    expect(fromPos({ s: "floor", x: -35, z: -6 }, wide, 0)).toEqual(at("floor", -12.5, 0, 35));
  });
});
