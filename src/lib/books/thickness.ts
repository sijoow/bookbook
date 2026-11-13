// 책 한 권의 두께(mm) — 내 우주 높이 = '읽은' 책 두께의 합 (docs/02 2-1).
// 11-12 YES24 실측(600권·책등 126장)으로 정한 순서:
//  1) 책등 이미지 비율: 세로(mm) × 책등 가로px / 세로px — 진짜 스캔이라 가장 정확 (쪽수와 상관 0.86)
//  2) 쪽수 추정: 쪽수 × 0.05mm + 표지 2mm — 1) 기준 중간 오차 10%, 상위 10% 도 32% 안
//  3) YES24 크기의 최솟값(= height 필드) — 20·30mm 처럼 반올림된 값이 많아 중간 오차 18%, 상위 10% 는 85%까지
//  4) 모두 없으면 null → 화면에서 쪽수를 묻는다
// YES24 크기 필드 뜻: width = 가로, height = 두께, length = 세로 (이름과 다르다)

import type { ImageSize } from "./imageSize";

export const MM_PER_PAGE = 0.05;
export const COVER_MM = 2;

export type ThicknessSource = "spine" | "estimate" | "yes24" | "user";

const round1 = (n: number) => Math.round(n * 10) / 10;

/** "이미지 준비중" 대체 그림은 280×400 처럼 넓다. 진짜 책등은 세로의 절반보다 훨씬 좁다. */
export function isPlaceholderSpine(px: ImageSize): boolean {
  return px.h <= 0 || px.w / px.h > 0.5;
}

export function thicknessFromSpine(px: ImageSize, lengthMm: number | null | undefined): number | null {
  if (!lengthMm || lengthMm <= 0 || isPlaceholderSpine(px)) return null;
  const mm = round1((lengthMm * px.w) / px.h);
  return mm >= 1 && mm <= 120 ? mm : null;
}

export function thicknessFromDims(dims: Array<number | null | undefined>): number | null {
  const v = dims.filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0);
  if (v.length < 3) return null;
  const min = Math.min(...v);
  return min <= 100 ? round1(min) : null;
}

export function estimateThicknessMm(pages: number | null | undefined): number | null {
  if (!pages || !Number.isFinite(pages) || pages <= 0) return null;
  return round1(pages * MM_PER_PAGE + COVER_MM);
}

/** 책등 이미지 없이 정할 때 (책등은 비동기로 재야 해서 lib/yes24/candidate 의 applySpine 이 덮어쓴다). */
export function resolveThickness(input: {
  dims?: Array<number | null | undefined>;
  pages?: number | null;
}): { mm: number; source: ThicknessSource } | null {
  const est = estimateThicknessMm(input.pages);
  if (est != null) return { mm: est, source: "estimate" };
  const fromDims = input.dims ? thicknessFromDims(input.dims) : null;
  return fromDims != null ? { mm: fromDims, source: "yes24" } : null;
}

/** "332", "784 p.", "xiii, 345 p.", "230페이지 내외" → 가장 큰 숫자 (사용자 입력·다른 출처 대비). */
export function parsePages(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  if (typeof v !== "string") return null;
  const nums = v.match(/\d+/g)?.map(Number).filter((n) => n > 0) ?? [];
  return nums.length ? Math.max(...nums) : null;
}
