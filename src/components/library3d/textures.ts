// 입체 도서관 무늬 — 벽 모눈종이·나무 바닥·러그·아바타 얼굴·별·반짝이·책등 대신 그림. 전부 캔버스로 그린다 (그림 파일 없음).
// 색은 globals.css 팔레트 그대로. 하지 말 것: 매끈한 그라디언트, 광택, 보라.

import * as THREE from "three";
import { FACE_DEFAULT, type AvatarConfig } from "@/lib/avatar/config";

export const PAL = {
  paper: "#f7f1e3",
  grid: "#e8dbc2",
  ink: "#5a4535",
  inkDeep: "#3d2c22",
  inkSoft: "#8c7762",
  wood: "#dcac78",
  woodDark: "#b98552",
  woodLight: "#ecc596",
  back: "#efdcb8",
  cream: "#fbf4e6",
  page: "#f6efdd",
  floor: "#ecd4ad",
  apricot: "#f0a35e",
  mint: "#8fcdb6",
  butter: "#f6d77c",
  coral: "#ef8f7c",
  sky: "#8cc3dc",
  blush: "#f19a86",
  pants: "#9b7a5c",
  shoe: "#6b5140",
};

export const PASTELS = [PAL.apricot, PAL.mint, PAL.butter, PAL.coral, PAL.sky];

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas 2d 없음");
  return [c, ctx];
}

