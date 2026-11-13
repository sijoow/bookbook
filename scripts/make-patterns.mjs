// 옷 무늬 만들기 (11-13) — GPT 로 뽑아 자른 천 무늬 한 장씩 → 가운데 정사각형 → 옆으로만 거울로 이어 붙여(2×1) 가로 이음매 없는 무늬 그림
//   node scripts/make-patterns.mjs <자른 폴더> [출력 폴더=public/img/patterns] [크기=256]
// 위아래로 뒤집으면 곰돌이·토끼가 거꾸로 서서 옆으로만 — 옷엔 위아래로 한 번만 감싼다(이음매가 목·밑단이라 안 보인다). 원본: docs/design/assets/fabric-patterns.png
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [src, outDir = "public/img/patterns", sizeS = "256"] = process.argv.slice(2);
if (!src) throw new Error("쓰는 법: node scripts/make-patterns.mjs <자른 폴더> [출력 폴더] [크기]");
const size = Number(sizeS);
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(src).filter((x) => /\.(webp|png)$/i.test(x))) {
  const img = sharp(path.join(src, f)).ensureAlpha();
  const { width, height } = await img.metadata();
  const side = Math.floor(Math.min(width, height) * 0.9); // 가장자리 4~5% 는 버린다 (자를 때 남은 테두리)
  const left = Math.floor((width - side) / 2);
  const top = Math.floor((height - side) / 2);
  const tile = await sharp(path.join(src, f)).extract({ left, top, width: side, height: side }).resize(size, size).removeAlpha().png().toBuffer();
  const flop = await sharp(tile).flop().toBuffer();
  const out = path.join(outDir, f.replace(/\.(png|webp)$/i, ".webp"));
  await sharp({ create: { width: size * 2, height: size, channels: 3, background: "#ffffff" } })
    .composite([
      { input: tile, left: 0, top: 0 },
      { input: flop, left: size, top: 0 },
    ])
    .webp({ quality: 86 })
    .toFile(out);
  console.log("✓", out, `${Math.round(fs.statSync(out).size / 1024)}KB`);
}
