// 내 사진으로 아바타 — 폰 안에서만. 얼굴을 동그라미 안내선에 맞춘 정사각 사진(픽셀)에서 색을 읽어 가장 가까운 선택지를 고른다.
// 11-13 사용자와 정함: "폰 안에서만 처리" — AI 로 보내지 않는다, 사진은 저장하지 않는다, 성별은 사진으로 짐작하지 않는다(고른 것 그대로).
// 안내: "이마부터 턱까지 동그라미에 맞춰 주세요" — 그래야 정수리는 동그라미 위, 볼은 안쪽 아래, 긴 머리는 턱 옆에 온다.
// 읽는 것: 피부(양 볼) · 머리 색(정수리·관자놀이, 피부·배경 같은 곳은 뺌) · 머리 길이(턱 옆에도 머리가 있나) · 앞머리(이마가 머리 색인가).
// 못 읽는 것(눈·눈썹·입·안경)은 사람이 고른다.
// 순수 함수 — 화면(캔버스)과 시험이 함께 쓴다.

import type { AvatarConfig, Gender, HairColor, HairStyle, Skin } from "./config";

/** 안내선 — 정사각 사진 한 변을 1 로 본 얼굴 동그라미 (가운데 조금 아래, 세로로 긴 타원) */
export const GUIDE = { cx: 0.5, cy: 0.53, rx: 0.27, ry: 0.36 };

export type Pixels = { data: Uint8ClampedArray | Uint8Array; width: number; height: number };
type RGB = [number, number, number];

export type PhotoRead = {
  face: boolean; // 양 볼이 피부처럼 보이고 서로 비슷한가 (아니면 얼굴을 동그라미에 안 맞춘 것 — 화면이 한 번 묻는다)
  skin: Skin;
  hairColor: HairColor | null; // 머리가 안 보이면(모자·배경) null
  long: boolean; // 턱 옆까지 머리
  bangs: boolean; // 이마를 덮는 앞머리
  sure: boolean; // 머리를 제대로 읽었나 (아니면 피부만 바꾼다)
};

const lum = ([r, g, b]: RGB) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const dist = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 255;

/** 그 자리 둘레 사각형의 '가운데 값' 색 (빛·그림자에 덜 흔들리게) */
function patch(px: Pixels, fx: number, fy: number, fr: number): RGB | null {
  const { width: W, height: H, data } = px;
  const x0 = Math.max(0, Math.round((fx - fr) * W));
  const x1 = Math.min(W - 1, Math.round((fx + fr) * W));
  const y0 = Math.max(0, Math.round((fy - fr) * H));
  const y1 = Math.min(H - 1, Math.round((fy + fr) * H));
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 128) continue;
      rs.push(data[i]);
      gs.push(data[i + 1]);
      bs.push(data[i + 2]);
    }
  }
  if (rs.length < 4) return null;
  const mid = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  return [mid(rs), mid(gs), mid(bs)];
}

export function hairColorOf(c: RGB): HairColor {
  const L = lum(c);
  if (L < 0.17) return "black"; // 폰 사진의 검은 머리는 빛을 받아 조금 밝게 나온다
  if (L < 0.27) return "choco";
  if (L < 0.42) return "brown";
  return "caramel";
}

export function skinOf(c: RGB): Skin {
  const L = lum(c);
  if (L > 0.6) return "light";
  if (L > 0.42) return "tan";
  return "deep";
}

