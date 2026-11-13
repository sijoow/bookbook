// 스티커 모음 한 장(격자)을 한 장씩 잘라 앱용 webp 로.
//   node scripts/cut-stickers.mjs docs/design/assets/stickers-collection.png public/img/stickers 5 4 이름,이름,… [px]
// 칸으로 자르지 않고 '덩어리'로 — 불투명한(알파 > 128) 이어진 덩어리를 찾아, 무게 중심이 그 칸에 있는 가장 큰 덩어리를 쓴다.
// (GPT 가 스티커를 칸 밖으로 조금 넘게 그려도 옆 스티커 조각이 섞이지 않게. 11-12 칸 자르기에서 실제로 섞였다)
// 그 덩어리 밖 픽셀은 투명하게 지운다 — 스티커 둘레의 흐린 빛(반투명)도 같이 걷힌다.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const [src, outDir, colsS, rowsS, namesS, pxS] = process.argv.slice(2);
if (!src || !outDir || !namesS) throw new Error("사용법: cut-stickers.mjs 원본.png 출력폴더 열 줄 이름,이름,… [px]");
const cols = Number(colsS);
const rows = Number(rowsS);
const names = namesS.split(",");
const px = Number(pxS || 256);
const ALL = process.argv.includes("--all"); // 칸 안의 덩어리를 모두 (조각 그림 — 메뉴 아이콘처럼 발가락·여러 권·반짝이가 떨어져 있을 때)
fs.mkdirSync(outDir, { recursive: true });

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const solid = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) solid[i] = data[i * 4 + 3] > 128 ? 1 : 0;

// 이어진 덩어리 찾기 (4방향)
const label = new Int32Array(W * H).fill(-1);
const comps = [];
const stack = [];
for (let start = 0; start < W * H; start++) {
  if (!solid[start] || label[start] >= 0) continue;
  const id = comps.length;
  let n = 0;
  let sx = 0;
  let sy = 0;
  let minX = W;
  let minY = H;
  let maxX = 0;
  let maxY = 0;
  label[start] = id;
  stack.push(start);
  while (stack.length) {
    const p = stack.pop();
    const x = p % W;
    const y = (p - x) / W;
    n++;
    sx += x;
    sy += y;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    for (const q of [p - 1, p + 1, p - W, p + W]) {
      if (q < 0 || q >= W * H) continue;
      if ((q === p - 1 && x === 0) || (q === p + 1 && x === W - 1)) continue;
      if (solid[q] && label[q] < 0) {
        label[q] = id;
        stack.push(q);
      }
    }
  }
  comps.push({ id, n, cx: sx / n, cy: sy / n, minX, minY, maxX, maxY });
}

const cw = W / cols;
const ch = H / rows;
let k = 0;
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++, k++) {
    const name = names[k];
    if (!name || name === "-") continue;
    const inCell = comps.filter((m) => m.cx >= c * cw && m.cx < (c + 1) * cw && m.cy >= r * ch && m.cy < (r + 1) * ch);
    const big = inCell.sort((a, b) => b.n - a.n)[0];
    if (!big || big.n < 400) {
      console.log(`✖ ${name}: 덩어리를 못 찾음`);
      continue;
    }
    // 가장 큰 덩어리 둘레 70px 안의 것만 (옆 칸 그림의 반짝이가 무게중심으로 넘어와 끼는 걸 막는다) · 아주 작은 티는 버림
    const near = (m) => m.maxX >= big.minX - 70 && m.minX <= big.maxX + 70 && m.maxY >= big.minY - 70 && m.minY <= big.maxY + 70;
    const keepIds = new Set(ALL ? inCell.filter((m) => m.n >= 12 && near(m)).map((m) => m.id) : [big.id]);
    const kept = inCell.filter((m) => keepIds.has(m.id));
    const box = { minX: Math.min(...kept.map((m) => m.minX)), minY: Math.min(...kept.map((m) => m.minY)), maxX: Math.max(...kept.map((m) => m.maxX)), maxY: Math.max(...kept.map((m) => m.maxY)) };
    const pad = 3;
    const left = Math.max(0, box.minX - pad);
    const top = Math.max(0, box.minY - pad);
    const width = Math.min(W, box.maxX + pad + 1) - left;
    const height = Math.min(H, box.maxY + pad + 1) - top;
    // 이 덩어리만 남긴다 (가장자리 반투명은 덩어리 바로 옆이면 살린다)
    const out = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const gx = left + x;
        const gy = top + y;
        const gi = gy * W + gx;
        const oi = (y * width + x) * 4;
        let keep = keepIds.has(label[gi]);
        if (!keep && !solid[gi]) {
          // 반투명 가장자리 — 1px 옆이 이 덩어리면 살린다 (매끈한 테두리)
          for (const q of [gi - 1, gi + 1, gi - W, gi + W]) if (q >= 0 && q < W * H && keepIds.has(label[q])) keep = true;
        }
        if (keep) data.copy(out, oi, gi * 4, gi * 4 + 4);
      }
    }
    const file = path.join(outDir, `${name}.webp`);
    const buf = await sharp(out, { raw: { width, height, channels: 4 } })
      .resize(px, px, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90, alphaQuality: 100 })
      .toBuffer();
    fs.writeFileSync(file, buf);
    console.log(`✓ ${name} ${width}×${height} (덩어리 ${inCell.length}개 중 ${ALL ? `${kept.length}개 모두` : "가장 큰 것"}) → ${file} ${Math.round(buf.length / 1024)}KB`);
  }
}
