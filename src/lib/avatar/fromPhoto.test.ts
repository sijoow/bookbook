import { describe, expect, it } from "vitest";
import { HAIR_COLOR_LABEL, HAIR_LABEL, SKIN_LABEL } from "./config";
import { GUIDE, clampView, fitView, hairColorOf, photoPatch, photoSummary, readPhoto, skinOf, zoomAt, type Pixels } from "./fromPhoto";

type RGB = [number, number, number];

/** 시험용 얼굴 그림 — 진짜 사진 대신 코드로 그린다 (배경 · 긴 머리 · 머리 덮개 · 얼굴 · 앞머리, 약간의 얼룩) */
function face(o: { bg: RGB; skin: RGB; hair: RGB | null; long?: boolean; bangs?: boolean; size?: number; at?: { dx: number; dy: number; k: number } }): Pixels {
  const N = o.size ?? 160;
  const data = new Uint8ClampedArray(N * N * 4);
  const at = o.at ?? { dx: 0, dy: 0, k: 1 };
  const cx = GUIDE.cx + at.dx;
  const cy = GUIDE.cy + at.dy;
  const rx = GUIDE.rx * at.k;
  const ry = GUIDE.ry * at.k;
  let seed = 7;
  const noise = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return ((seed >> 8) % 25) - 12; // -12 ~ 12
  };
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N;
      const v = (j + 0.5) / N;
      let c: RGB = o.bg;
      if (o.hair && o.long && u > cx - rx - 0.1 && u < cx + rx + 0.1 && v > cy - ry && v < cy + ry * 0.7) c = o.hair;
      if (o.hair && ((u - cx) / (rx * 1.15)) ** 2 + ((v - (cy - ry * 0.25)) / (ry * 1.05)) ** 2 < 1) c = o.hair;
      const inFace = ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 < 1;
      if (inFace) c = o.skin;
      if (o.hair && o.bangs && inFace && v < cy - ry * 0.45) c = o.hair;
      const k = (j * N + i) * 4;
      const n = noise();
      data[k] = c[0] + n;
      data[k + 1] = c[1] + n;
      data[k + 2] = c[2] + n;
      data[k + 3] = 255;
    }
  }
  return { data, width: N, height: N };
}

const WALL: RGB = [236, 232, 224];

describe("내 사진으로 아바타 — 사진 읽기", () => {
  it("밝은 피부 · 검은 긴 머리", () => {
    const r = readPhoto(face({ bg: WALL, skin: [232, 196, 172], hair: [38, 32, 30], long: true }));
    expect(r).toEqual({ face: true, skin: "light", hairColor: "black", long: true, bangs: false, sure: true });
  });

  it("중간 피부 · 갈색 짧은 머리 + 앞머리", () => {
    const r = readPhoto(face({ bg: WALL, skin: [186, 138, 108], hair: [110, 72, 44], bangs: true }));
    expect(r).toEqual({ face: true, skin: "tan", hairColor: "brown", long: false, bangs: true, sure: true });
  });

  it("짙은 피부 · 짧은 머리 · 앞머리 없음", () => {
    const r = readPhoto(face({ bg: WALL, skin: [120, 82, 62], hair: [30, 26, 26] }));
    expect(r).toEqual({ face: true, skin: "deep", hairColor: "black", long: false, bangs: false, sure: true });
  });

  it("어두운 배경이어도 머리를 배경으로 착각하지 않는다", () => {
    const r = readPhoto(face({ bg: [70, 90, 110], skin: [232, 196, 172], hair: [60, 40, 28], long: true }));
    expect(r.sure).toBe(true);
    expect(r.hairColor).toBe("choco");
    expect(r.long).toBe(true);
  });

  it("머리가 안 보이면(민머리·잘린 사진) 피부만 읽는다", () => {
    const r = readPhoto(face({ bg: WALL, skin: [232, 196, 172], hair: null }));
    expect(r).toEqual({ face: true, skin: "light", hairColor: null, long: false, bangs: false, sure: false });
  });

  it("한 가지 색뿐인 사진도 멈추지 않는다", () => {
    const r = readPhoto(face({ bg: [128, 128, 128], skin: [128, 128, 128], hair: null, size: 40 }));
    expect(r.sure).toBe(false);
    expect(r.face).toBe(false);
  });

  it("얼굴을 동그라미에 안 맞췄으면(작고 한쪽에) 얼굴이 아니라고 알린다", () => {
    const off = face({ bg: WALL, skin: [190, 140, 110], hair: [34, 30, 30], at: { dx: 0.08, dy: -0.14, k: 0.6 } });
    expect(readPhoto(off).face).toBe(false);
    // 같은 얼굴을 맞추면 괜찮다
    expect(readPhoto(face({ bg: WALL, skin: [190, 140, 110], hair: [34, 30, 30] })).face).toBe(true);
  });

  it("밝기로 피부·머리 색을 고른다", () => {
    expect(skinOf([248, 220, 196])).toBe("light");
    expect(skinOf([186, 138, 108])).toBe("tan");
    expect(skinOf([110, 75, 58])).toBe("deep");
    expect(hairColorOf([20, 18, 18])).toBe("black");
    expect(hairColorOf([74, 52, 38])).toBe("choco");
    expect(hairColorOf([122, 79, 46])).toBe("brown");
    expect(hairColorOf([185, 120, 63])).toBe("caramel");
  });
});

