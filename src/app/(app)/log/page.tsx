"use client";

// 기록 — 책장에서 꺼내 읽은 시간이 쌓인 곳. 이번 주 날마다 · 나의 읽는 속도 · 한 권 평균 · 많이 읽은 분야 · 최근 기록

import Link from "next/link";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/Bars";
import { MonthCard } from "@/components/MonthCard";
import { Tape } from "@/components/Deco";
import ui from "@/components/ui.module.css";
import { api } from "@/lib/client/api";
import { DEFAULT_PPM, formatMinutes, lastWeek, minutesPerBook, readingSpeed } from "@/lib/books/reading";
import { monthReport } from "@/lib/books/report";
import type { LibraryBook, ReadingSession } from "@/lib/books/types";
import s from "../screens.module.css";

export default function Log() {
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [sessions, setSessions] = useState<ReadingSession[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // 렌더 중 new Date() 는 cacheComponents 미리 그리기에서 오류 → 불러온 뒤 콜백에서 기준 시각을 정한다
  const [asOf, setAsOf] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api<{ books: LibraryBook[] }>("/api/library"), api<{ sessions: ReadingSession[] }>("/api/sessions")])
      .then(([l, x]) => {
        if (!alive) return;
        setBooks(l.books);
        setSessions(x.sessions);
        setAsOf(Date.now());
      })
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, []);

  async function remove(id: string) {
    if (!confirm("이 기록을 지울까요? 그 책의 읽은 시간에서도 빠져요.")) return;
    try {
      await api(`/api/sessions/${id}`, { method: "DELETE" });
      setSessions((xs) => xs?.filter((x) => x.id !== id) ?? xs);
      const l = await api<{ books: LibraryBook[] }>("/api/library");
      setBooks(l.books);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const list = sessions ?? [];
  const lite = list.map((x) => ({ bookId: x.bookId, minutes: x.minutes, pagesRead: x.pagesRead, endedAt: x.endedAt }));
  const week = asOf ? lastWeek(lite, new Date(asOf)) : [];
  const weekTotal = week.reduce((t, d) => t + d.minutes, 0);
  const max = Math.max(30, ...week.map((d) => d.minutes));
  const speed = readingSpeed(lite);
  const perBook = minutesPerBook(books);
  const total = books.reduce((t, b) => t + b.readMinutes, 0);
  const title = new Map(books.map((b) => [b.id, b.title]));

  const genres = new Map<string, number>();
  for (const b of books) {
    if (b.status !== "read" || !b.category) continue;
    const g = b.category.replace(/^국내도서-/, "");
    genres.set(g, (genres.get(g) ?? 0) + 1);
  }
  const topGenres = [...genres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <>
      <TopBar title="기록" />
      {err && <p className={ui.error}>{err}</p>}

      {/* 이달의 독서 카드 (11-13) — 기준 시각은 불러온 뒤 정한 asOf */}
      {asOf && <MonthCard r={monthReport(books, sessions ?? [], new Date(asOf))} />}

      <section className={`${ui.paper} ${s.section}`}>
        <Tape color="apricot" />
        <span className={ui.paperLabel}>이번 주</span>
        <p className={s.bigStat}>{formatMinutes(weekTotal)}</p>
        <div className={s.week}>
          {week.map((d, i) => (
            <div key={d.day} className={s.weekCol} title={`${d.day} ${formatMinutes(d.minutes)}`}>
              {d.minutes > 0 && <span>{d.minutes}분</span>}
              <div className={`${s.weekBar} ${i === 6 ? s.weekBarToday : ""}`} style={{ height: `${Math.round((d.minutes / max) * 100)}px` }} />
              <span className={s.weekDay}>{d.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={`${ui.paper} ${s.section}`}>
        <Tape color="mint" />
        <span className={ui.paperLabel}>나의 읽는 속도</span>
        {speed.measured ? (
          <>
            <p className={s.bigStat}>1분에 {speed.ppm.toFixed(1)}쪽</p>
            <p className={ui.muted}>한 쪽에 약 {Math.round(60 / speed.ppm)}초 — 남은 시간은 이 속도로 어림해요</p>
          </>
        ) : (
          <p style={{ fontSize: 14 }}>
            책을 꺼내 읽고 &lsquo;몇 쪽까지&rsquo;를 남기면 나만의 속도를 알려 줄게요. 지금은 보통 속도(1분에 {DEFAULT_PPM}쪽)로 어림해요.
          </p>
        )}
        <hr className={ui.dashed} />
        <p style={{ fontSize: 14 }}>
          한 권 다 읽는 데 평균 <b>{perBook ? formatMinutes(perBook) : "—"}</b> · 지금까지 <b>{formatMinutes(total)}</b>
        </p>
      </section>

      {topGenres.length > 0 && (
        <section className={`${ui.paper} ${s.section}`}>
          <Tape color="butter" />
          <span className={ui.paperLabel}>많이 읽은 분야</span>
          <div className={ui.chips}>
            {topGenres.map(([g, n], i) => (
              <span key={g} className={ui.chip} style={{ background: ["var(--butter)", "var(--mint)", "var(--coral)", "var(--sky)"][i] }}>
                {g} {n}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className={`${ui.paper} ${s.section}`}>
        <Tape color="sky" />
        <span className={ui.paperLabel}>최근 기록</span>
        {sessions && list.length === 0 && <p className={ui.muted}>아직 기록이 없어요. 책장에서 책을 꺼내 읽어 보세요.</p>}
        {list.slice(0, 20).map((x) => {
          const d = new Date(x.endedAt);
          return (
            <div key={x.id} className={s.logRow}>
              <span>
                <span className={ui.muted}>
                  {d.getMonth() + 1}.{d.getDate()} {String(d.getHours()).padStart(2, "0")}:{String(d.getMinutes()).padStart(2, "0")}
                </span>{" "}
                <Link href={`/book/${x.bookId}`}>{title.get(x.bookId) ?? "지운 책"}</Link>
              </span>
              <span style={{ whiteSpace: "nowrap" }}>
                {formatMinutes(x.minutes)} · {x.toPage}쪽까지{" "}
                <button type="button" className={ui.textBtn} onClick={() => remove(x.id)} aria-label="기록 지우기">
                  지우기
                </button>
              </span>
            </div>
          );
        })}
      </section>
    </>
  );
}
