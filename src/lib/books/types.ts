// 서버·화면이 함께 쓰는 서재 책 모양 (DB 문서를 화면용으로 바꾼 것)

import type { ThicknessSource } from "./thickness";

export type BookStatus = "want" | "reading" | "read" | "stopped";

export const STATUS_LABEL: Record<BookStatus, string> = {
  read: "읽은",
  reading: "읽는 중",
  want: "읽고 싶은",
  stopped: "중단",
};

export const STATUS_ORDER: BookStatus[] = ["read", "reading", "want", "stopped"];

/** 문장 속 상태 ("현우: 다 읽음 · 5시간") — STATUS_LABEL('읽은')은 칩·탭 이름용 */
export const STATUS_SAY: Record<BookStatus, string> = {
  read: "다 읽음",
  reading: "읽는 중",
  want: "읽고 싶음",
  stopped: "중단",
};

export type LibraryBook = {
  id: string;
  isbn13: string | null;
  workKey: string;
  title: string;
  author: string | null;
  publisher: string | null;
  pages: number | null;
  currentPage: number | null;
  thicknessMm: number | null;
  thicknessSource: ThicknessSource | null;
  lengthMm: number | null;
  coverUrl: string | null;
  sideCoverUrl: string | null;
  category: string | null;
  status: BookStatus;
  rating: number | null; // 0.5 단위, 5점 만점
  oneLiner: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  readMinutes: number; // 이 책을 읽은 시간 합 (세션)
  link: string | null; // YES24 상품 상세 — 책 상세 화면에 꼭 보여 준다 (약관)
};

export type Memo = { id: string; text: string; page: number | null; createdAt: string };

/** 책장에서 꺼내 읽고 덮을 때 남는 기록 한 번 */
export type ReadingSession = {
  id: string;
  bookId: string;
  startedAt: string | null;
  endedAt: string;
  minutes: number;
  fromPage: number;
  toPage: number;
  pagesRead: number;
};

/** 'YES24' 의 '헤르만 헤세 저/전영애 역' → '헤르만 헤세' (화면에 짧게) */
export function shortAuthor(a: string | null | undefined): string {
  return (a ?? "")
    .split("/")[0]
    .replace(/\s+(저|지음|글|편|엮음|글·그림)$/, "")
    .trim();
}
