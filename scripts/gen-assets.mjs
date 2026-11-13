// A 시안(다꾸 다이어리) 그림 재료를 GPT 로 만든다 — 행성 스티커·빈 우주. 글자·버튼·테이프·점선은 코드로 그린다.
//   node scripts/gen-assets.mjs [--force] [이름…]
// 원본 PNG 는 docs/design/assets/, 앱용 webp 는 public/img/. 이미 있는 그림은 건너뛴다(--force 면 다시).
// 키는 복사하지 않고 ../jp/.env 에서 OPENAI_API_KEY 한 줄만 빌린다 (비용이 JLPT 키로 잡힘).
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const REF = "docs/design/concepts/2026-11-12-a-daku.png";
const P = "docs/design/prompts/assets";
const ASSETS = [
  { name: "planet-home", size: "1536x1024", quality: "high", px: 720 },
  { name: "planet-orange", size: "1024x1024", quality: "medium", px: 320 },
  { name: "planet-mint", size: "1024x1024", quality: "medium", px: 320 },
  { name: "planet-coral", size: "1024x1024", quality: "medium", px: 320 },
  { name: "planet-brown", size: "1024x1024", quality: "medium", px: 320 },
  { name: "planet-yellow", size: "1024x1024", quality: "medium", px: 320 },
  { name: "empty-universe", size: "1536x1024", quality: "medium", px: 640 },
];

const force = process.argv.includes("--force");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const todo = ASSETS.filter((a) => (!only.length || only.includes(a.name)) && (force || !existsSync(`docs/design/assets/${a.name}.png`)));
if (!todo.length) {
  console.log("만들 그림이 없어요 (다 있음 — 다시 만들려면 --force)");
  process.exit(0);
}

function run(a) {
  return new Promise((resolve) => {
    const args = [
      "scripts/gpt-image.mjs",
      "--key-from", "../jp/.env",
      "--prompt-file", `${P}/_sticker.md,${P}/${a.name}.md`,
      "--refs", REF,
      "--bg", "transparent",
      "--size", a.size,
      "--quality", a.quality,
      "--out", `docs/design/assets/${a.name}.png`,
      "--webp", `public/img/${a.name}.webp`,
      "--px", String(a.px),
    ];
    const p = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    p.stdout.on("data", (d) => (log += d));
    p.stderr.on("data", (d) => (log += d));
    p.on("close", (code) => resolve({ name: a.name, code, log: log.trim() }));
  });
}

// 동시에 4장씩
const results = [];
for (let i = 0; i < todo.length; i += 4) results.push(...(await Promise.all(todo.slice(i, i + 4).map(run))));
for (const r of results) console.log(`${r.code === 0 ? "" : "✖ "}${r.name}\n${r.log}`);