function tex(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** 만화 명암 3단 (MeshToonMaterial) */
export function toonGradient(): THREE.DataTexture {
  const data = new Uint8Array([150, 215, 255]);
  const t = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/** 벽 — 앱 바탕과 같은 모눈종이. cell = 한 칸 cm */
export function gridTexture(wCm: number, hCm: number, cell = 4): THREE.CanvasTexture {
  const [c, x] = canvas(64, 64);
  x.fillStyle = PAL.paper;
  x.fillRect(0, 0, 64, 64);
  x.fillStyle = PAL.grid;
  x.fillRect(0, 0, 64, 2);
  x.fillRect(0, 0, 2, 64);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(wCm / cell, hCm / cell);
  return t;
}

/** 바닥 색 — 집마다 (house3d) */
export const FLOORS = {
  honey: { base: PAL.floor, line: "#d9bb8f", grain: "rgba(185, 133, 82, 0.18)" }, // 모눈 방
  amber: { base: "#dfb07a", line: "#bb8957", grain: "rgba(140, 95, 55, 0.2)" }, // 다락방
  birch: { base: "#f3e3c4", line: "#e2caa2", grain: "rgba(190, 150, 100, 0.14)" }, // 창가 원룸
  walnut: { base: "#b08559", line: "#8a6040", grain: "rgba(70, 45, 25, 0.2)" }, // 숲속 오두막
} as const;
export type FloorTone = keyof typeof FLOORS;

/** 나무 바닥 — 긴 널빤지 */
export function floorTexture(wCm: number, dCm: number, tone: FloorTone = "honey"): THREE.CanvasTexture {
  const F = FLOORS[tone];
  const [c, x] = canvas(256, 256);
  x.fillStyle = F.base;
  x.fillRect(0, 0, 256, 256);
  x.strokeStyle = F.line;
  x.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    x.beginPath();
    x.moveTo(0, i * 64 + 1);
    x.lineTo(256, i * 64 + 1);
    x.stroke();
  }
  // 널빤지 이음매 (줄마다 어긋나게)
  for (let i = 0; i < 4; i++) {
    const off = (i * 97) % 256;
    x.beginPath();
    x.moveTo(off, i * 64);
    x.lineTo(off, i * 64 + 64);
    x.stroke();
  }
  // 나뭇결 몇 줄
  x.strokeStyle = F.grain;
  x.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const y = 10 + i * 21;
    x.beginPath();
    x.moveTo(8 + ((i * 53) % 90), y);
    x.bezierCurveTo(70, y - 4, 140, y + 4, 200 + ((i * 31) % 50), y);
    x.stroke();
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(wCm / 90, dCm / 90);
  return t;
}

/** 동그란 러그 — 버터색, 갈색 바느질 점선 (다꾸) */
export function rugTexture(fill: string = PAL.butter): THREE.CanvasTexture {
  const [c, x] = canvas(512, 512);
  x.fillStyle = fill;
  x.beginPath();
  x.arc(256, 256, 250, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = PAL.ink;
  x.lineWidth = 6;
  x.stroke();
  x.setLineDash([18, 14]);
  x.lineWidth = 5;
  x.beginPath();
  x.arc(256, 256, 214, 0, Math.PI * 2);
  x.stroke();
  x.setLineDash([]);
  x.fillStyle = "rgba(255, 255, 255, 0.35)";
  x.beginPath();
  x.arc(256, 256, 150, 0, Math.PI * 2);
  x.fill();
  return tex(c);
}

export type Expr = "normal" | "blink" | "happy" | "read" | "wow";
export type FaceLook = Pick<AvatarConfig, "eyes" | "brows" | "mouth" | "cheeks" | "sticker">;

/** 다꾸 스티커 모양 (얼굴 스티커) — 흰 테두리 + 갈색 펜 */
function stickerShape(x: CanvasRenderingContext2D, kind: "star" | "heart", cx: number, cy: number, r: number, fill: string) {
  x.beginPath();
  if (kind === "star") {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.48 : r;
      x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    x.closePath();
  } else {
    x.moveTo(cx, cy + r * 0.85);
    x.bezierCurveTo(cx - r * 1.35, cy - r * 0.1, cx - r * 0.55, cy - r * 1.05, cx, cy - r * 0.35);
    x.bezierCurveTo(cx + r * 0.55, cy - r * 1.05, cx + r * 1.35, cy - r * 0.1, cx, cy + r * 0.85);
    x.closePath();
  }
  x.lineJoin = "round";
  x.lineWidth = 7;
  x.strokeStyle = "#ffffff";
  x.stroke();
  x.fillStyle = fill;
  x.fill();
  x.lineWidth = 2.6;
  x.strokeStyle = PAL.ink;
  x.stroke();
}

/**
 * 얼굴 그림 — 11-13 다시 그림 (사용자: "캐릭터들이 독창성이 없다") — 점토 시험 그림(docs/design/concepts/characters/lineup.png)처럼
 * 크고 반짝이는 눈 · 넓은 눈 사이 · 볼 아래 번지는 볼터치 · 작은 코 · 작은 입. 앞머리를 올려 눈썹이 보인다.
 * 그림 칸 256(가로 1.84rad · 세로 1.44rad, 머리 반지름 9.68) — 가로 1px ≈ 0.070cm, 세로 1px ≈ 0.054cm 라
 * 구에 붙었을 때 둥글게 보이려면 세로로 VY 배 늘려 그린다. 캔버스는 512 로 두 배 선명하게.
 */
export const FACE_EYE = { x: 54, y: 150 } as const; // 눈 가운데 (가운데에서 옆으로 x, 위에서 y) — 안경이 이 자리에 맞춘다
const VY = 1.28;

export function faceTexture(expr: Expr, look: FaceLook = FACE_DEFAULT): THREE.CanvasTexture {
  const [c, x] = canvas(512, 512);
  x.scale(2, 2);
  drawFace(x, expr, look);
  return tex(c);
}

export type FacePart = "eyes" | "brows" | "mouth" | "cheeks";

/**
 * 꾸미기 그림 칸 — 얼굴 그림의 한 부분(눈·눈썹·입·볼)을 피부색 위에 잘라 낸 그림 (data URL).
 * 구에 붙이려고 세로로 늘려 그린 것을 되돌려 납작하게 보여 준다.
 */
export function faceThumb(look: FaceLook, part: FacePart, skin: string, width = 168): string {
  const [c, x] = canvas(512, 512);
  x.scale(2, 2);
  x.fillStyle = skin;
  x.fillRect(0, 0, 256, 256);
  drawFace(x, "normal", look);
  const ex = FACE_EYE.x;
  const ey = FACE_EYE.y;
  const box: Record<FacePart, [number, number, number, number]> = {
    eyes: [128 - ex - 30, ey - 40, (ex + 30) * 2, 74],
    brows: [128 - ex - 30, ey - 62, (ex + 30) * 2, 92],
    mouth: [128 - 34, ey + 14, 68, 46],
    cheeks: [128 - ex - 40, ey - 22, (ex + 40) * 2, 86],
  };
  const [sx, sy, sw, sh] = box[part];
  const h = Math.round((width * (sh / VY)) / sw);
  const [o, ox] = canvas(width, h);
  ox.drawImage(c, sx * 2, sy * 2, sw * 2, sh * 2, 0, 0, width, h);
  return o.toDataURL("image/png");
}

/** 얼굴 그리기 (256 좌표) — 입체 얼굴(faceTexture)과 꾸미기 그림 칸(faceThumb)이 함께 쓴다 */
function drawFace(x: CanvasRenderingContext2D, expr: Expr, look: FaceLook) {
  const ink = PAL.inkDeep;
  const ey = FACE_EYE.y;
  const ex = FACE_EYE.x;
  x.lineCap = "round";
  x.lineJoin = "round";
  const oval = (cx: number, cy: number, r: number, k = 1) => {
    x.beginPath();
    x.ellipse(cx, cy, r, r * VY * k, 0, 0, Math.PI * 2);
  };

  // 볼터치 — 눈 아래 바깥쪽, 가운데가 진하고 가장자리로 번진다
  if (look.cheeks === "blush" || look.cheeks === "both") {
    for (const s of [-1, 1]) {
      x.save();
      x.translate(128 + s * (ex + 10), ey + 31);
      x.scale(1, 0.82);
      const g = x.createRadialGradient(0, 0, 1, 0, 0, 25);
      g.addColorStop(0, "rgba(240, 124, 100, 0.66)");
      g.addColorStop(0.55, "rgba(240, 124, 100, 0.4)");
      g.addColorStop(1, "rgba(240, 124, 100, 0)");
      x.fillStyle = g;
      x.beginPath();
      x.arc(0, 0, 25, 0, Math.PI * 2);
      x.fill();
      x.restore();
    }
  }
  if (look.cheeks === "freckles" || look.cheeks === "both") {
    x.fillStyle = "rgba(150, 96, 64, 0.8)";
    for (const s of [-1, 1]) {
      for (const [dx, dy] of [
        [-9, -4],
        [2, -8],
        [-2, 5],
        [10, 1],
      ]) {
        oval(128 + s * (ex + 10 + dx), ey + 29 + dy, 2.2);
        x.fill();
      }
    }
  }

  // 작은 코
  x.fillStyle = "rgba(205, 118, 90, 0.45)";
  oval(128, ey + 17, 4.4, 0.8);
  x.fill();

  // 눈썹 — 웃거나 놀라면 살짝 올라간다 (안쪽이 낮게, 좌우 거울처럼)
  const by = ey - 43 - (expr === "happy" || expr === "wow" ? 4 : 0);
  x.strokeStyle = ink;
  x.fillStyle = ink;
  for (const s of [-1, 1]) {
    const cx = 128 + s * ex;
    if (look.brows === "soft") {
      x.lineWidth = 4;
      x.beginPath();
      x.arc(cx, by + 10, 12, 1.24 * Math.PI, 1.76 * Math.PI);
      x.stroke();
    } else if (look.brows === "straight") {
      x.lineWidth = 4.2;
      x.beginPath();
      x.moveTo(cx - s * 10, by + 2);
      x.lineTo(cx + s * 10, by - 1);
      x.stroke();
    } else if (look.brows === "bold") {
      x.lineWidth = 7.5;
      x.beginPath();
      x.moveTo(cx - s * 10, by + 2);
      x.lineTo(cx + s * 9, by - 1);
      x.stroke();
    }
  }

  // 눈 — 크고 까만 눈 + 위 왼쪽 큰 빛 · 아래 오른쪽 작은 빛 (반짝은 별빛 하나 더)
  const R = look.eyes === "dot" ? 12.5 : look.eyes === "sparkle" ? 19.5 : 18;
  for (const s of [-1, 1]) {
    const cx = 128 + s * ex;
    x.fillStyle = ink;
    x.strokeStyle = ink;
    const lashes = (cy: number, r: number) => {
      if (look.eyes !== "lash") return;
      x.lineWidth = 3.2;
      for (const k of [0, 1, 2]) {
        const a = -Math.PI / 2 + s * (0.62 + k * 0.34);
        const sx = cx + Math.cos(a) * r;
        const sy = cy + Math.sin(a) * r * VY;
        x.beginPath();
        x.moveTo(sx, sy);
        x.lineTo(sx + Math.cos(a) * 7, sy + Math.sin(a) * 7 * VY);
        x.stroke();
      }
    };
    if (expr === "blink") {
      x.lineWidth = 6;
      x.beginPath();
      x.ellipse(cx, ey - 4, R * 0.95, R * 0.7, 0, 0.12 * Math.PI, 0.88 * Math.PI);
      x.stroke();
      lashes(ey + 4, R * 0.9);
    } else if (expr === "happy") {
      x.lineWidth = 6.5;
      x.beginPath();
      x.ellipse(cx, ey + 9, R * 0.95, R * 0.95, 0, 1.13 * Math.PI, 1.87 * Math.PI);
      x.stroke();
      lashes(ey - 3, R * 0.85);
    } else if (expr === "read" || look.eyes === "sleepy") {
      // 아래를 보는 눈(졸린 눈) — 눈동자 아래 반쪽 + 윗꺼풀 선
      const r = R * 0.95;
      x.beginPath();
      x.ellipse(cx, ey + 2, r, r * VY, 0, 0, Math.PI);
      x.closePath();
      x.fill();
      x.lineWidth = 5.5;
      x.beginPath();
      x.moveTo(cx - r - 2, ey + 2);
      x.lineTo(cx + r + 2, ey + 2);
      x.stroke();
      x.fillStyle = "#ffffff";
      oval(cx - r * 0.32, ey + r * 0.42 * VY, r * 0.2);
      x.fill();
      x.fillStyle = ink;
      lashes(ey + 2, r);
    } else {
      const r = R * (expr === "wow" ? 1.12 : 1);
      oval(cx, ey, r, 1.04);
      x.fill();
      x.fillStyle = "#ffffff";
      oval(cx - r * 0.36, ey - r * 0.42 * VY, r * (look.eyes === "dot" ? 0.3 : 0.34));
      x.fill();
      oval(cx + r * 0.34, ey + r * 0.4 * VY, r * 0.15);
      x.fill();
      if (look.eyes === "sparkle") {
        // 작은 별빛 (네 갈래)
        const sx = cx + r * 0.3;
        const sy = ey - r * 0.36 * VY;
        x.beginPath();
        x.moveTo(sx, sy - 5.5);
        x.quadraticCurveTo(sx, sy, sx + 4, sy);
        x.quadraticCurveTo(sx, sy, sx, sy + 5.5);
        x.quadraticCurveTo(sx, sy, sx - 4, sy);
        x.quadraticCurveTo(sx, sy, sx, sy - 5.5);
        x.fill();
      }
      x.fillStyle = ink;
      lashes(ey, r);
    }
  }

  // 입 — 웃으면 활짝, 놀라면 동그랗게, 그 밖엔 고른 입 (작게)
  x.strokeStyle = ink;
  x.fillStyle = ink;
  const my = ey + 37;
  if (expr === "wow") {
    oval(128, my + 2, 5.2);
    x.fill();
  } else if (expr === "happy" || look.mouth === "open") {
    x.beginPath();
    x.moveTo(118.5, my - 3);
    x.quadraticCurveTo(128, my + 15, 137.5, my - 3);
    x.closePath();
    x.fillStyle = "#b9584c";
    x.fill();
    x.fillStyle = "#f2a59b";
    x.beginPath();
    x.ellipse(128, my + 4.5, 4.2, 3.2, 0, 0, Math.PI * 2);
    x.fill();
    x.lineWidth = 3.8;
    x.beginPath();
    x.moveTo(118.5, my - 3);
    x.quadraticCurveTo(128, my + 15, 137.5, my - 3);
    x.closePath();
    x.stroke();
    x.fillStyle = ink;
  } else if (look.mouth === "cat") {
    x.lineWidth = 3.8;
    for (const mx of [123, 133]) {
      x.beginPath();
      x.arc(mx, my - 2, 5, 0.08 * Math.PI, 0.92 * Math.PI);
      x.stroke();
    }
  } else if (look.mouth === "line") {
    x.lineWidth = 3.8;
    x.beginPath();
    x.moveTo(122, my + 1);
    x.quadraticCurveTo(128, my - 1.5, 134, my + 1);
    x.stroke();
  } else {
    x.lineWidth = 4.2;
    x.beginPath();
    x.arc(128, my - 7, 8.5, 0.24 * Math.PI, 0.76 * Math.PI);
    x.stroke();
  }

  // 얼굴 스티커 (다꾸) — 오른쪽 볼
  if (look.sticker === "mole") {
    x.fillStyle = ink;
    oval(128 + ex + 2, ey + 25, 2.5);
    x.fill();
  } else if (look.sticker === "star") stickerShape(x, "star", 128 + ex + 25, ey + 9, 10, PAL.butter);
  else if (look.sticker === "heart") stickerShape(x, "heart", 128 + ex + 25, ey + 11, 9, PAL.coral);
}

/**
 * 옷 무늬 (옷 가게, 11-13) — 가로 줄무늬 · 땡땡이 · 니트 골. 몸통·소매(회전체)의 uv 는 u = 둘레, v = 아래→위.
 * 반복은 쓰는 곳에서 (repeat). 색은 무늬 그대로라 재질 색은 흰색으로 둔다.
 */
export function clothTexture(kind: "stripes" | "dots" | "knit", base: string, mark: string, repeat: [number, number]): THREE.CanvasTexture {
  const [c, x] = canvas(64, 64);
  x.fillStyle = base;
  x.fillRect(0, 0, 64, 64);
  x.fillStyle = mark;
  if (kind === "stripes") {
    x.fillRect(0, 0, 64, 32);
  } else if (kind === "dots") {
    for (const [cx, cy] of [
      [16, 16],
      [48, 48],
    ]) {
      x.beginPath();
      x.arc(cx, cy, 6.5, 0, Math.PI * 2);
      x.fill();
    }
  } else {
    x.globalAlpha = 0.32;
    for (let i = 2; i < 64; i += 8) x.fillRect(i, 0, 3, 64);
    x.globalAlpha = 1;
  }
  const t = tex(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  return t;
}

/** 별 스티커 (다 읽은 책·축하) — 버터색 별 + 갈색 테두리 + 흰 테두리 */
export function starTexture(fill = PAL.butter): THREE.CanvasTexture {
  const [c, x] = canvas(128, 128);
  const star = (r: number) => {
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.48 : r;
      x.lineTo(64 + Math.cos(a) * rr, 66 + Math.sin(a) * rr);
    }
    x.closePath();
  };
  x.lineJoin = "round";
  star(52);
  x.lineWidth = 16;
  x.strokeStyle = "#ffffff";
  x.stroke();
  x.fillStyle = fill;
  x.fill();
  x.lineWidth = 6;
  x.strokeStyle = PAL.ink;
  x.stroke();
  return tex(c);
}

/** 반짝이 (친구와 같은 책·통로) — 네 갈래 */
export function sparkleTexture(fill = PAL.mint): THREE.CanvasTexture {
  const [c, x] = canvas(128, 128);
  x.beginPath();
  x.moveTo(64, 6);
  x.quadraticCurveTo(70, 58, 122, 64);
  x.quadraticCurveTo(70, 70, 64, 122);
  x.quadraticCurveTo(58, 70, 6, 64);
  x.quadraticCurveTo(58, 58, 64, 6);
  x.closePath();
  x.lineJoin = "round";
  x.lineWidth = 14;
  x.strokeStyle = "#ffffff";
  x.stroke();
  x.fillStyle = fill;
  x.fill();
  x.lineWidth = 5;
  x.strokeStyle = PAL.ink;
  x.stroke();
  return tex(c);
}

/** 책 위·아래·앞마구리 — 종이 결 */
export function pagesTexture(): THREE.CanvasTexture {
  const [c, x] = canvas(64, 64);
  x.fillStyle = PAL.page;
  x.fillRect(0, 0, 64, 64);
  x.strokeStyle = "rgba(140, 119, 98, 0.22)";
  x.lineWidth = 1;
  for (let i = 3; i < 64; i += 5) {
    x.beginPath();
    x.moveTo(0, i);
    x.lineTo(64, i);
    x.stroke();
  }
  return tex(c);
}

/** 책등 그림이 없는 책 — 파스텔 바탕에 세로 제목 (2D 책장과 같은 모양) */
export function fakeSpineTexture(title: string, color: string, font: string): THREE.CanvasTexture {
  const W = 64;
  const H = 420;
  const [c, x] = canvas(W, H);
  x.fillStyle = color;
  x.fillRect(0, 0, W, H);
  x.strokeStyle = PAL.ink;
  x.lineWidth = 3;
  x.strokeRect(1.5, 1.5, W - 3, H - 3);
  x.fillStyle = PAL.ink;
  x.textAlign = "center";
  x.textBaseline = "middle";
  const size = 34;
  x.font = `700 ${size}px ${font}`;
  const chars = [...title.replace(/\s+/g, " ")].slice(0, Math.floor((H - 30) / (size * 0.98)));
  const top = (H - chars.length * size * 0.98) / 2 + size / 2;
  chars.forEach((ch, i) => x.fillText(ch, W / 2, top + i * size * 0.98));
  return tex(c);
}

/** 표지 그림이 없는 책 — 가운데 제목 */
export function fakeCoverTexture(title: string, color: string, font: string): THREE.CanvasTexture {
  const [c, x] = canvas(256, 372);
  x.fillStyle = color;
  x.fillRect(0, 0, 256, 372);
  x.strokeStyle = "#ffffff";
  x.lineWidth = 14;
  x.strokeRect(7, 7, 242, 358);
  x.fillStyle = PAL.ink;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.font = `700 40px ${font}`;
  // 두세 줄로 접기
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (x.measureText(next).width > 200 && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, 4);
  shown.forEach((l, i) => x.fillText(l, 128, 186 + (i - (shown.length - 1) / 2) * 46, 220));
  return tex(c);
}

/** '+' 빈 자리 — 점선 테두리 */
export function addSlotTexture(): THREE.CanvasTexture {
  const [c, x] = canvas(64, 256);
  x.fillStyle = "rgba(251, 244, 230, 0.9)";
  x.fillRect(0, 0, 64, 256);
  x.setLineDash([12, 9]);
  x.strokeStyle = PAL.inkSoft;
  x.lineWidth = 5;
  x.strokeRect(4, 4, 56, 248);
  x.setLineDash([]);
  x.lineCap = "round";
  x.lineWidth = 6;
  x.beginPath();
  x.moveTo(32, 112);
  x.lineTo(32, 144);
  x.moveTo(16, 128);
  x.lineTo(48, 128);
  x.stroke();
  return tex(c);
}

// ── YES24 표지·책등 — 응답 URL 그대로 (그림 서버가 CORS * 를 준다, 11-12 확인) ──
const loader = new THREE.TextureLoader();
loader.setCrossOrigin("anonymous");
const cache = new Map<string, Promise<THREE.Texture>>();

export function loadTexture(url: string): Promise<THREE.Texture> {
  let p = cache.get(url);
  if (!p) {
    p = loader.loadAsync(url).then((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    });
    p.catch(() => cache.delete(url)); // 실패하면 다음에 다시
    cache.set(url, p);
  }
  return p;
}

/** 펼친 책 한 쪽 — 크림색 종이에 글줄 (가끔 짧은 줄 = 문단 끝) */
export function openPageTexture(): THREE.CanvasTexture {
  const [c, x] = canvas(128, 176);
  x.fillStyle = "#fbf6ea";
  x.fillRect(0, 0, 128, 176);
  x.fillStyle = "#cdbb9c";
  for (let i = 0; i < 15; i++) {
    const y = 16 + i * 10;
    const short = i % 5 === 4;
    x.fillRect(14, y, short ? 52 : 100, 3);
  }
  return tex(c);
}

/** 집마다 벽 무늬 — 다락방 판자벽 · 창가 원룸 민트 물방울 · 숲속 오두막 통나무 (house3d) */
export function wallTexture(kind: "attic" | "sunny" | "cabin", wCm: number, hCm: number): THREE.CanvasTexture {
  const [c, x] = canvas(64, 64);
  let cellW = 14;
  let cellH = 14;
  if (kind === "attic") {
    x.fillStyle = "#f2dfba";
    x.fillRect(0, 0, 64, 64);
    x.fillStyle = "#dcc092";
    x.fillRect(0, 0, 3, 64);
    x.fillStyle = "rgba(185, 133, 82, 0.13)";
    x.fillRect(22, 0, 2, 64);
    x.fillRect(45, 0, 1, 64);
  } else if (kind === "sunny") {
    x.fillStyle = "#e5f2ec";
    x.fillRect(0, 0, 64, 64);
    x.fillStyle = "#cde6da";
    for (const [px, py] of [
      [16, 16],
      [48, 48],
    ]) {
      x.beginPath();
      x.arc(px, py, 3.4, 0, Math.PI * 2);
      x.fill();
    }
    cellW = cellH = 11;
  } else {
    x.fillStyle = "#c39261";
    x.fillRect(0, 0, 64, 64);
    x.fillStyle = "#d8a874";
    x.fillRect(0, 5, 64, 9);
    x.fillStyle = "#8f6541";
    x.fillRect(0, 57, 64, 7);
    x.strokeStyle = "rgba(110, 72, 40, 0.28)";
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(4, 32);
    x.bezierCurveTo(20, 27, 40, 37, 60, 31);
    x.stroke();
    cellW = 64;
    cellH = 15;
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(wCm / cellW, hCm / cellH);
  return t;
}

/** 창밖 — 하늘(구름) · 숲 · 노을(별). 매끈한 그라디언트 대신 색 띠 */
export function windowViewTexture(kind: "sky" | "forest" | "dusk"): THREE.CanvasTexture {
  const [c, x] = canvas(128, 128);
  if (kind === "dusk") {
    const bands = ["#f9e6c6", "#f6d4aa", "#f2c193", "#eeae84"];
    bands.forEach((b, i) => {
      x.fillStyle = b;
      x.fillRect(0, i * 32, 128, 32);
    });
    x.fillStyle = PAL.butter;
    x.beginPath();
    x.arc(88, 40, 9, 0, Math.PI * 2);
    x.fill();
  } else if (kind === "forest") {
    x.fillStyle = "#d9eef2";
    x.fillRect(0, 0, 128, 128);
    x.fillStyle = "#b5dcae";
    x.beginPath();
    x.ellipse(40, 128, 70, 46, 0, 0, Math.PI * 2);
    x.ellipse(110, 128, 60, 36, 0, 0, Math.PI * 2);
    x.fill();
    const tree = (tx: number, ty: number, s: number, col: string) => {
      x.fillStyle = "#8a6040";
      x.fillRect(tx - 2 * s, ty, 4 * s, 10 * s);
      x.fillStyle = col;
      x.beginPath();
      x.moveTo(tx, ty - 26 * s);
      x.lineTo(tx + 12 * s, ty + 2 * s);
      x.lineTo(tx - 12 * s, ty + 2 * s);
      x.closePath();
      x.fill();
    };
    tree(26, 86, 1.1, "#6fae86");
    tree(58, 92, 0.9, "#82bf93");
    tree(96, 84, 1.2, "#5f9f78");
    tree(118, 96, 0.8, "#82bf93");
  } else {
    x.fillStyle = "#cfe7f2";
    x.fillRect(0, 0, 128, 128);
    x.fillStyle = "#ffffff";
    const cloud = (cx: number, cy: number, s: number) => {
      x.beginPath();
      x.arc(cx, cy, 9 * s, 0, Math.PI * 2);
      x.arc(cx + 11 * s, cy - 4 * s, 11 * s, 0, Math.PI * 2);
      x.arc(cx + 23 * s, cy, 8 * s, 0, Math.PI * 2);
      x.fill();
    };
    cloud(18, 40, 1.1);
    cloud(70, 82, 0.9);
  }
  return tex(c);
}
