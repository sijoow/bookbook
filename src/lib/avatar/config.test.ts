import { describe, expect, it } from "vitest";
import { AVATAR_COLOR, EYE_COLORS, FACE_DEFAULT, HAIR_COLORS, HAIR_STYLES, OUTFITS, PRESETS, avatarPatchSchema, avatarSchema, defaultAvatar, randomFace, readAvatar } from "./config";

describe("아바타 설정", () => {
  it("처음 아바타는 아이디마다 정해지고 늘 같다", () => {
    const a = defaultAvatar("jimin");
    expect(defaultAvatar("jimin")).toEqual(a);
    expect(avatarSchema.safeParse(a).success).toBe(true);
    expect(a.glasses).toBe(false);
  });

  it("친구들이 다 똑같이 생기지 않는다", () => {
    const looks = new Set(["dev", "jimin", "hyunwoo", "mom", "a", "b"].map((h) => JSON.stringify(defaultAvatar(h))));
    expect(looks.size).toBeGreaterThan(3);
  });

  it("DB 값은 맞는 칸만 받는다 (옛 문서·틀린 값)", () => {
    const base = defaultAvatar("dev");
    expect(readAvatar(undefined, "dev")).toEqual(base);
    expect(readAvatar("이상한 값", "dev")).toEqual(base);
    const r = readAvatar({ hair: "beanie", outfit: "보라", glasses: "yes" }, "dev");
    expect(r.hair).toBe("beanie");
    expect(r.outfit).toBe(base.outfit); // 없는 색은 버린다
    expect(r.glasses).toBe(false);
  });

  it("고치기 요청은 일부만 보내도 되고, 없는 값은 막는다", () => {
    expect(avatarPatchSchema.safeParse({ outfit: "mint" }).success).toBe(true);
    expect(avatarPatchSchema.safeParse({ outfit: "purple" }).success).toBe(false);
  });

  it("고를 수 있는 모든 값에 색이 있다 (보라 없음)", () => {
    for (const o of OUTFITS) expect(AVATAR_COLOR.outfit[o]).toMatch(/^#[0-9a-f]{6}$/);
    expect(HAIR_STYLES.length).toBe(13); // 11-12 여덟 + 11-13 다섯 (긴 생머리·포니테일·땋은 머리·뽀글·웨이브)
    for (const c of HAIR_COLORS) expect(AVATAR_COLOR.hair[c]).toMatch(/^#[0-9a-f]{6}$/);
    for (const c of EYE_COLORS) expect(AVATAR_COLOR.eye[c]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("얼굴 칸이 없는 옛 아바타는 첫 얼굴 그대로 (눈 동글·눈썹 없음·미소·발그레·스티커 없음)", () => {
    const old = readAvatar({ hair: "bun", hairColor: "choco", skin: "light", outfit: "coral", glasses: false }, "dev");
    expect(old).toMatchObject(FACE_DEFAULT);
    expect(old.hair).toBe("bun");
    expect(readAvatar({ eyes: "sparkle", mouth: "앙" }, "dev")).toMatchObject({ eyes: "sparkle", mouth: "smile" });
  });

  it("'아무거나'는 늘 고를 수 있는 값만", () => {
    for (const seed of [0, 0.2, 0.5, 0.8, 0.999]) {
      const face = randomFace(() => seed);
      expect(avatarPatchSchema.safeParse(face).success).toBe(true);
    }
  });
});

describe("예시 모습 (추천)", () => {
  it("아홉 명 모두 맞는 값이고 서로 다르다", () => {
    expect(PRESETS).toHaveLength(9);
    for (const p of PRESETS) expect(avatarSchema.safeParse({ ...p.look, pet: "none" }).success).toBe(true);
    expect(new Set(PRESETS.map((p) => JSON.stringify(p.look))).size).toBe(PRESETS.length);
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
  });
});