export function readPhoto(px: Pixels): PhotoRead {
  const g = GUIDE;
  // 피부 — 양 볼 (동그라미 가로 가운데에서 조금 바깥·조금 아래)
  const cheeks = [patch(px, g.cx - g.rx * 0.5, g.cy + g.ry * 0.18, 0.035), patch(px, g.cx + g.rx * 0.5, g.cy + g.ry * 0.18, 0.035)].filter((c): c is RGB => !!c);
  const skinRGB: RGB = cheeks.length ? [0, 1, 2].map((k) => cheeks.reduce((t, c) => t + c[k], 0) / cheeks.length) as RGB : [220, 190, 170];
  const skin = skinOf(skinRGB);
  // 피부다운 색 = 빨강 ≥ 초록 ≥ 파랑 쪽으로 따뜻하고, 회색(벽·하늘)이 아니다. 두 볼이 비슷해야 얼굴이 가운데에 온 것
  const warm = (c: RGB) => c[0] >= c[1] && c[1] >= c[2] - 6 && (c[0] - c[2]) / Math.max(c[0], 1) > 0.1;
  const face = cheeks.length === 2 && cheeks.every(warm) && dist(cheeks[0], cheeks[1]) < 0.15;

  // 배경 — 위쪽 두 귀퉁이 (얼굴을 동그라미에 맞추면 대개 벽·하늘)
  const corners = [patch(px, 0.06, 0.06, 0.04), patch(px, 0.94, 0.06, 0.04)].filter((c): c is RGB => !!c);
  const isBg = (c: RGB) => corners.some((k) => dist(c, k) < 0.1);
  const isSkin = (c: RGB) => dist(c, skinRGB) < 0.14;

  // 머리 — 동그라미 위(정수리)와 양쪽 관자놀이. 피부·배경 같은 곳은 빼고 가장 어두운 곳 (빛 받은 머리는 밝게 나온다)
  const tops = [patch(px, g.cx, g.cy - g.ry - 0.05, 0.03), patch(px, g.cx - g.rx * 0.8, g.cy - g.ry * 0.8, 0.03), patch(px, g.cx + g.rx * 0.8, g.cy - g.ry * 0.8, 0.03)];
  const hairy = tops.filter((c): c is RGB => !!c && !isSkin(c) && !isBg(c));
  // 머리를 못 찾으면(민머리·모자·잘린 사진) 피부만 바꾼다
  if (!hairy.length) return { face, skin, hairColor: null, long: false, bangs: false, sure: false };
  const hairRGB = hairy.sort((a, b) => lum(a) - lum(b))[0];

  const isHair = (c: RGB | null) => !!c && dist(c, hairRGB) < 0.2 && !isSkin(c) && !isBg(c);
  // 길이 — 턱 높이에서 동그라미 바로 바깥 (양쪽 중 하나라도 머리면 긴 머리)
  const sides = [patch(px, g.cx - g.rx - 0.04, g.cy + g.ry * 0.45, 0.03), patch(px, g.cx + g.rx + 0.04, g.cy + g.ry * 0.45, 0.03)];
  const long = sides.some(isHair);
  // 앞머리 — 이마 (동그라미 위에서 1/5 지점)
  const bangs = isHair(patch(px, g.cx, g.cy - g.ry * 0.6, 0.03));
  return { face, skin, hairColor: hairColorOf(hairRGB), long, bangs, sure: true };
}

const LONG_GIRL: HairStyle[] = ["bob", "pigtails", "bun"];

/** 읽은 것 → 아바타 고치기 (성별은 지금 고른 것 그대로, 안경·눈·입은 건드리지 않는다) */
export function photoPatch(r: PhotoRead, now: Pick<AvatarConfig, "hair" | "gender">): Partial<AvatarConfig> {
  const out: Partial<AvatarConfig> = { skin: r.skin };
  if (!r.sure || !r.hairColor) return out;
  out.hairColor = r.hairColor;
  const g: Gender = now.gender;
  if (r.long) {
    // 긴 머리 — 지금 긴 머리 모양이면 그대로 (양갈래·똥머리일 수도), 아니면 단발
    out.hair = LONG_GIRL.includes(now.hair) ? now.hair : "bob";
  } else if (g === "boy") {
    out.hair = r.bangs ? "bowl" : now.hair === "spiky" || now.hair === "side" ? now.hair : "short";
  } else {
    out.hair = "short";
  }
  return out;
}

// ── 사진 맞추기 (틀 = 정사각, 한 변 frame px) ──
/** 사진 자리 — 사진 왼쪽 위가 틀의 (x, y), 크기는 (사진 너비·높이 × scale) */
export type PhotoView = { scale: number; x: number; y: number };

/** 처음 — 틀을 꽉 채우고 가운데 */
export function fitView(w: number, h: number, frame: number): PhotoView {
  const scale = Math.max(frame / w, frame / h);
  return { scale, x: (frame - w * scale) / 2, y: (frame - h * scale) / 2 };
}

/** 틀 안에 빈 곳이 안 생기게 (크기는 꽉 채움 ~ 그 4배) */
export function clampView(v: PhotoView, w: number, h: number, frame: number): PhotoView {
  const min = Math.max(frame / w, frame / h);
  const scale = Math.min(min * 4, Math.max(min, v.scale));
  const x = Math.min(0, Math.max(frame - w * scale, v.x));
  const y = Math.min(0, Math.max(frame - h * scale, v.y));
  return { scale, x, y };
}

/** 틀의 (px, py) 를 그 자리에 둔 채 크게·작게 */
export function zoomAt(v: PhotoView, factor: number, px: number, py: number, w: number, h: number, frame: number): PhotoView {
  const min = Math.max(frame / w, frame / h);
  const scale = Math.min(min * 4, Math.max(min, v.scale * factor));
  const k = scale / v.scale;
  return clampView({ scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k }, w, h, frame);
}

/** 읽은 것을 한 줄로 (화면 알림용) */
export function photoSummary(
  r: PhotoRead,
  patch: Partial<AvatarConfig>,
  labels: { skin: Record<Skin, string>; hairColor: Record<HairColor, string>; hair: Record<HairStyle, string> },
): string {
  const bits = [`${labels.skin[r.skin]} 피부`];
  if (patch.hairColor) bits.push(`${labels.hairColor[patch.hairColor]} 머리`);
  if (patch.hair) bits.push(labels.hair[patch.hair]);
  return bits.join(" · ");
}
