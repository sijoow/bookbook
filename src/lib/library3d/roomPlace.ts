// 방 물건 옮기기 — 어디에 놓을 수 있나(책장 위·바닥·벽), 막힌 곳이면 가장 가까운 빈자리로. 순수 함수 (three.js 없이 시험)
// 11-13 사용자: "아이템으로 받은 것들 위치도 옮기고 이런 것도 가능할까?"
// 좌표는 world.ts 와 같다: cm, 바닥 y=0, 책장 앞면 z=0 (깊이 24 → 뒤로 -24), 뒷벽 z = wallZ.
// 저장은 기준점에서 떨어진 값(ItemPos) — 책장이 넓어지거나 방석이 움직여도 물건이 같이 따라간다.

import { ROOM_SURFACES, type ItemPos, type Surface } from "@/lib/deco/items";
import type { HouseId } from "@/lib/house/houses";

export type Spot = { s: Surface; x: number; y: number; z: number }; // 물건 기준점 (바닥·책장 위 = 밑면 가운데, 벽 = 아래 끝 가운데)
export type Rect = { x0: number; x1: number; y0: number; y1: number };
type Circle = { x: number; z: number; r: number };

export const TOP_Z = -11; // 책장 위 물건 자리 (깊이 가운데쯤)
export const FRONT_CLEAR = 16; // 책장 앞 — 아바타가 서서 책을 꺼내는 자리라 비워 둔다

/** 바닥·책장 위 물건의 반지름 (cm, deco3d.ts 그림과 맞춘 값) */
const RADIUS: Record<string, number> = { plant: 4.5, lamp: 4.5, cat: 9, table: 8 };
/** 벽 물건 — 폭·높이, 기준점(아래 끝)에서 그림이 시작하는 높이 dy (창문은 창턱이 조금 아래로) */
const WALL: Record<string, { w: number; h: number; dy: number }> = {
  window: { w: 39, h: 26.5, dy: -1.5 }, // 창 30 + 양쪽 커튼
  frame: { w: 23, h: 19, dy: 0 }, // 액자 + 마스킹테이프
};

export type RoomFrame = {
  caseX: number; // 첫 책장 가운데 — 책장 위·벽 자리의 기준
  cases: Array<{ x0: number; x1: number; top: number }>; // 책장들 (첫 번째가 방석 쪽)
  cushion: { x: number; z: number }; // 바닥 자리의 기준
  floor: Rect; // 바닥에 놓을 수 있는 곳 (y0..y1 = 뒤 z ~ 앞 z)
  wall: Rect; // 벽에 걸 수 있는 곳 (물건 아래 끝 ~ 위 끝)
  floorBlocks: Circle[]; // 방석(앉은 아바타)·선물 상자·동물·손님 방석 자리
  wallBlocks: Rect[]; // 집 창·벽등·줄 전구
  ceiling: { x: number; y: number; slope: number } | null; // 다락방 기울어진 천장 — x 에서 y, 오른쪽으로 갈수록 높아진다
};

