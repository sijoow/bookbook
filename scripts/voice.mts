/**
 * 캐릭터 목소리 굽기 — src/lib/voice/lines.ts 의 말을 Typecast 성우 목소리 MP3 로 (여자아이·남자아이 하나씩).
 * 11-13 사용자: "Typecast 가지고 있는 게 있어서 거기서 몇 개 해서 캐릭터 음성 성우까지 입힐 것"
 * API·요청 모양은 숫자놀이 scripts/typecast.mts(보이스동화에서 써 온 것)를 따른다: 느낌표 말만 밝게(0.5), 1글자 = 1크레딧.
 * 굽기 전에 이번 달 사용량을 보고 안전선(TYPECAST_SAFE_LIMIT, 기본 19만)을 넘으면 멈춘다. 이미 구운 줄은 건너뜀.
 *
 *   node scripts/voice.mts list                 Typecast 성우 목록(한국어) — 크레딧 안 씀
 *   node scripts/voice.mts make                 견적만 (몇 줄·몇 글자·이번 달 사용량)
 *   node scripts/voice.mts make --yes           실제로 굽기 (girl·boy 둘 다)
 *   --voice girl|boy|all (기본 all) · --redo "말,말"
 *
 * bookbook/.env.local: TYPECAST_API_KEY · TYPECAST_VOICE_GIRL · TYPECAST_VOICE_BOY (voice_id — list 로 찾는다)
 * 결과: public/voice/{girl|boy}/<해시>.mp3 + src/lib/voice/manifest.json (한 줄마다 저장 — 끊겨도 이어서)
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { TRACK } from "../src/lib/deco/items.ts";

const ROOT = new URL("../", import.meta.url);
const API = "https://api.typecast.ai";
const MODEL = "ssfm-v30";
const SAFE_LIMIT = Number(process.env.TYPECAST_SAFE_LIMIT ?? 190_000);
const KINDS = { girl: "TYPECAST_VOICE_GIRL", boy: "TYPECAST_VOICE_BOY" } as const;
type Kind = keyof typeof KINDS;

// lines.ts 는 @/ 경로를 써서 node 로 바로 못 읽는다 — 같은 목록을 여기서 만든다 (lines.test.ts 가 둘이 같은지 본다)
export const LINES: string[] = [
  "이거 읽을래!",
  "꺼내 올게!",
  "이 책이구나!",
  "다 읽었다!",
  "오늘은 뭐 읽을까?",
  "책 골라 줘!",
  "같이 읽자!",
  "오늘은 여기까지?",
  "잘 읽었다!",
  "몇 쪽까지 읽었어?",
  "배달 왔어!",
  "열어 볼까?",
  ...TRACK.map((t) => `${t.label} 받았다!`),
  "어때?",
  "어서 와!",
  "이 책 보여 줄게!",
  "잠깐만!",
  "이거?",
  "잘 읽어!",
  "놀러 왔어!",
  "안녕! 또 올게",
  "잘 가!",
  "멍멍!",
  "야옹!",
  "깡총깡총!",
  "찍찍!",
  "삐약삐약!",
  "선물이야!",
  "고마워!",
  "발도장 꾹!",
];

function loadEnv() {
  const file = new URL(".env.local", ROOT);
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hashOf = (text: string) => createHash("sha1").update(text).digest("hex").slice(0, 16);
const manifestUrl = new URL("src/lib/voice/manifest.json", ROOT);
const readManifest = (): Record<string, Record<string, string>> => {
  try {
    return JSON.parse(readFileSync(manifestUrl, "utf8"));
  } catch {
    return {};
  }
};

type ApiVoice = { voice_id: string; voice_name: { eng: string; kor: string }; models: { version: string; emotions: string[] }[]; gender: string | null; age: string | null };

async function listVoices(key: string): Promise<ApiVoice[]> {
  const res = await fetch(`${API}/v3/voices?model=${MODEL}`, { headers: { "X-API-KEY": key } });
  if (!res.ok) throw new Error(`보이스 목록 ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as ApiVoice[];
}

async function usedThisMonth(key: string): Promise<number | null> {
  try {
    const res = await fetch(`${API}/v1/users/me/subscription`, { headers: { "X-API-KEY": key } });
    if (!res.ok) return null;
    const data = (await res.json()) as { credits?: { used_credits?: number } };
    return Number(data.credits?.used_credits ?? 0);
  } catch {
    return null;
  }
}

async function speak(key: string, voice: ApiVoice, text: string): Promise<Buffer> {
  const emotions = voice.models.find((m) => m.version === MODEL)?.emotions ?? [];
  const body: Record<string, unknown> = { voice_id: voice.voice_id, text, model: MODEL, language: "kor", output: { audio_format: "mp3" } };
  if (text.trim().endsWith("!") && emotions.includes("happy")) body.prompt = { emotion_preset: "happy", emotion_intensity: 0.5 };
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}/v1/text-to-speech`, { method: "POST", headers: { "Content-Type": "application/json", "X-API-KEY": key }, body: JSON.stringify(body) });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    if (res.status === 401) throw new Error("API 키가 맞지 않아요 (401)");
    if (res.status === 402 || detail.includes("CREDIT")) throw new Error("크레딧이 모자라요 (402)");
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await sleep(2000 * attempt);
      continue;
    }
    throw new Error(`${res.status} ${detail}`);
  }
}

async function main() {
  loadEnv();
  const key = process.env.TYPECAST_API_KEY ?? "";
  const cmd = process.argv[2];
  if (!key) {
    console.log("bookbook/.env.local 에 TYPECAST_API_KEY 를 넣어 주세요.");
    process.exit(1);
  }
  const voices = await listVoices(key);
  if (cmd === "list") {
    for (const v of voices.filter((x) => x.voice_name.kor)) console.log(`${v.voice_id}  ${v.voice_name.kor} (${v.voice_name.eng}) · ${v.gender ?? "?"} · ${v.age ?? "?"}`);
    return;
  }
  if (cmd !== "make") throw new Error("쓰는 법: node scripts/voice.mts list | make [--yes] [--voice girl|boy|all]");

  const which = (arg("voice") ?? "all") as Kind | "all";
  const kinds: Kind[] = which === "all" ? ["girl", "boy"] : [which];
  const redo = new Set((arg("redo") ?? "").split(",").map((x) => x.trim()).filter(Boolean));
  const manifest = readManifest();
  const plan: Array<{ kind: Kind; voice: ApiVoice; text: string }> = [];
  for (const kind of kinds) {
    const id = process.env[KINDS[kind]];
    const voice = voices.find((v) => v.voice_id === id);
    if (!voice) throw new Error(`.env.local 의 ${KINDS[kind]} 를 ${MODEL} 성우 목록에서 못 찾았어요 — node scripts/voice.mts list 로 voice_id 를 찾아 넣어 주세요`);
    for (const text of LINES) if (redo.has(text) || !manifest[kind]?.[text]) plan.push({ kind, voice, text });
  }
  const chars = plan.reduce((t, p) => t + p.text.length, 0);
  const used = await usedThisMonth(key);
  console.log(`구울 줄 ${plan.length} · ${chars}자(≈${chars} 크레딧) · 이번 달 사용 ${used ?? "모름"} / 안전선 ${SAFE_LIMIT}`);
  if (used != null && used + chars > SAFE_LIMIT) throw new Error("안전선을 넘어요 — 멈춤");
  if (!process.argv.includes("--yes")) {
    console.log("견적만 — 굽으려면 --yes");
    return;
  }
  let done = 0;
  for (const p of plan) {
    const dir = new URL(`public/voice/${p.kind}/`, ROOT);
    mkdirSync(dir, { recursive: true });
    const file = `${hashOf(p.text)}.mp3`;
    writeFileSync(new URL(file, dir), await speak(key, p.voice, p.text));
    const m = readManifest();
    m[p.kind] = { ...(m[p.kind] ?? {}), [p.text]: file };
    writeFileSync(manifestUrl, JSON.stringify(m, null, 2) + "\n");
    done++;
    console.log(`  ${p.kind} ${done}/${plan.length} ${p.text}`);
  }
  const usedNow = await usedThisMonth(key);
  console.log(`다 구웠어요 — ${done}줄 · ${chars}자 · 이번 달 사용 ${usedNow ?? "모름"}`);
  // 관리자 '비용' 기록에 한 줄 (src/lib/admin/cost-log.json)
  if (done > 0) {
    const logUrl = new URL("src/lib/admin/cost-log.json", ROOT);
    const rows = existsSync(logUrl) ? JSON.parse(readFileSync(logUrl, "utf8")) : [];
    rows.push({ date: new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10), what: `캐릭터 목소리 ${done}줄 (${kinds.join("·")})`, tool: "Typecast", amount: chars, unit: "credits", note: `이번 달 사용 ${usedNow ?? "모름"}` });
    writeFileSync(logUrl, JSON.stringify(rows, null, 2) + "\n");
  }
}

main().catch((e) => {
  console.error("멈춤:", (e as Error).message);
  process.exit(1);
});
