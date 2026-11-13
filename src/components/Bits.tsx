"use client";
/* eslint-disable @next/next/no-img-element -- YES24 표지는 응답 URL 을 그대로 쓴다 (약관) */

// 표지 스티커 · 별점 · 진행 막대

import { StarDoodle } from "./Deco";
import s from "./ui.module.css";

export function CoverSticker({ src, title, w = 64, tilt = -2 }: { src: string | null; title: string; w?: number; tilt?: number }) {
  const h = Math.round(w * 1.45);
  const style = { width: w, height: h, transform: `rotate(${tilt}deg)` };
  return src ? (
    <img src={src} alt={title} className={s.cover} style={style} loading="lazy" />
  ) : (
    <span className={s.coverBlank} style={{ ...style, fontSize: Math.max(11, Math.round(w / 5.5)) }}>
      {title}
    </span>
  );
}

/** 별점 (1~5, 같은 별을 다시 누르면 지움). onChange 가 없으면 보기만 */
export function Stars({ value, onChange, size = 28 }: { value: number | null; onChange?: (v: number | null) => void; size?: number }) {
  return (
    <div className={s.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={s.starBtn}
          disabled={!onChange}
          aria-label={`${n}점`}
          aria-pressed={(value ?? 0) >= n}
          onClick={() => onChange?.(value === n ? null : n)}
        >
          <StarDoodle size={size} color={(value ?? 0) >= n ? "var(--butter)" : "var(--card)"} />
        </button>
      ))}
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={s.progress} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={s.progressFill} style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%`, borderRightWidth: pct >= 100 || pct === 0 ? 0 : undefined }} />
    </div>
  );
}
