// 책장 배치 — 책등 크기(실제 세로·두께 비율)와 책장 폭에 맞춘 칸 나누기. 순수 함수.

import type { LibraryBook } from "./types";

export const SPINE_SCALE = 0.62; // px/mm — 세로 225mm 책이 140px
const WIDTH_BOOST = 1.5; // 얇은 책도 누를 수 있게 두께만 부풀림
const MIN_W = 14;
const MAX_W = 56;
export const SPINE_GAP = 2;
export const ADD_SLOT_W = 30; // 마지막 칸의 '+' 자리

type Sized = Pick<LibraryBook, "lengthMm" | "thicknessMm">;

export function spineSize(b: Sized): { w: number; h: number } {
  const h = Math.round((b.lengthMm ?? 210) * SPINE_SCALE);
  const w = Math.round(Math.min(MAX_W, Math.max(MIN_W, (b.thicknessMm ?? 15) * SPINE_SCALE * WIDTH_BOOST)));
  return { w, h };
}

export function rowWidth(row: Sized[]): number {
  return row.reduce((t, b, i) => t + spineSize(b).w + (i ? SPINE_GAP : 0), 0);
}

/** 책장 폭(px)에 맞춰 칸 나누기. reserveAdd 면 마지막 칸에 '+' 자리가 들어가야 한다 (안 들어가면 빈 칸을 하나 더) */
export function packRows<T extends Sized>(books: T[], width: number, reserveAdd = true): T[][] {
  const rows: T[][] = [];
  let row: T[] = [];
  let used = 0;
  for (const b of books) {
    const w = spineSize(b).w;
    if (row.length && used + SPINE_GAP + w > width) {
      rows.push(row);
      row = [];
      used = 0;
    }
    used += row.length ? SPINE_GAP + w : w;
    row.push(b);
  }
  rows.push(row);
  const last = rows[rows.length - 1];
  if (reserveAdd && last.length && rowWidth(last) + SPINE_GAP + ADD_SLOT_W > width) rows.push([]);
  return rows;
}
