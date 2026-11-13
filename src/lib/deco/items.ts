// 꾸미기 물건 · 상점 · 포인트 규칙 — 순수 함수 (서버·화면·시험이 함께 쓴다)
// 11-12 처음: 다 읽은 책 1권 = 선물 상자 1개, 정해진 순서(TRACK)대로.
// 11-13 사용자: "책을 다 읽거나 할 때마다 포인트(크레딧)처럼 쌓이고, 장식품을 구매해서 내 집을 꾸미는 시스템"
//   → 포인트로 상점에서 산다. 산 물건은 '배달 상자'로 방에 도착하고, 누르면 아바타가 열어 바로 하고/놓는다(11-12 선물 연출 그대로).
//   예전에 연 선물(opened)은 앞에서부터 그만큼 '가진 물건'으로 옮긴다.

import { z } from "zod";

export type DecoKind = "avatar" | "room" | "shelf"; // shelf = 책장 꾸미기 — 켜 두면(놓으면) 책장이 바뀐다
export type AvatarSlot = "head" | "neck" | "back" | "body"; // body = 옷 한 벌 (11-13 옷 가게 — 입으면 기본 옷 대신)

export type DecoItem = { id: string; kind: DecoKind; slot?: AvatarSlot; label: string; price: number };

/** 상점 물건 (보여 주는 순서) — 아바타 소품·도서관 물건을 번갈아, 값은 포인트 */
export const TRACK: DecoItem[] = [
  { id: "plant", kind: "room", label: "화분", price: 60 },
  { id: "ribbon", kind: "avatar", slot: "head", label: "리본", price: 60 },
  { id: "lamp", kind: "room", label: "스탠드", price: 80 },
  { id: "scarf", kind: "avatar", slot: "neck", label: "목도리", price: 80 },
  { id: "window", kind: "room", label: "창문", price: 150 },
  { id: "starpin", kind: "avatar", slot: "head", label: "별 핀", price: 70 },
  { id: "cat", kind: "room", label: "고양이", price: 300 },
  { id: "flowers", kind: "avatar", slot: "head", label: "꽃 화관", price: 120 },
  { id: "lights", kind: "room", label: "줄 전구", price: 150 },
  { id: "bag", kind: "avatar", slot: "back", label: "책가방", price: 120 },
  { id: "frame", kind: "room", label: "액자", price: 120 },
  { id: "bear", kind: "avatar", slot: "head", label: "곰돌이 귀", price: 150 },
  { id: "table", kind: "room", label: "탁자와 머그", price: 200 },
  { id: "crown", kind: "avatar", slot: "head", label: "왕관", price: 500 },
  // 옷 가게 (11-13 사용자: "옷도 사게 해서 입히는 것도") — 한 벌만 입는다(자리 body). 안 입으면 아바타 꾸미기에서 고른 옷 색 그대로
  { id: "stripes", kind: "avatar", slot: "body", label: "줄무늬 티", price: 120 },
  { id: "overalls", kind: "avatar", slot: "body", label: "멜빵바지", price: 180 },
  { id: "dots", kind: "avatar", slot: "body", label: "땡땡이 원피스", price: 180 },
  { id: "sweater", kind: "avatar", slot: "body", label: "니트 스웨터", price: 150 },
  { id: "raincoat", kind: "avatar", slot: "body", label: "노란 우비", price: 220 },
  { id: "spacesuit", kind: "avatar", slot: "body", label: "우주복", price: 300 },
  // 책장 꾸미기 (11-13 사용자: "꾸미기에서 책장 넓히기나 이런 것들도")
  { id: "shelf-wide", kind: "shelf", label: "넓은 책장", price: 250 },
  { id: "shelf-tall", kind: "shelf", label: "높은 책장", price: 300 },
  { id: "paint", kind: "shelf", label: "책장 칠하기", price: 150 },
  { id: "ladder", kind: "room", label: "책장 사다리", price: 120 },
];

/** 옷 가게 물건 (자리 body) */
export const CLOTHES = TRACK.filter((t) => t.slot === "body");

/** 책장 꾸미기 물건 — 넓은·높은 책장·칠하기(켜고 끄기) + 사다리(방 물건, 책장 옆에 기대 둔다) */
export const SHELF_ITEMS = TRACK.filter((t) => t.kind === "shelf" || t.id === "ladder");