/** 방 치수 — 책장·방석·집에 따라 (house3d.ts·world.ts 의 자리와 맞춘 값) */
export function roomFrame(o: {
  cases: Array<{ x: number; width: number; height: number }>;
  cushion: { x: number; z: number };
  wallZ: number;
  house: HouseId;
  lights: boolean; // 줄 전구가 책장 위 벽에 걸려 있나
  ladder?: boolean; // 책장 사다리가 책장 오른쪽 옆에 기대 있나
}): RoomFrame {
  const c0 = o.cases[0] ?? { x: 0, width: 50, height: 60 };
  const left = c0.x - c0.width / 2;
  const right = c0.x + c0.width / 2;
  const c = o.cushion;
  const margin = 34;
  let x0 = left - margin;
  const x1 = Math.max(right, c.x + 16) + margin;
  const wallBlocks: Rect[] = [];
  let ceiling: RoomFrame["ceiling"] = null;
  if (o.house === "attic") {
    const lowX = left - 40; // 낮은 옆벽
    x0 = Math.max(x0, lowX + 1);
    ceiling = { x: lowX, y: 60, slope: Math.tan(0.75) };
    wallBlocks.push({ x0: left - 35, x1: left - 5, y0: 31, y1: 61 }); // 동그란 노을 창
  } else if (o.house === "sunny") {
    wallBlocks.push({ x0: right - 7, x1: right + 65, y0: 40, y1: 106 }); // 큰 창·커튼·봉
  } else if (o.house === "cabin") {
    wallBlocks.push({ x0: right + 12, x1: right + 64, y0: 47, y1: 101 }); // 숲 창
    wallBlocks.push({ x0: left - 28, x1: left - 16, y0: 104, y1: 116 }); // 벽등
  }
  if (o.lights) wallBlocks.push({ x0: left, x1: right, y0: c0.height, y1: c0.height + 11 });
  return {
    caseX: c0.x,
    cases: (o.cases.length ? o.cases : [c0]).map((u) => ({ x0: u.x - u.width / 2, x1: u.x + u.width / 2, top: u.height })),
    cushion: { x: c.x, z: c.z },
    floor: { x0, x1, y0: o.wallZ + 1, y1: c.z + 22 },
    wall: { x0, x1, y0: 16, y1: c0.height + 52 },
    floorBlocks: [
      { x: c.x, z: c.z + 2, r: 16 }, // 방석 + 앉은 아바타
      { x: c.x - 17, z: c.z + 17, r: 6 }, // 배달 상자
      { x: c.x + 17, z: c.z + 9, r: 6 }, // 동물이 쉬는 자리
      { x: c.x - 28, z: c.z + 8, r: 10 }, // 친구가 놀러 오면 앉는 손님 방석
      ...(o.ladder ? [{ x: right + 9, z: -12, r: 8 }] : []), // 책장 사다리 (deco3d)
    ],
    wallBlocks,
    ceiling,
  };
}

/** 이 물건을 옮길 수 있나 (줄 전구 등은 못 옮김) */
export function canMove(id: string): boolean {
  return Boolean(ROOM_SURFACES[id]);
}

/** 처음 자리의 면 (책장 위 / 바닥 / 벽) */
export function homeSurface(id: string): Surface | null {
  return ROOM_SURFACES[id]?.[0] ?? null;
}

/** 벽 물건이 차지하는 네모 */
export function wallRect(id: string, x: number, y: number): Rect | null {
  const s = WALL[id];
  return s ? { x0: x - s.w / 2, x1: x + s.w / 2, y0: y + s.dy, y1: y + s.dy + s.h } : null;
}

export function itemRadius(id: string): number {
  return RADIUS[id] ?? 6;
}

const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
const r1 = (v: number) => Math.round(v * 10) / 10;
const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

type Other = { id: string; spot: Spot };

function freeTop(id: string, x: number, f: RoomFrame, others: Other[]): boolean {
  const r = itemRadius(id);
  const c = f.cases[0];
  if (x - r < c.x0 + 0.5 || x + r > c.x1 - 0.5) return false;
  for (const o of others) if (o.spot.s === "top" && Math.abs(x - o.spot.x) < itemRadius(o.id) + r + 0.5) return false;
  return true;
}

function freeFloor(id: string, x: number, z: number, f: RoomFrame, others: Other[]): boolean {
  const r = itemRadius(id);
  if (x - r < f.floor.x0 || x + r > f.floor.x1 || z - r < f.floor.y0 || z + r > f.floor.y1) return false;
  for (const c of f.cases) if (x + r > c.x0 && x - r < c.x1 && z - r < FRONT_CLEAR) return false; // 책장 + 그 앞
  for (const b of f.floorBlocks) if (Math.hypot(x - b.x, z - b.z) < b.r + r) return false;
  for (const o of others) if (o.spot.s === "floor" && Math.hypot(x - o.spot.x, z - o.spot.z) < itemRadius(o.id) + r + 1) return false;
  return true;
}

function freeWall(id: string, x: number, y: number, f: RoomFrame, others: Other[]): boolean {
  const a = wallRect(id, x, y);
  if (!a) return false;
  if (a.x0 < f.wall.x0 || a.x1 > f.wall.x1 || a.y0 < f.wall.y0 || a.y1 > f.wall.y1) return false;
  if (f.ceiling && a.y1 > f.ceiling.y + (a.x0 - f.ceiling.x) * f.ceiling.slope - 2) return false;
  for (const c of f.cases) if (overlap(a, { x0: c.x0 - 1, x1: c.x1 + 1, y0: -1, y1: c.top + 3 })) return false;
  for (const b of f.wallBlocks) if (overlap(a, b)) return false;
  for (const o of others) {
    if (o.spot.s !== "wall") continue;
    const b = wallRect(o.id, o.spot.x, o.spot.y);
    if (b && overlap(a, { x0: b.x0 - 1, x1: b.x1 + 1, y0: b.y0 - 1, y1: b.y1 + 1 })) return false;
  }
  return true;
}

