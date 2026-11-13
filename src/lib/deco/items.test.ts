import { describe, expect, it } from "vitest";
import { CLOTHES, EMPTY_DECO, ITEM, POINTS, TRACK, canBuy, decoPatchSchema, kstDay, openBox, readDeco, readItemPos, readingPoints, wear } from "./items";

describe("상점 물건", () => {
  it("처음 14개는 아바타 소품과 도서관 물건이 번갈아, 뒤는 옷 가게 · 값은 모두 양수", () => {
    expect(TRACK).toHaveLength(24);
    TRACK.slice(0, 14).forEach((t, i) => expect(t.kind).toBe(i % 2 ? "avatar" : "room"));
    expect(CLOTHES.map((t) => t.id)).toEqual(["stripes", "overalls", "dots", "sweater", "raincoat", "spacesuit"]);
    expect(CLOTHES.every((t) => t.kind === "avatar" && t.slot === "body")).toBe(true);
    expect(TRACK.every((t) => t.price > 0)).toBe(true);
  });

  it("옷은 한 벌만 — 새 옷을 입으면 입던 옷은 벗고, 머리·목 소품은 그대로", () => {
    expect(wear(["ribbon", "scarf", "stripes"], "dots")).toEqual(["ribbon", "scarf", "dots"]);
  });

  it("처음 가입 포인트로 작은 물건 하나는 바로 살 수 있다", () => {
    expect(Math.min(...TRACK.map((t) => t.price))).toBeLessThanOrEqual(POINTS.welcome);
  });
});

describe("포인트 규칙", () => {
  it("읽은 시간 10분마다, 하루 한도까지", () => {
    expect(readingPoints(9, 0)).toBe(0);
    expect(readingPoints(10, 0)).toBe(POINTS.readPer10);
    expect(readingPoints(45, 0)).toBe(4 * POINTS.readPer10);
    expect(readingPoints(600, 0)).toBe(POINTS.readDailyCap);
    expect(readingPoints(60, POINTS.readDailyCap - 5)).toBe(5);
    expect(readingPoints(60, POINTS.readDailyCap)).toBe(0);
  });

  it("하루는 한국 자정 기준", () => {
    expect(kstDay(new Date("2026-11-13T14:59:00Z"))).toBe("2026-11-13"); // 밤 11:59
    expect(kstDay(new Date("2026-11-13T15:00:00Z"))).toBe("2026-11-14"); // 자정
  });
});

describe("사기 · 배달 상자", () => {
  const deco = { ...EMPTY_DECO, owned: ["plant"], boxes: ["ribbon"] };
  it("가진 것·배달 중인 것·포인트 모자람", () => {
    expect(canBuy(deco, 999, "plant")).toBe("owned");
    expect(canBuy(deco, 999, "ribbon")).toBe("coming");
    expect(canBuy(deco, ITEM.crown.price - 1, "crown")).toBe("short");
    expect(canBuy(deco, ITEM.crown.price, "crown")).toBe("ok");
    expect(canBuy(deco, 999, "없는물건")).toBe("unknown");
  });

  it("상자를 열면 맨 앞 물건이 내 것이 되고 바로 하고/놓는다", () => {
    const a = openBox({ ...EMPTY_DECO, owned: [], boxes: ["ribbon", "lamp"], worn: [], placed: [] });
    expect(a?.item.id).toBe("ribbon");
    expect(a?.deco).toEqual({ owned: ["ribbon"], boxes: ["lamp"], worn: ["ribbon"], placed: [], pos: {}, paint: "mint" });
    const b = openBox(a!.deco);
    expect(b?.deco).toEqual({ owned: ["ribbon", "lamp"], boxes: [], worn: ["ribbon"], placed: ["lamp"], pos: {}, paint: "mint" });
    expect(openBox(b!.deco)).toBeNull();
  });

  it("같은 자리(머리) 소품은 하나만 — 새 것으로 바뀐다", () => {
    expect(wear(["ribbon", "scarf"], "crown")).toEqual(["scarf", "crown"]);
    expect(wear(["ribbon"], "lamp")).toEqual(["ribbon"]); // 방 물건은 '하기'가 아니다
  });
});

