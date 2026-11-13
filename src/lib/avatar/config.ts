// 나만의 아바타 — 머리 모양·머리 색·피부·옷 색·안경 + 얼굴(눈·눈썹·입·볼·얼굴 스티커). 그림 파일 없이 코드로 만드는 입체 캐릭터의 설정값.
// 11-12 사용자: "마이페이지에서 얼굴 꾸미기나 이런 거 있게" → 얼굴 칸 추가 (옛 아바타는 지금 얼굴 그대로가 기본값)
// 11-12 사용자: "애기가 앉아 있다가 나만의 아바타가 직접 꺼낸다" (참고: 산사 — 동자승이 방석에 앉아 있는 가상 사찰)
// 화면(three.js)·서버(저장)·시험이 함께 쓴다.

import { z } from "zod";

export const HAIR_STYLES = ["bob", "short", "pigtails", "bun", "beanie", "bowl", "spiky", "side", "long", "ponytail", "braids", "curly", "wavy"] as const; // 11-13 뒤 다섯 더
export const GENDERS = ["girl", "boy"] as const; // 11-12 사용자: "여자애만 있는데 남자 여자 있고"
export const PETS = ["none", "dog", "cat", "rabbit", "hamster", "chick"] as const; // 11-12 사용자: "동반 애견이나 이런 요소도 고를 수 있게"
export const HAIR_COLORS = ["choco", "brown", "black", "caramel", "auburn", "blonde", "ash", "rose"] as const; // 11-13 뒤 넷 더 (동물의 숲처럼 여러 색)
export const SKINS = ["light", "tan", "deep"] as const;
export const OUTFITS = ["apricot", "mint", "butter", "coral", "sky"] as const;
export const EYES = ["round", "dot", "sparkle", "lash", "sleepy"] as const;
export const BROWS = ["none", "soft", "straight", "bold"] as const;
export const MOUTHS = ["smile", "cat", "open", "line"] as const;
export const CHEEKS = ["blush", "freckles", "both", "none"] as const;
export const STICKERS = ["none", "mole", "star", "heart"] as const;
export const EYE_COLORS = ["ink", "brown", "honey", "gray", "sea", "leaf"] as const; // 눈동자 색 (11-13)
export const NOSES = ["dot", "round", "line", "none"] as const; // 코 (11-13)

export type HairStyle = (typeof HAIR_STYLES)[number];
export type HairColor = (typeof HAIR_COLORS)[number];
export type Skin = (typeof SKINS)[number];
export type Outfit = (typeof OUTFITS)[number];
export type Eyes = (typeof EYES)[number];
export type Brows = (typeof BROWS)[number];
export type Mouth = (typeof MOUTHS)[number];
export type Cheeks = (typeof CHEEKS)[number];
export type FaceSticker = (typeof STICKERS)[number];
export type EyeColor = (typeof EYE_COLORS)[number];
export type Nose = (typeof NOSES)[number];
export type Gender = (typeof GENDERS)[number];
export type Pet = (typeof PETS)[number];

export const avatarSchema = z.object({
  hair: z.enum(HAIR_STYLES),
  hairColor: z.enum(HAIR_COLORS),
  skin: z.enum(SKINS),
  outfit: z.enum(OUTFITS),
  glasses: z.boolean(),
  eyes: z.enum(EYES),
  brows: z.enum(BROWS),
  mouth: z.enum(MOUTHS),
  cheeks: z.enum(CHEEKS),
  sticker: z.enum(STICKERS),
  eyeColor: z.enum(EYE_COLORS),
  nose: z.enum(NOSES),
  gender: z.enum(GENDERS),
  pet: z.enum(PETS),
});
export type AvatarConfig = z.infer<typeof avatarSchema>;

/** 고치기 요청 — 바꿀 것만 */
export const avatarPatchSchema = avatarSchema.partial();

