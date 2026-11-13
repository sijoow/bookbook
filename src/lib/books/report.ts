// 이달의 독서 카드 — 월간 리포트 (11-13 사용자: "월간 독서 리포트 — 이번 달 읽은 책·시간·가장 많이 읽은 분야를 카드 한 장으로, 공유도")
// 순수 계산 — 기록 탭이 내 책장·독서 기록(최근 120일)으로 그린다. 날짜는 한국 날짜

import { kstDay } from "@/lib/deco/items";
import { josa } from "@/lib/ko";
import { genreOf, genreShort } from "./picks";
import { shortAuthor, type LibraryBook, type ReadingSession } from "./types";

export type MonthReport = {
  month: string; // '2026-11'
  label: string; // '11월'
  finished: LibraryBook[]; // 이번 달에 다 읽은 책 (다 읽은 날 순)
  minutes: number;
  pages: number;
  days: number; // 읽은 날 수
  topGenre: string | null;
  topAuthor: { name: string; count: number } | null;
  line: string; // 한 줄 요약 (공유 글에도)
};

const monthOf = (iso: string) => kstDay(new Date(iso)).slice(0, 7);

export function monthReport(books: LibraryBook[], sessions: Pick<ReadingSession, "endedAt" | "minutes" | "pagesRead">[], at: Date): MonthReport {
  const month = kstDay(at).slice(0, 7);
  const label = `${Number(month.slice(5))}월`;
  const finished = books
    .filter((b) => b.status === "read" && b.finishedAt && monthOf(b.finishedAt) === month)
    .sort((a, b) => (a.finishedAt ?? "").localeCompare(b.finishedAt ?? ""));
  const mine = sessions.filter((x) => monthOf(x.endedAt) === month);
  const minutes = mine.reduce((t, x) => t + Math.max(0, x.minutes), 0);
  const pages = mine.reduce((t, x) => t + Math.max(0, x.pagesRead), 0);
  const days = new Set(mine.filter((x) => x.minutes > 0 || x.pagesRead > 0).map((x) => kstDay(new Date(x.endedAt)))).size;
  const count = <K extends string>(keys: (K | null)[]) => {
    const m = new Map<K, number>();
    for (const k of keys) if (k) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  };
  const g = count(finished.map((b) => genreOf(b.category)));
  const a = count(finished.map((b) => shortAuthor(b.author) || null));
  const topGenre = g ? genreShort(g[0]) : null;
  const topAuthor = a && a[1] >= 2 ? { name: a[0], count: a[1] } : null;
  const hours = minutes >= 60 ? `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ""}` : `${minutes}분`;
  const line = finished.length
    ? `${label}엔 ${finished.length}권을 다 읽었어요 · ${hours}${topGenre ? ` · ${topGenre}${josa(topGenre, "을", "를")} 가장 많이` : ""}`
    : minutes
      ? `${label}엔 ${hours} 읽었어요 — 다 읽은 책은 아직`
      : `${label}의 첫 책을 꺼내 볼까요?`;
  return { month, label, finished, minutes, pages, days, topGenre, topAuthor, line };
}
