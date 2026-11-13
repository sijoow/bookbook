// 캐릭터 목소리 틀기 — 말풍선이 뜰 때 그 말의 목소리 (구운 것만, 없으면 조용히). 소리는 끌 수 있다 (이 기기에만 기억)
// 여자아이 아바타 = girl 목소리, 남자아이 = boy. 새 말이 나오면 앞 말은 멈춘다.

import type { Gender } from "@/lib/avatar/config";
import manifest from "@/lib/voice/manifest.json";
import type { VoiceManifest } from "@/lib/voice/lines";
import { duckMusic } from "./bgm";

const KEY = "bookbook.sound";
const files = manifest as VoiceManifest;
let playing: HTMLAudioElement | null = null;

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSound(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // 저장이 막히면 이번만
  }
  if (!on) playing?.pause();
}

/** 구운 목소리가 하나라도 있나 (없으면 소리 설정을 감춘다) */
export function hasVoices(): boolean {
  return Object.values(files).some((m) => m && Object.keys(m).length > 0);
}

export function speak(text: string, gender: Gender) {
  if (typeof window === "undefined" || !soundOn()) return;
  const file = files[gender]?.[text];
  if (!file) return;
  try {
    playing?.pause();
    const a = new Audio(`/voice/${gender}/${file}`);
    a.volume = 0.9;
    playing = a;
    duckMusic(); // 배경 음악은 잠깐 작게
    void a.play().catch(() => {}); // 첫 터치 전엔 브라우저가 막는다 — 말풍선만
  } catch {
    // 소리를 못 내는 기기
  }
}