export const HAIR_LABEL: Record<HairStyle, string> = {
  bob: "단발",
  short: "짧은 머리",
  pigtails: "양갈래",
  bun: "똥머리",
  beanie: "털모자",
  bowl: "바가지",
  spiky: "삐죽",
  side: "가르마",
  long: "긴 생머리",
  ponytail: "포니테일",
  braids: "땋은 머리",
  curly: "뽀글 머리",
  wavy: "웨이브 단발",
};
export const HAIR_COLOR_LABEL: Record<HairColor, string> = { choco: "초코", brown: "갈색", black: "검정", caramel: "캐러멜", auburn: "적갈색", blonde: "금발", ash: "잿빛", rose: "분홍" };
export const SKIN_LABEL: Record<Skin, string> = { light: "밝은", tan: "중간", deep: "짙은" };
export const OUTFIT_LABEL: Record<Outfit, string> = { apricot: "살구", mint: "민트", butter: "버터", coral: "코랄", sky: "하늘" };
export const EYES_LABEL: Record<Eyes, string> = { round: "동글", dot: "콩알", sparkle: "반짝", lash: "속눈썹", sleepy: "졸린" };
export const BROWS_LABEL: Record<Brows, string> = { none: "없음", soft: "동글", straight: "일자", bold: "진한" };
export const MOUTH_LABEL: Record<Mouth, string> = { smile: "미소", cat: "고양이", open: "활짝", line: "새침" };
export const CHEEKS_LABEL: Record<Cheeks, string> = { blush: "발그레", freckles: "주근깨", both: "둘 다", none: "없음" };
export const STICKER_LABEL: Record<FaceSticker, string> = { none: "없음", mole: "점", star: "별", heart: "하트" };
export const EYE_COLOR_LABEL: Record<EyeColor, string> = { ink: "까망", brown: "갈색", honey: "꿀색", gray: "회색", sea: "바다", leaf: "풀잎" };
export const NOSE_LABEL: Record<Nose, string> = { dot: "콩", round: "동글", line: "선", none: "없음" };

export const GENDER_LABEL: Record<Gender, string> = { girl: "여자아이", boy: "남자아이" };
export const PET_LABEL: Record<Pet, string> = { none: "없음", dog: "강아지", cat: "고양이", rabbit: "토끼", hamster: "햄스터", chick: "병아리" };
/** 성별을 고르면 먼저 보여 줄 머리 (다른 머리도 다 고를 수 있다) */
export const HAIR_FOR: Record<Gender, HairStyle[]> = {
  girl: ["bob", "long", "pigtails", "ponytail", "braids", "bun", "wavy", "curly", "beanie", "short", "bowl", "spiky", "side"],
  boy: ["short", "bowl", "spiky", "side", "curly", "beanie", "bob", "wavy", "long", "ponytail", "pigtails", "braids", "bun"],
};
export const GENDER_HAIR: Record<Gender, HairStyle> = { girl: "bob", boy: "short" };

/** 얼굴 처음 값 = 11-12 첫 아바타 얼굴 그대로 (옛 아바타가 바뀌어 보이지 않게) */
export const FACE_DEFAULT = { eyes: "round", brows: "none", mouth: "smile", cheeks: "blush", sticker: "none", eyeColor: "ink", nose: "dot" } as const satisfies Pick<
  AvatarConfig,
  "eyes" | "brows" | "mouth" | "cheeks" | "sticker" | "eyeColor" | "nose"
>;

/** 색 — 앱 팔레트(globals.css)와 같은 값. 보라·형광 없음 */
export const AVATAR_COLOR = {
  hair: { choco: "#4a3426", brown: "#7a4f2e", black: "#2e2724", caramel: "#b9783f", auburn: "#a4492f", blonde: "#e0b860", ash: "#9a948e", rose: "#e3a0a6" } satisfies Record<HairColor, string>,
  eye: { ink: "#3d2c22", brown: "#6e4630", honey: "#a2702c", gray: "#5d6670", sea: "#3f7590", leaf: "#4c7c55" } satisfies Record<EyeColor, string>,
  skin: { light: "#f8dcc4", tan: "#e8bb93", deep: "#b98260" } satisfies Record<Skin, string>,
  outfit: { apricot: "#f0a35e", mint: "#8fcdb6", butter: "#f6d77c", coral: "#ef8f7c", sky: "#8cc3dc" } satisfies Record<Outfit, string>,
};

function hash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h;
}

/** 아이디로 정해지는 처음 아바타 — 친구마다 다르게 보이게 (안경은 처음엔 없음) */
export function defaultAvatar(handle: string): AvatarConfig {
  const h = hash(handle || "me");
  return {
    hair: HAIR_STYLES[h % 8], // 처음 8 가지 안에서 (머리를 더해도 옛 기본 모습이 안 바뀌게)
    hairColor: HAIR_COLORS[(h >>> 3) % 4],
    skin: SKINS[(h >>> 6) % 2], // 처음엔 밝은·중간 중 하나, 바꾸기는 셋 다
    outfit: OUTFITS[(h >>> 9) % OUTFITS.length],
    glasses: false,
    ...FACE_DEFAULT,
    gender: "girl", // 옛 아바타 몸은 여자아이 모양이었다 — 처음 가입 화면에서 고른다
    pet: "none",
  };
}

