"use client";

// 서재 — 상태별로 보기 + 많이 읽은 분야 (북적북적 리뷰에서 자주 나온 '장르별 통계' 요청)

import Link from "next/link";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/Bars";
import { CoverSticker, Stars } from "@/components/Bits";
import { Sparkle, Tape, Yes24Credit } from "@/components/Deco";
import ui from "@/components/ui.module.css";
import { api } from "@/lib/client/api";
import { STATUS_LABEL, STATUS_ORDER, type BookStatus, type LibraryBook } from "@/lib/books/types";
import s from "../screens.module.css";

type Filter = "all" | BookStatus;

export default function Library() {
  const [books, setBooks] = useState<LibraryBook[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let alive = true;
    api<{ books: LibraryBook[] }>("/api/library")
      .then((d) => alive && setBooks(d.books))
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const all = books ?? [];
  const count = (f: Filter) => (f === "all" ? all.length : all.filter((b) => b.status === f).length);
  const shown = (filter === "all" ? all : all.filter((b) => b.status === filter)).slice().reverse();

  // 많이 읽은 분야 — '국내도서-소설/시/희곡' → '소설/시/희곡'
  const genres = new Map<string, number>();
  for (const b of all) {
    if (b.status !== "read" || !b.category) continue;
    const g = b.category.replace(/^국내도서-/, "");
    genres.set(g, (genres.get(g) ?? 0) + 1);
  }
  const topGenres = [...genres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <>
      <TopBar
        title="내 서재"
        right={
          <Link href="/add" className={ui.iconBtn} aria-label="책 추가">
            +
          </Link>
        }
      />

      <div className={ui.chips} style={{ marginTop: 16 }}>
        {(["all", ...STATUS_ORDER] as Filter[]).map((f) => (
          <button key={f} type="button" className={`${ui.chip} ${filter === f ? ui.chipOn : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "전체" : STATUS_LABEL[f]} {count(f)}
          </button>
        ))}
      </div>

      {err && <p className={ui.error}>{err}</p>}

      {topGenres.length > 0 && filter !== "want" && (
        <section className={`${ui.paper} ${s.section}`}>
          <Tape color="mint" />
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

      {books && shown.length === 0 && (
        <div className={s.empty}>
          <Sparkle size={26} />
          <p className={s.handTitle}>{filter === "all" ? "아직 책이 없어요" : `${STATUS_LABEL[filter as BookStatus]} 책이 없어요`}</p>
          <Link href="/add" className={ui.btn}>
            책 추가하기 ▸
          </Link>
        </div>
      )}

      <div className={s.grid3}>
        {shown.map((b, i) => (
          <Link key={b.id} href={`/book/${b.id}`} className={s.gridItem}>
            <CoverSticker src={b.coverUrl} title={b.title} w={86} tilt={[-2, 1.5, -1][i % 3]} />
            <span>{b.title}</span>
            {b.rating ? <Stars value={b.rating} size={12} /> : null}
          </Link>
        ))}
      </div>

      {all.some((b) => b.coverUrl) && <Yes24Credit />}
    </>
  );
}
