"use client";

// 입체 도서관을 불러오는 동안 — 책 읽으며 생각하는 아이가 통통 + 귀여운 문구가 1.6초마다 바뀐다
// (11-13 사용자: "로딩이 길면 아이콘·글자 — 에러 난 것 같아서" + "불러오는 중 말고 이쁜 것들")
// 폰에선 첫 화면을 그리기 전(재질 준비) 캔버스가 까맣게 몇 초 보였다 → 그동안 이걸 덮어 둔다. three.js 없이 가벼운 파일 (페이지의 dynamic 대기 화면에도 쓴다)
/* eslint-disable @next/next/no-img-element -- 우리 스티커 그림 */

import { useEffect, useState } from "react";
import s from "./stage.module.css";

const HOME = ["책장 먼지 터는 중…", "책갈피 끼우는 중…", "방석 폭신하게 펴는 중…", "오늘 읽을 책 고르는 중…", "따뜻한 차 우리는 중…", "고양이 깨우는 중…", "별빛 모으는 중…"];
const VISIT = ["친구 집으로 가는 중…", "초인종 누르는 중… 똑똑", "신발 정리하는 중…"];

export function StageLoading({ text, overlay = false, visit = false }: { text?: string; overlay?: boolean; visit?: boolean }) {
  const lines = text ? [text] : visit ? VISIT : HOME;
  const [i, setI] = useState(0); // 처음은 늘 첫 문구 (서버에서 그린 것과 같게)
  useEffect(() => {
    if (lines.length < 2) return;
    const id = window.setInterval(() => setI((n) => n + 1), 1600);
    return () => window.clearInterval(id);
  }, [lines.length]);
  return (
    <div className={`${s.loading} ${overlay ? s.loadingOver : ""}`} role="status" aria-live="polite">
      <img src="/img/loading-reader.webp" alt="" className={s.loadingPlanet} />
      <i className={s.loadingShadow} aria-hidden />
      <span key={i % lines.length} className={s.loadingText}>
        {lines[i % lines.length]}
      </span>
    </div>
  );
}