/** 얼굴 아무거나 (마이페이지 '아무거나' 버튼) — rand 는 0~1 */
export function randomFace(rand: () => number = Math.random): Pick<AvatarConfig, "eyes" | "brows" | "mouth" | "cheeks" | "sticker" | "eyeColor" | "nose"> {
  const one = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length) % xs.length];
  return { eyes: one(EYES), brows: one(BROWS), mouth: one(MOUTHS), cheeks: one(CHEEKS), sticker: one(STICKERS), eyeColor: one(EYE_COLORS), nose: one(NOSES) };
}

/** DB 값(옛 문서엔 없거나 일부만, 틀린 값)을 안전하게 — 맞는 칸만 받아 기본값 위에 덮는다 */
export function readAvatar(v: unknown, handle: string): AvatarConfig {
  const base = defaultAvatar(handle);
  if (!v || typeof v !== "object") return base;
  const out: AvatarConfig = { ...base };
  const src = v as Record<string, unknown>;
  for (const k of Object.keys(avatarSchema.shape) as Array<keyof AvatarConfig>) {
    const r = avatarSchema.shape[k].safeParse(src[k]);
    if (r.success) (out as Record<string, unknown>)[k] = r.data;
  }
  return out;
}

/**
 * 예시 모습 9 — 처음 가입·마이페이지 꾸미기의 '추천' 탭에서 하나 고르고 고쳐 쓴다 (동물은 그대로 둔다)
 * 11-13 사용자: "굳이 자기 얼굴 안 넣고 저렇게 여러 개 예제를 줘서 하는 방식도 나쁘지 않을 것 같아서"
 * 처음 다섯은 점토 시험 그림(docs/design/concepts/characters/lineup.png)의 다섯 친구.
 */
export const PRESETS: Array<{ id: string; name: string; look: Omit<AvatarConfig, "pet"> }> = [
  { id: "reader", name: "책벌레 똥머리", look: { gender: "girl", hair: "bun", hairColor: "choco", skin: "light", outfit: "coral", glasses: false, eyes: "round", brows: "soft", mouth: "smile", cheeks: "blush", sticker: "none", eyeColor: "ink", nose: "dot" } },
  { id: "glasses", name: "동그란 안경", look: { gender: "boy", hair: "bowl", hairColor: "brown", skin: "light", outfit: "mint", glasses: true, eyes: "dot", brows: "none", mouth: "smile", cheeks: "blush", sticker: "none", eyeColor: "brown", nose: "round" } },
  { id: "pigtails", name: "양갈래 하늘", look: { gender: "girl", hair: "pigtails", hairColor: "black", skin: "light", outfit: "sky", glasses: false, eyes: "lash", brows: "soft", mouth: "smile", cheeks: "blush", sticker: "none", eyeColor: "ink", nose: "dot" } },
  { id: "spiky", name: "삐죽 개구쟁이", look: { gender: "boy", hair: "spiky", hairColor: "caramel", skin: "tan", outfit: "butter", glasses: false, eyes: "round", brows: "straight", mouth: "open", cheeks: "blush", sticker: "none", eyeColor: "honey", nose: "round" } },
  { id: "bob", name: "단발 살구", look: { gender: "girl", hair: "bob", hairColor: "brown", skin: "light", outfit: "apricot", glasses: false, eyes: "sparkle", brows: "soft", mouth: "smile", cheeks: "both", sticker: "none", eyeColor: "brown", nose: "dot" } },
  { id: "beanie", name: "털모자 민트", look: { gender: "girl", hair: "beanie", hairColor: "caramel", skin: "tan", outfit: "mint", glasses: false, eyes: "round", brows: "none", mouth: "cat", cheeks: "freckles", sticker: "star", eyeColor: "leaf", nose: "line" } },
  { id: "side", name: "가르마 하늘", look: { gender: "boy", hair: "side", hairColor: "choco", skin: "deep", outfit: "sky", glasses: false, eyes: "round", brows: "bold", mouth: "smile", cheeks: "blush", sticker: "none", eyeColor: "ink", nose: "round" } },
  { id: "sleepy", name: "졸린 코랄", look: { gender: "boy", hair: "short", hairColor: "black", skin: "tan", outfit: "coral", glasses: false, eyes: "sleepy", brows: "soft", mouth: "line", cheeks: "blush", sticker: "mole", eyeColor: "gray", nose: "line" } },
  { id: "star", name: "반짝 별", look: { gender: "girl", hair: "short", hairColor: "brown", skin: "deep", outfit: "butter", glasses: false, eyes: "sparkle", brows: "soft", mouth: "open", cheeks: "blush", sticker: "heart", eyeColor: "sea", nose: "dot" } },
];