/** 책장 칠하기 색 (책장 칠하기를 켜 두면) — 원목은 칠하기 전 색 */
export const PAINTS = ["mint", "white", "coral", "sky", "butter", "wood"] as const;
export type PaintId = (typeof PAINTS)[number];
export const PAINT_LABEL: Record<PaintId, string> = { mint: "민트", white: "하양", coral: "코랄", sky: "하늘", butter: "버터", wood: "원목" };
/** 칠한 책장 색 — [옆판·받침, 선반·지붕] */
export const PAINT_COLOR: Record<PaintId, [string, string]> = {
  mint: ["#9fd3bf", "#c3e7d9"],
  white: ["#efe6d6", "#fbf6ec"],
  coral: ["#ee9f8c", "#f7c3b6"],
  sky: ["#9cc8dd", "#c6e1ee"],
  butter: ["#f0cf73", "#f8e3a4"],
  wood: ["#dcac78", "#ecc596"],
};

export const ITEM: Record<string, DecoItem> = Object.fromEntries(TRACK.map((t) => [t.id, t]));
const IDS = TRACK.map((t) => t.id) as [string, ...string[]];
export const itemIdSchema = z.enum(IDS);

/** 포인트 — 이름은 한 곳에서 (바꾸기 쉽게) */
export const POINT_NAME = "포인트";
export const POINTS = {
  welcome: 100, // 처음 가입
  finish: 100, // 앱에서 읽은 책을 다 읽으면 (10분 이상 기록이 있는 책)
  finishDailyMax: 3, // 하루에 다 읽음 포인트를 받는 책 수
  finishMinMinutes: 10,
  shelve: 10, // 책을 꽂으면
  shelveDailyMax: 5, // 하루에 꽂기 포인트를 받는 책 수
  readPer10: 5, // 읽은 시간 10분마다
  readDailyCap: 60, // 읽은 시간으로 하루에 받는 최대
} as const;

/** 이번 기록으로 받을 읽기 포인트 (오늘 이미 받은 것까지 생각해서) */
export function readingPoints(minutes: number, earnedToday: number): number {
  const raw = Math.floor(Math.max(0, minutes) / 10) * POINTS.readPer10;
  return Math.max(0, Math.min(raw, POINTS.readDailyCap - earnedToday));
}

/** 한국 날짜 (하루 한도는 한국 자정 기준) */
export function kstDay(d: Date): string {
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** 방 물건을 놓는 곳 — 책장 위 · 바닥 · 벽 */
export type Surface = "top" | "floor" | "wall";

/**
 * 방 물건마다 옮겨 놓을 수 있는 곳 (첫 번째 = 처음 자리). 줄 전구는 책장에 걸려 있어 못 옮긴다.
 * 11-13 사용자: "아이템으로 받은 것들 위치도 옮기고 이런 것도 가능할까?"
 */
export const ROOM_SURFACES: Record<string, Surface[]> = {
  plant: ["top", "floor"],
  lamp: ["top", "floor"],
  window: ["wall"],
  frame: ["wall"],
  cat: ["floor"],
  table: ["floor"],
};

/**
 * 옮긴 자리 (cm) — 기준점에서 떨어진 만큼이라 책장이 넓어지거나 방석이 움직여도 같이 따라간다
 *   top: 첫 책장 가운데에서 x · floor: 방석에서 (x, z) · wall: 첫 책장 가운데에서 x, 바닥에서 물건 아래 끝 y
 */
export type ItemPos = { s: "top"; x: number } | { s: "floor"; x: number; z: number } | { s: "wall"; x: number; y: number };

export type Deco = {
  owned: string[]; // 가진 물건 (산 것 + 예전에 받은 선물)
  boxes: string[]; // 아직 안 연 배달 상자 (산 순서대로)
  worn: string[]; // 아바타가 하고 있는 소품 (자리마다 하나)
  placed: string[]; // 도서관에 놓은 물건
  pos: Record<string, ItemPos>; // 옮긴 물건의 자리 (없으면 처음 자리) — 치워도 기억해 둔다
  paint: PaintId; // 책장 칠하기 색 ('책장 칠하기'를 켜 두었을 때만)
};

export const EMPTY_DECO: Deco = { owned: [], boxes: [], worn: [], placed: [], pos: {}, paint: "mint" };

const posNum = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v * 10) / 10 : null);

