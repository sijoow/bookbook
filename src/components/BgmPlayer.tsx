"use client";

// 배경 음악 틀기 — 앱 화면(탭 막대가 있는 화면) 내내 이어서 흐른다 (레이아웃에 한 번).
// 첫 터치·클릭·키에 시작(브라우저가 그 전엔 소리를 막는다), 앱을 내리면 멈췄다가 돌아오면 이어서. 켜고 끄기는 홈 옆 서랍.

import { useEffect } from "react";
import { pauseHidden, resumeShown, startMusic } from "@/lib/client/bgm";

export function BgmPlayer() {
  useEffect(() => {
    const kick = () => startMusic();
    const vis = () => (document.hidden ? pauseHidden() : resumeShown());
    window.addEventListener("pointerdown", kick);
    window.addEventListener("keydown", kick);
    document.addEventListener("visibilitychange", vis);
    // 이 탭에서 이미 손댄 적이 있으면(앱 안에서 화면을 옮겨 다닐 때) 바로 — 아니면 첫 터치까지 음원을 받지도 않는다 (데이터 아끼기)
    if ((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive) startMusic();
    return () => {
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);
  return null;
}