describe("내 사진으로 아바타 — 아바타에 입히기", () => {
  const long = { face: true, skin: "light", hairColor: "black", long: true, bangs: false, sure: true } as const;
  const short = { face: true, skin: "tan", hairColor: "brown", long: false, bangs: false, sure: true } as const;

  it("성별은 사진으로 짐작하지 않고 지금 고른 그대로", () => {
    expect(photoPatch(long, { hair: "short", gender: "boy" })).not.toHaveProperty("gender");
    expect(photoPatch(short, { hair: "bob", gender: "girl" })).not.toHaveProperty("gender");
  });

  it("긴 머리 — 양갈래·똥머리면 그대로, 아니면 단발", () => {
    expect(photoPatch(long, { hair: "pigtails", gender: "girl" }).hair).toBe("pigtails");
    expect(photoPatch(long, { hair: "short", gender: "girl" }).hair).toBe("bob");
    expect(photoPatch(long, { hair: "spiky", gender: "boy" }).hair).toBe("bob");
  });

  it("짧은 머리 — 남자아이는 앞머리면 바가지, 삐죽·가르마는 그대로", () => {
    expect(photoPatch({ ...short, bangs: true }, { hair: "short", gender: "boy" }).hair).toBe("bowl");
    expect(photoPatch(short, { hair: "spiky", gender: "boy" }).hair).toBe("spiky");
    expect(photoPatch(short, { hair: "bob", gender: "boy" }).hair).toBe("short");
    expect(photoPatch(short, { hair: "pigtails", gender: "girl" }).hair).toBe("short");
  });

  it("머리를 못 읽었으면 피부만 바꾼다 (안경·눈·입은 늘 그대로)", () => {
    const p = photoPatch({ face: true, skin: "deep", hairColor: null, long: false, bangs: false, sure: false }, { hair: "bun", gender: "girl" });
    expect(p).toEqual({ skin: "deep" });
    expect(Object.keys(photoPatch(long, { hair: "bob", gender: "girl" })).sort()).toEqual(["hair", "hairColor", "skin"]);
  });

  it("읽은 것을 한 줄로", () => {
    const p = photoPatch(long, { hair: "short", gender: "girl" });
    expect(photoSummary(long, p, { skin: SKIN_LABEL, hairColor: HAIR_COLOR_LABEL, hair: HAIR_LABEL })).toBe("밝은 피부 · 검정 머리 · 단발");
  });
});

describe("내 사진으로 아바타 — 사진 맞추기", () => {
  it("처음엔 틀을 꽉 채우고 가운데", () => {
    const v = fitView(400, 300, 200);
    expect(v.scale).toBeCloseTo(200 / 300);
    expect(v.y).toBe(0);
    expect(v.x).toBeCloseTo((200 - 400 * (200 / 300)) / 2);
  });

  it("끌어도 틀 안에 빈 곳이 생기지 않는다", () => {
    const v = clampView({ scale: 1, x: 80, y: -500 }, 400, 400, 200);
    expect(v).toEqual({ scale: 1, x: 0, y: -200 }); // 왼쪽 빈 곳 X, 아래 빈 곳 X
    expect(clampView({ scale: 0.1, x: 0, y: 0 }, 400, 400, 200).scale).toBe(0.5); // 꽉 채움보다 작게는 안 됨
    expect(clampView({ scale: 9, x: 0, y: 0 }, 400, 400, 200).scale).toBe(2); // 4배까지
  });

  it("손가락 사이 점을 그 자리에 둔 채 크게", () => {
    const v0 = fitView(400, 400, 200);
    const v1 = zoomAt(v0, 2, 120, 90, 400, 400, 200);
    expect(v1.scale).toBeCloseTo(1);
    // (120, 90) 아래 사진 점이 그대로
    expect((120 - v1.x) / v1.scale).toBeCloseTo((120 - v0.x) / v0.scale);
    expect((90 - v1.y) / v1.scale).toBeCloseTo((90 - v0.y) / v0.scale);
  });
});
