// 비용 기록 — 관리자 '비용' 메뉴 (11-13 사용자: "지금까지 GPT·이미지 생성 비용 정리" + "어드민단에 기록으로 남겨 줘")
// cost-log.json = 쓴 비용 한 줄씩 (scripts/gpt-image.mjs · scripts/voice.mts 가 쓸 때마다 저절로 덧붙인다).
// ESTIMATES = 회원이 쓰는 기능별 예상 비용 (얼굴로 캐릭터 만들기 등) — 외부 AI 로 사진이 나가는 방법은 안내가 필요하다.

import log from "./cost-log.json";

export type CostEntry = { date: string; what: string; tool: string; amount: number; unit: "usd" | "credits"; note?: string };
export const COST_LOG = log as CostEntry[];
export const KRW_PER_USD = 1400; // 대략 (보기용)

export function costTotals(entries: CostEntry[] = COST_LOG) {
  const usd = entries.filter((e) => e.unit === "usd").reduce((t, e) => t + e.amount, 0);
  const credits: Record<string, number> = {};
  for (const e of entries.filter((x) => x.unit === "credits")) credits[e.tool] = (credits[e.tool] ?? 0) + e.amount;
  return { usd: Math.round(usd * 1000) / 1000, krw: Math.round((usd * KRW_PER_USD) / 10) * 10, credits };
}

/** '내 얼굴로 캐릭터 만들기' 방법별 예상 비용 (11-13 정리) — 1달러 1,400원, 회원 1,000명이 2번씩 기준 */
export const ESTIMATES: Array<{ name: string; result: string; once: string; thousand: string; photoOut: boolean; note?: string }> = [
  { name: "① 폰 안에서 색만 읽기 (지금)", result: "피부·머리 색·길이만 비슷하게", once: "0원", thousand: "0원", photoOut: false },
  { name: "② AI가 사진을 보고 고르기", result: "머리 모양·안경·눈·눈썹까지 골라 지금 3D 아바타에 입힘", once: "약 10~20원", thousand: "약 2만~4만 원", photoOut: true, note: "추천 — 비용이 거의 없고 꽤 닮는다" },
  { name: "③ AI가 캐릭터 그림을 새로 그리기 (보통 화질)", result: "'나 닮은 캐릭터' 그림 (프로필·카드용)", once: "약 70원", thousand: "약 14만 원", photoOut: true, note: "포인트로 사는 꾸밈 기능으로 두면 좋다" },
  { name: "③ 같은 것 (고화질)", result: "위와 같음, 더 선명", once: "약 240원", thousand: "약 48만 원", photoOut: true },
  { name: "④ 사진으로 3D 모델 만들기", result: "움직이지 못하는 덩어리 — 걷기·앉기엔 바로 못 씀", once: "모델 1개 약 700~2,800원", thousand: "회원마다 만들기는 어려움", photoOut: true },
];

/** 사진이 외부 AI 로 나가는 방법(②·③·④)을 열기 전에 꼭 할 것 */
export const PHOTO_OUT_RULES = [
  "사진 사용 동의 — 무엇에 쓰는지 적고, 동의해야만 보낸다",
  "저장하지 않는다는 안내 — 캐릭터를 고르거나 그리면 사진은 바로 지운다 (서버·AI 쪽 모두)",
  "해외 전송 안내 — 사진이 나라 밖 AI 회사 서버로 간다는 것과 그 회사 이름·나라 (예: 미국 OpenAI)",
  "만 14세 미만은 보호자 동의 (가입 나이 기준이 확정되면 맞춘다)",
  "개인정보 처리방침(/terms)에 위 내용을 덧붙인다",
];

/** 진짜 3D 캐릭터 (회원별 생성이 아니라 기본 몸 + 머리·옷 부품을 한 번 만들기) */
export const MODEL_3D_NOTE = "외주로 기본 몸 + 머리·옷 부품을 한 번 만드는 방식 — 대략 수백만 원 수준, 2~4주 (시세 차이가 크다)";
