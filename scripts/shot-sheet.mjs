// 캡처 여러 장을 한 장으로 모아 보기 (확인용) — node scripts/shot-sheet.mjs 출력.png 열수 배율 파일...
import sharp from "sharp";
const [out, cols, scale, ...files] = process.argv.slice(2);
const c = Number(cols), sc = Number(scale);
const metas = await Promise.all(files.map((f) => sharp(f).metadata()));
const w = Math.round(metas[0].width * sc), h = Math.round(metas[0].height * sc);
const rows = Math.ceil(files.length / c);
const tiles = await Promise.all(files.map((f) => sharp(f).resize(w, h).png().toBuffer()));
await sharp({ create: { width: w * c + (c - 1) * 6, height: h * rows + (rows - 1) * 6, channels: 3, background: "#333" } })
  .composite(tiles.map((input, i) => ({ input, left: (i % c) * (w + 6), top: Math.floor(i / c) * (h + 6) })))
  .png().toFile(out);
console.log(out, w * c, h * rows);