/** 이 자리에 놓을 수 있나 (막힌 데·다른 물건과 안 겹치나) */
export function isFree(id: string, spot: Spot, f: RoomFrame, others: Other[]): boolean {
  if (!ROOM_SURFACES[id]?.includes(spot.s)) return false;
  const rest = others.filter((o) => o.id !== id);
  if (spot.s === "top") return freeTop(id, spot.x, f, rest);
  if (spot.s === "floor") return freeFloor(id, spot.x, spot.z, f, rest);
  return freeWall(id, spot.x, spot.y, f, rest);
}

/** (a, b) 에서 가장 가까운 빈자리 — 1cm 씩 넓혀 가며 둘레를 살핀다 (oneD 면 좌우만) */
function nearest(free: (a: number, b: number) => boolean, a0: number, b0: number, oneD = false): [number, number] | null {
  const a = r1(a0);
  const b = r1(b0);
  if (free(a, b)) return [a, b];
  for (let d = 1; d <= 120; d++) {
    const n = oneD ? 2 : Math.max(8, Math.round(d * 1.3));
    for (let k = 0; k < n; k++) {
      const t = oneD ? k * Math.PI : (k / n) * Math.PI * 2;
      const qa = r1(a + Math.cos(t) * d);
      const qb = oneD ? b : r1(b + Math.sin(t) * d);
      if (free(qa, qb)) return [qa, qb];
    }
  }
  return null;
}

/**
 * 놓을 자리 — 원하는 곳(want)이 비어 있으면 그대로, 막혀 있으면 가장 가까운 빈자리. 그 면에 놓을 수 없으면 null.
 * others = 이미 놓인 다른 물건들 (그 물건들과 겹치지 않게)
 */
export function placeSpot(id: string, want: Spot, f: RoomFrame, others: Other[]): Spot | null {
  if (!ROOM_SURFACES[id]?.includes(want.s)) return null;
  const rest = others.filter((o) => o.id !== id);
  if (want.s === "top") {
    const c = f.cases[0];
    const r = itemRadius(id);
    const p = nearest((a) => freeTop(id, a, f, rest), clamp(want.x, c.x0 + r + 0.5, c.x1 - r - 0.5), 0, true);
    return p && { s: "top", x: p[0], y: c.top, z: TOP_Z };
  }
  if (want.s === "floor") {
    const r = itemRadius(id);
    const p = nearest((a, b) => freeFloor(id, a, b, f, rest), clamp(want.x, f.floor.x0 + r, f.floor.x1 - r), clamp(want.z, f.floor.y0 + r, f.floor.y1 - r));
    return p && { s: "floor", x: p[0], y: 0, z: p[1] };
  }
  const s = WALL[id];
  if (!s) return null;
  const p = nearest(
    (a, b) => freeWall(id, a, b, f, rest),
    clamp(want.x, f.wall.x0 + s.w / 2, f.wall.x1 - s.w / 2),
    clamp(want.y, f.wall.y0 - s.dy, f.wall.y1 - s.dy - s.h),
  );
  return p && { s: "wall", x: p[0], y: p[1], z: want.z };
}

/** 방 자리 → 저장값 (기준점에서 떨어진 만큼) */
export function toPos(spot: Spot, f: RoomFrame): ItemPos {
  if (spot.s === "top") return { s: "top", x: r1(spot.x - f.caseX) };
  if (spot.s === "floor") return { s: "floor", x: r1(spot.x - f.cushion.x), z: r1(spot.z - f.cushion.z) };
  return { s: "wall", x: r1(spot.x - f.caseX), y: r1(spot.y) };
}

/** 저장값 → 방 자리 (wallZ = 그 물건이 벽에서 떨어진 z) */
export function fromPos(p: ItemPos, f: RoomFrame, wallZ: number): Spot {
  if (p.s === "top") return { s: "top", x: f.caseX + p.x, y: f.cases[0].top, z: TOP_Z };
  if (p.s === "floor") return { s: "floor", x: f.cushion.x + p.x, y: 0, z: f.cushion.z + p.z };
  return { s: "wall", x: f.caseX + p.x, y: p.y, z: wallZ };
}
