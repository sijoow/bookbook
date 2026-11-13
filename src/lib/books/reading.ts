// 독서 시간 계산 — 책장에서 책을 꺼내 읽고(타이머) 덮을 때 '몇 쪽까지'를 남기면 쌓이는 기록으로
// 나만의 읽는 속도(쪽/분)를 구하고, 남은 시간·한 권 평균을 어림한다. 순수 함수라 서버·화면 어디서나.

export type SessionLite = { bookId: string; minutes: number; pagesRead: number; endedAt: string };

/** 기록이 쌓이기 전 어림값: 한 쪽에 약 1.4분 (0.7쪽/분) */
export const DEFAULT_PPM = 0.7;
const MIN_MINUTES = 15; // 이만큼은 읽어야 내 속도로 친다
const MIN_PAGES = 10;

export type Speed = { ppm: number; measured: boolean };

export function readingSpeed(sessions: SessionLite[]): Speed {
  const used = sessions.filter((s) => s.minutes > 0 && s.pagesRead > 0);
  const minutes = used.reduce((t, s) => t + s.minutes, 0);
  const pages = used.reduce((t, s) => t + s.pagesRead, 0);
  if (minutes < MIN_MINUTES || pages < MIN_PAGES) return { ppm: DEFAULT_PPM, measured: false };
  return { ppm: pages / minutes, measured: true };
}

/** 남은 쪽 ÷ 속도 — 쪽수를 모르면 null */
export function minutesLeft(book: { pages: number | null; currentPage: number | null }, speed: Speed): number | null {
  if (!book.pages) return null;
  const left = Math.max(0, book.pages - (book.currentPage ?? 0));
  return Math.round(left / speed.ppm);
}

/** 다 읽은 책 중 시간 기록이 있는 책의 평균 (권당 분). 없으면 null */
export function minutesPerBook(books: Array<{ status: string; readMinutes: number }>): number | null {
  const done = books.filter((b) => b.status === "read" && b.readMinutes > 0);
  if (!done.length) return null;
  return Math.round(done.reduce((t, b) => t + b.readMinutes, 0) / done.length);
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** 오늘을 끝으로 7일 — 날마다 읽은 분 (기기 시간대 기준) */
export function lastWeek(sessions: SessionLite[], now: Date): Array<{ day: string; label: string; minutes: number }> {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    return { day: ymd(d), label: "일월화수목금토"[d.getDay()], minutes: 0 };
  });
  const byDay = new Map(days.map((d) => [d.day, d]));
  for (const s of sessions) {
    const hit = byDay.get(ymd(new Date(s.endedAt)));
    if (hit) hit.minutes += s.minutes;
  }
  return days;
}

/** 135 → '2시간 15분', 45 → '45분', 0 → '0분' */
export function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  if (!h) return `${r}분`;
  return r ? `${h}시간 ${r}분` : `${h}시간`;
}

/** 타이머 표시 mm:ss 또는 h:mm:ss */
export function formatClock(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
