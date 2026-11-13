// 책장 정리 — 한 번에 순서 바꾸기 (11-12 사용자: "책장 순서 정리나 이런 요소들도"). 순수 함수, 책 id 순서를 돌려준다.

import { shortAuthor, type LibraryBook } from "./types";

export const SORTS = ["status", "title", "author", "tall", "recent"] as const;
export type SortKind = (typeof SORTS)[number];

export const SORT_LABEL: Record<SortKind, string> = {
  status: "읽는 중 먼저",
  title: "제목 가나다",
  author: "작가끼리",
  tall: "큰 책부터",
  recent: "최근 꽂은 책부터",
};

const STATUS_RANK: Record<LibraryBook["status"], number> = { reading: 0, read: 1, want: 2, stopped: 3 };
const ko = (a: string, b: string) => a.localeCompare(b, "ko");

type Sortable = Pick<LibraryBook, "id" | "title" | "author" | "status" | "lengthMm" | "createdAt">;

export function sortBooks(books: Sortable[], kind: SortKind): string[] {
  const xs = [...books];
  const byTitle = (a: Sortable, b: Sortable) => ko(a.title, b.title);
  switch (kind) {
    case "status":
      xs.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || byTitle(a, b));
      break;
    case "title":
      xs.sort(byTitle);
      break;
    case "author":
      xs.sort((a, b) => ko(shortAuthor(a.author) || "힣", shortAuthor(b.author) || "힣") || byTitle(a, b));
      break;
    case "tall":
      xs.sort((a, b) => (b.lengthMm ?? 210) - (a.lengthMm ?? 210) || byTitle(a, b));
      break;
    case "recent":
      xs.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || byTitle(a, b));
      break;
  }
  return xs.map((b) => b.id);
}