describe("저장값 거르기", () => {
  it("옛 모양(연 선물 수)은 앞에서부터 가진 물건으로", () => {
    const d = readDeco({ opened: 3, worn: ["ribbon"], placed: ["plant", "lamp"] });
    expect(d.owned).toEqual(["plant", "ribbon", "lamp"]);
    expect(d.boxes).toEqual([]);
    expect(d.worn).toEqual(["ribbon"]);
    expect(d.placed).toEqual(["plant", "lamp"]);
  });

  it("모르는 물건·안 가진 물건·같은 자리 두 개·가진 것의 배달 상자는 버린다", () => {
    const d = readDeco({ owned: ["ribbon", "crown", "plant", "모름"], boxes: ["plant", "cat"], worn: ["ribbon", "crown", "scarf"], placed: ["plant", "window"] });
    expect(d.owned).toEqual(["ribbon", "crown", "plant"]);
    expect(d.boxes).toEqual(["cat"]);
    expect(d.worn).toEqual(["crown"]);
    expect(d.placed).toEqual(["plant"]);
    expect(readDeco(null)).toEqual(EMPTY_DECO);
  });

  it("요청 모양은 목록에 있는 이름만", () => {
    expect(decoPatchSchema.safeParse({ worn: ["ribbon"] }).success).toBe(true);
    expect(decoPatchSchema.safeParse({ placed: ["sofa"] }).success).toBe(false);
  });
});

describe("옮긴 물건 자리 (pos)", () => {
  it("물건마다 갈 수 있는 면만 — 고양이는 벽에 못 걸고, 줄 전구는 못 옮긴다", () => {
    expect(readItemPos("plant", { s: "floor", x: 3.14159, z: -5 })).toEqual({ s: "floor", x: 3.1, z: -5 });
    expect(readItemPos("cat", { s: "wall", x: 0, y: 80 })).toBeNull();
    expect(readItemPos("lights", { s: "wall", x: 0, y: 80 })).toBeNull();
    expect(readItemPos("frame", { s: "wall", x: 0, y: -1 })).toBeNull();
    expect(readItemPos("frame", { s: "wall", x: Number.NaN, y: 80 })).toBeNull();
    expect(readItemPos("nope", { s: "top", x: 0 })).toBeNull();
  });
  it("가진 물건 자리만 남기고, 치운 물건 자리는 기억한다", () => {
    const d = readDeco({
      owned: ["plant", "cat"],
      placed: ["cat"],
      pos: { plant: { s: "top", x: 5 }, cat: { s: "floor", x: -30, z: -8 }, table: { s: "floor", x: 1, z: 1 }, window: "bad" },
    });
    expect(d.pos).toEqual({ plant: { s: "top", x: 5 }, cat: { s: "floor", x: -30, z: -8 } });
    expect(readDeco(null).pos).toEqual({});
    expect(readDeco({ owned: [], pos: [1, 2] }).pos).toEqual({});
  });
  it("요청 검사 — 모르는 물건·이상한 면은 막는다", () => {
    expect(decoPatchSchema.safeParse({ pos: { plant: { s: "floor", x: 1, z: 2 } } }).success).toBe(true);
    expect(decoPatchSchema.safeParse({ pos: {} }).success).toBe(true);
    expect(decoPatchSchema.safeParse({ pos: { plant: { s: "sky", x: 1 } } }).success).toBe(false);
    expect(decoPatchSchema.safeParse({ pos: { ghost: { s: "top", x: 1 } } }).success).toBe(false);
  });
});

describe("책장 꾸미기", () => {
  it("넓은·높은 책장·칠하기는 상자를 열면 바로 켜진다(놓기), 칠하기 색은 고른 것만", () => {
    const a = openBox({ ...EMPTY_DECO, owned: [], boxes: ["shelf-wide", "paint"], worn: [], placed: [] });
    expect(a?.deco.placed).toEqual(["shelf-wide"]);
    expect(openBox(a!.deco)?.deco.placed).toEqual(["shelf-wide", "paint"]);
    expect(readDeco({ owned: ["paint"], placed: ["paint"], paint: "sky" }).paint).toBe("sky");
    expect(readDeco({ owned: ["paint"], placed: ["paint"], paint: "purple" }).paint).toBe("mint");
    expect(decoPatchSchema.safeParse({ paint: "coral" }).success).toBe(true);
    expect(decoPatchSchema.safeParse({ paint: "neon" }).success).toBe(false);
  });
});
