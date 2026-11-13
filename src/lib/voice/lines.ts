// 캐릭터 목소리 — 아바타 말풍선에 나오는 말 전부 (11-13 사용자: "Typecast 로 캐릭터 음성 성우까지 입힐 것")
// 여자아이·남자아이 목소리로 하나씩 구워 public/voice/{girl|boy}/ 에 둔다 (scripts/voice.mts). 말이 바뀌면 여기와 world.ts 를 같이.
// 굽지 않은 말은 소리 없이 말풍선만 (앱은 그대로 돈다).

import { TRACK } from "@/lib/deco/items";

export const VOICE_LINES: string[] = [
  // 홈 — 책 꺼내기 · 다 읽음 · 인사 · 덮기
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
  // 배달 상자 · 꾸미기
  "배달 왔어!",
  "열어 볼까?",
  ...TRACK.map((t) => `${t.label} 받았다!`),
  "어때?",
  // 친구 집 (집주인) · 손님(나)
  "어서 와!",
  "이 책 보여 줄게!",
  "잠깐만!",
  "이거?",
  "잘 읽어!",
  "놀러 왔어!",
  "발도장 꾹!",
];

export type VoiceKind = "girl" | "boy";
/** 구운 목소리 — scripts/voice.mts 가 채운다: { girl: { 말: 파일 }, boy: { … } } */
export type VoiceManifest = Partial<Record<VoiceKind, Record<string, string>>>;
