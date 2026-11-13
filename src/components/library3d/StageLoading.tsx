// 입체 도서관을 불러오는 동안 — 행성이 통통 + '불러오는 중…' (11-13 사용자: "로딩이 길면 아이콘·글자 — 에러 난 것 같아서")
// 폰에선 첫 화면을 그리기 전(재질 준비) 캔버스가 까맣게 몇 초 보였다 → 그동안 이걸 덮어 둔다. three.js 없이 가벼운 파일 (페이지의 dynamic 대기 화면에도 쓴다)
/* eslint-disable @next/next/no-img-element -- 우리 행성 스티커 */

import s from "./stage.module.css";

export function StageLoading({ text = "도서관을 불러오는 중…", overlay = false }: { text?: string; overlay?: boolean }) {
  return (
    <div className={`${s.loading} ${overlay ? s.loadingOver : ""}`} role="status" aria-live="polite">
      <img src="/img/loading-reader.webp" alt="" className={s.loadingPlanet} />
      <i className={s.loadingShadow} aria-hidden />
      <span>{text}</span>
    </div>
  );
}
