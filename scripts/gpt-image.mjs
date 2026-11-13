/**
 * GPT 그림 만들기 — 디자인 시안·앱 그림 (2026-11-12 사용자: "GPT 연결해서 이미지 받아서 가도 될 것 같아").
 * OpenAI 기록은 다른 곳에 남지 않아 힉스필드처럼 지울 필요는 없다 (jp 앱과 같은 판단).
 *
 *   node scripts/gpt-image.mjs --prompt-file docs/design/prompts/a.md --out docs/design/concepts/a.png
 *     --size 1536x1024 · --quality high · --model gpt-image-1.5 (거부되면 gpt-image-1)
 *     --refs a.png,b.png   그림체·구성 참고 이미지 (있으면 images/edits)
 *     --bg transparent     투명 배경 (스티커). 기본 opaque
 *     --webp public/img/x.webp --px 512   앱용: 투명 여백을 잘라 긴 변 px 로 줄인 webp 도 만든다
 *     --key-from ../jp/.env   키를 이 프로젝트에 복사하지 않고 그 파일에서 OPENAI_API_KEY 한 줄만 읽는다
 *
 * 프롬프트는 파일로만 받는다 — 한글을 \u 이스케이프로 옮기다 글자가 틀린 사고(11-06) 뒤로 원문 그대로.
 * 키는 절대 출력하지 않는다.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? process.argv[i + 1] : d;
};

function loadKey() {
  if (process.env.OPENAI_API_KEY?.trim()) return process.env.OPENAI_API_KEY.trim();
  const from = arg("key-from");
  if (from && existsSync(from)) {
    const m = readFileSync(from, "utf8").match(/^OPENAI_API_KEY=(.*)$/m);
    if (m?.[1].trim()) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("OPENAI_API_KEY 가 없어요 (.env.local 에 넣거나 --key-from 으로 빌려 쓰기)");
}

const KEY = loadKey();
const promptFile = arg("prompt-file");
const out = arg("out");
if (!promptFile || !out) throw new Error("--prompt-file 과 --out 이 필요해요");
// 쉼표로 여러 파일을 이어 붙인다 (예: 공통 화면 설명 + 스타일)
const prompt = promptFile
  .split(",")
  .map((f) => readFileSync(f.trim(), "utf8").trim())
  .join("\n\n");
const size = arg("size", "1536x1024");
const quality = arg("quality", "high");
const refs = (arg("refs") ?? "").split(",").filter(Boolean);
const models = [arg("model", "gpt-image-1.5"), "gpt-image-1"];
const background = arg("bg", "opaque");
const webp = arg("webp");
const px = Number(arg("px", "512"));

async function call(model) {
  const common = { model, prompt, size, quality, output_format: "png", background };
  if (!refs.length) {
    return fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...common, n: 1 }),
    });
  }
  const form = new FormData();
  for (const [k, v] of Object.entries(common)) form.append(k, v);
  form.append("n", "1");
  for (const r of refs) form.append("image[]", new Blob([readFileSync(r)], { type: "image/png" }), path.basename(r));
  return fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${KEY}` }, body: form });
}

let data = null;
let used = "";
for (const model of models) {
  const res = await call(model);
  if (res.ok) {
    data = await res.json();
    used = model;
    break;
  }
  console.log(`✖ ${model} ${res.status} ${(await res.text()).slice(0, 300)}`);
  if (res.status === 401) throw new Error("API 키가 맞지 않아요");
}
if (!data) throw new Error("그림을 못 만들었어요");

mkdirSync(path.dirname(out), { recursive: true });
const png = Buffer.from(data.data[0].b64_json, "base64");
writeFileSync(out, png);

if (webp) {
  // 앱용: 투명 여백을 자르고 긴 변을 px 로 (sharp 는 next 가 함께 설치한다)
  const { default: sharp } = await import("sharp");
  const img = background === "transparent" ? sharp(png).trim() : sharp(png);
  const buf = await img.resize(px, px, { fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
  mkdirSync(path.dirname(webp), { recursive: true });
  writeFileSync(webp, buf);
  console.log(`  → ${webp} ${Math.round(buf.length / 1024)}KB`);
}

const u = data.usage;
// 참고 단가(gpt-image-1 기준, 100만 토큰당): 글 입력 $5 · 그림 입력 $10 · 그림 출력 $40 — 1.5 는 이보다 싸거나 같다
const cost = u
  ? ((u.input_tokens_details?.text_tokens ?? 0) * 5 + (u.input_tokens_details?.image_tokens ?? 0) * 10 + (u.output_tokens ?? 0) * 40) / 1e6
  : null;
console.log(
  `✓ ${out} (${used}, ${quality}, ${size})` + (u ? ` · 토큰 입력 ${u.input_tokens} / 출력 ${u.output_tokens} · 약 $${cost.toFixed(3)} 이하` : ""),
);

// 관리자 '비용' 기록에 한 줄 (11-13 사용자: "어드민단에 기록으로 남겨 줘") — src/lib/admin/cost-log.json
if (cost != null) {
  const { fileURLToPath } = await import("node:url"); // 띄어쓰기 있는 폴더(Yogibo Design)도 바르게
  const logFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "admin", "cost-log.json");
  try {
    const rows = existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : [];
    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10); // 한국 날짜
    rows.push({ date: today, what: `${path.basename(out)} (${size}, ${quality})`, tool: "GPT 그림", amount: Number(cost.toFixed(3)), unit: "usd", note: promptFile });
    writeFileSync(logFile, JSON.stringify(rows, null, 2) + "\n");
  } catch (e) {
    console.log(`  (비용 기록을 못 남김: ${e.message})`);
  }
}
