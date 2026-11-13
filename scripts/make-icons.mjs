// 앱 아이콘 — 행성 스티커(public/img/planet-home.webp)를 버터색 바탕에. TWA(APK)·홈 화면 추가용
//   node scripts/make-icons.mjs → public/icons/icon-192.png · icon-512.png · maskable-512.png(동그랗게 잘려도 남게 64%)
import fs from "node:fs";
import sharp from "sharp";

const BG = "#f6d77c";
fs.mkdirSync("public/icons", { recursive: true });
async function icon(size, ratio, file) {
  const planet = await sharp("public/img/planet-home.webp").resize({ width: Math.round(size * ratio), withoutEnlargement: false }).toBuffer();
  const m = await sharp(planet).metadata();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: planet, left: Math.round((size - m.width) / 2), top: Math.round((size - m.height) / 2) }])
    .png()
    .toFile(file);
  console.log(file);
}
await icon(512, 0.86, "public/icons/icon-512.png");
await icon(192, 0.86, "public/icons/icon-192.png");
await icon(512, 0.64, "public/icons/maskable-512.png");
