// 다꾸 꾸밈: 마스킹테이프 · 손그림 별 · YES24 출처 줄

import type { CSSProperties } from "react";
import s from "./ui.module.css";

type TapeColor = "apricot" | "mint" | "butter" | "coral" | "sky";

/** 카드 위에 붙인 마스킹테이프 한 조각 */
export function Tape({ color = "apricot", style, className }: { color?: TapeColor; style?: CSSProperties; className?: string }) {
  return <span aria-hidden className={`${s.tape} ${s[`tape_${color}`]} ${className ?? ""}`} style={style} />;
}

type DoodleProps = { size?: number; color?: string; style?: CSSProperties; className?: string };

/** 펜으로 그린 반짝이 별 (살짝 삐뚤게) */
export function Sparkle({ size = 18, color = "var(--butter)", style, className }: DoodleProps) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" style={style} className={`${s.doodle} ${className ?? ""}`}>
      <path
        d="M12 2.5c.6 4.6 2.4 7.3 9 9.3-6.4 1.6-8.3 4.6-9 9.7-.8-5.2-2.8-8.1-9-9.6 6.3-2 8.3-4.7 9-9.4Z"
        fill={color}
        stroke="var(--ink)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 펜으로 그린 오각별 */
export function StarDoodle({ size = 18, color = "var(--butter)", style, className }: DoodleProps) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" style={style} className={`${s.doodle} ${className ?? ""}`}>
      <path
        d="M12 2.8 14.6 9l6.6.4-5.1 4.2 1.7 6.5L12 16.5 6.3 20.2 8 13.6 2.9 9.5 9.5 9Z"
        fill={color}
        stroke="var(--ink)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** YES24 데이터가 보이는 화면마다 (약관 6조 ③4) */
export function Yes24Credit() {
  return (
    <p className={s.credit}>
      <a href="https://www.yes24.com" target="_blank" rel="noreferrer">
        도서 정보·이미지 제공: YES24
      </a>
    </p>
  );
}