/** 자리 하나 거르기 — 그 물건이 갈 수 없는 곳·이상한 숫자는 버린다 */
export function readItemPos(id: string, v: unknown): ItemPos | null {
  const ok = ROOM_SURFACES[id];
  if (!ok || !v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (o.s === "top" && ok.includes("top")) {
    const x = posNum(o.x, -300, 300);
    return x == null ? null : { s: "top", x };
  }
  if (o.s === "floor" && ok.includes("floor")) {
    const x = posNum(o.x, -300, 300);
    const z = posNum(o.z, -300, 300);
    return x == null || z == null ? null : { s: "floor", x, z };
  }
  if (o.s === "wall" && ok.includes("wall")) {
    const x = posNum(o.x, -300, 300);
    const y = posNum(o.y, 0, 300);
    return x == null || y == null ? null : { s: "wall", x, y };
  }
  return null;
}

/** 소품을 하면 같은 자리 것은 벗는다 */
export function wear(worn: string[], id: string): string[] {
  const it = ITEM[id];
  if (!it || it.kind !== "avatar") return worn;
  return [...worn.filter((w) => ITEM[w]?.slot !== it.slot), id];
}

/** 살 수 있나 — 이미 가졌거나 배달 중이면 안 되고, 포인트가 모자라도 안 된다 */
export function canBuy(deco: Deco, points: number, id: string): "ok" | "owned" | "coming" | "short" | "unknown" {
  const it = ITEM[id];
  if (!it) return "unknown";
  if (deco.owned.includes(id)) return "owned";
  if (deco.boxes.includes(id)) return "coming";
  if (points < it.price) return "short";
  return "ok";
}

/** 배달 상자 하나 열기 — 맨 앞 상자의 물건이 내 것이 되고, 바로 하고/놓는다 */
export function openBox(deco: Deco): { deco: Deco; item: DecoItem } | null {
  const id = deco.boxes[0];
  const item = id ? ITEM[id] : undefined;
  if (!item) return null;
  return {
    item,
    deco: {
      owned: deco.owned.includes(id) ? deco.owned : [...deco.owned, id],
      boxes: deco.boxes.slice(1),
      worn: item.kind === "avatar" ? wear(deco.worn, id) : deco.worn,
      placed: item.kind !== "avatar" && !deco.placed.includes(id) ? [...deco.placed, id] : deco.placed,
      pos: deco.pos,
      paint: deco.paint,
    },
  };
}

/** DB·요청 값을 안전하게 — 모르는 물건·안 가진 물건·같은 자리 두 개는 버린다. 옛 모양(opened 수)은 가진 물건으로 옮긴다 */
export function readDeco(v: unknown): Deco {
  if (!v || typeof v !== "object") return { owned: [], boxes: [], worn: [], placed: [], pos: {}, paint: "mint" };
  const src = v as Record<string, unknown>;
  const valid = (x: unknown) => (Array.isArray(x) ? [...new Set(x.filter((i): i is string => typeof i === "string" && i in ITEM))] : []);
  let owned = valid(src.owned);
  if (!Array.isArray(src.owned) && typeof src.opened === "number" && Number.isFinite(src.opened)) {
    owned = TRACK.slice(0, Math.max(0, Math.min(TRACK.length, Math.floor(src.opened)))).map((t) => t.id); // 11-12 선물 → 가진 물건
  }
  const mine = new Set(owned);
  const boxes = valid(src.boxes).filter((id) => !mine.has(id));
  let worn: string[] = [];
  for (const id of valid(src.worn)) if (mine.has(id) && ITEM[id].kind === "avatar") worn = wear(worn, id);
  const placed = valid(src.placed).filter((id) => mine.has(id) && ITEM[id].kind !== "avatar");
  const pos: Record<string, ItemPos> = {};
  if (src.pos && typeof src.pos === "object" && !Array.isArray(src.pos)) {
    for (const [id, p] of Object.entries(src.pos as Record<string, unknown>)) {
      if (!mine.has(id)) continue;
      const ok = readItemPos(id, p);
      if (ok) pos[id] = ok;
    }
  }
  const paint = (PAINTS as readonly string[]).includes(src.paint as string) ? (src.paint as PaintId) : "mint";
  return { owned, boxes, worn, placed, pos, paint };
}

const posSchema = z.discriminatedUnion("s", [
  z.object({ s: z.literal("top"), x: z.number().min(-300).max(300) }),
  z.object({ s: z.literal("floor"), x: z.number().min(-300).max(300), z: z.number().min(-300).max(300) }),
  z.object({ s: z.literal("wall"), x: z.number().min(-300).max(300), y: z.number().min(0).max(300) }),
]);

/** 꾸미기 고치기 요청 — 가진 물건 안에서만 (서버가 readDeco 로 한 번 더 거른다). pos 는 늘 전체 값(빈 값 = 모두 처음 자리) */
export const decoPatchSchema = z.object({
  worn: z.array(itemIdSchema).max(TRACK.length).optional(),
  placed: z.array(itemIdSchema).max(TRACK.length).optional(),
  pos: z.partialRecord(itemIdSchema, posSchema).optional(),
  paint: z.enum(PAINTS).optional(),
});
