"use client";

// 개발 확인용 화면 (Phase 0) — 디자인 확정 전 임시. 실제 화면은 Phase 1 에서 새로 만든다.
// 검색 → 같은 책 판본 묶음(workKey) → 상세(쪽수·두께·책등) → ISBN 직접 조회(바코드 대신)

import { useState, type FormEvent } from "react";
import type { BookCandidate, BookSource } from "@/lib/yes24/candidate";
import s from "./page.module.css";

type Attribution = { text: string; url: string };
type SearchRes = { source: BookSource; items: BookCandidate[]; totalCount: number | null; cached: boolean; attribution: Attribution };
type DetailRes = { source: BookSource; item: BookCandidate | null; cached: boolean; attribution: Attribution };
type ApiError = { error: string; message?: string };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = (await res.json()) as T | ApiError;
  if (!res.ok && res.status !== 404) throw new Error((body as ApiError).message || (body as ApiError).error || `HTTP ${res.status}`);
  return body as T;
}

export default function DevBooks() {
  const [q, setQ] = useState("데미안");
  const [isbn, setIsbn] = useState("9788937460449");
  const [search, setSearch] = useState<SearchRes | null>(null);
  const [detail, setDetail] = useState<DetailRes | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setErr(null);
    try {
      return await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    const r = await run(() => getJson<SearchRes>(`/api/books/search?q=${encodeURIComponent(q)}`));
    if (r) {
      setSearch(r);
      setDetail(null);
    }
  }

  async function openIsbn(v: string) {
    const r = await run(() => getJson<DetailRes>(`/api/books/isbn/${encodeURIComponent(v)}`));
    if (r) setDetail(r);
  }

  const sameWork = new Map<string, number>();
  search?.items.forEach((b) => sameWork.set(b.workKey, (sameWork.get(b.workKey) ?? 0) + 1));
  const source = detail?.source ?? search?.source;

  return (
    <main className={s.wrap}>
      <h1 className={s.h1}>개발 확인 · 책 데이터</h1>
      {source === "mock" && <p className={s.mock}>샘플 모드 — YES24_API_KEY 가 없어 가짜 데이터로 보여 줘요 (.env.local 에 키를 넣으면 진짜로)</p>}

      <form onSubmit={onSearch} className={s.row}>
        <input className={s.input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목·저자" />
        <button className={s.btn} disabled={busy}>검색</button>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          openIsbn(isbn);
        }}
        className={s.row}
      >
        <input className={s.input} value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="ISBN (바코드 대신)" inputMode="numeric" />
        <button className={s.btn} disabled={busy}>ISBN 조회</button>
      </form>
      {err && <p className={s.err}>{err}</p>}

      {detail && (
        <section className={s.detail}>
          {detail.item ? <Detail b={detail.item} cached={detail.cached} /> : <p>YES24 에 없는 ISBN 이에요 → 직접 입력 흐름으로</p>}
        </section>
      )}

      {search && (
        <section>
          <p className={s.meta}>
            {search.items.length}건{search.totalCount != null ? ` / 전체 ${search.totalCount}` : ""} · {search.source}
            {search.cached ? " · 캐시" : ""}
          </p>
          <ul className={s.list}>
            {search.items.map((b, i) => (
              <li key={`${b.itemId}-${i}`} className={s.item}>
                <Thumb url={b.coverUrl} />
                <div className={s.body}>
                  <b>{b.title}</b>
                  <span className={s.sub}>{[b.author, b.publisher, b.publishDate].filter(Boolean).join(" · ")}</span>
                  <span className={s.code}>
                    {b.workKey}
                    {(sameWork.get(b.workKey) ?? 0) > 1 && <em className={s.tag}> 같은 책 {sameWork.get(b.workKey)}판</em>}
                  </span>
                  <span className={s.sub}>
                    {b.isbn13 ?? "ISBN 없음"} · {b.pages ? `${b.pages}쪽` : "쪽수는 상세에서"}
                  </span>
                </div>
                {b.isbn13 && (
                  <button className={s.btnSm} disabled={busy} onClick={() => openIsbn(b.isbn13!)}>
                    상세
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className={s.foot}>
        <a href="https://www.yes24.com" target="_blank" rel="noreferrer">
          도서 정보·이미지 제공: YES24
        </a>
      </footer>
    </main>
  );
}

function Thumb({ url, tall }: { url: string | null; tall?: boolean }) {
  if (!url) return <span className={tall ? s.spineBox : s.thumbBox} />;
  // eslint-disable-next-line @next/next/no-img-element -- YES24 이미지 URL 을 그대로 쓴다 (약관상 응답 URL 사용)
  return <img src={url} alt="" className={tall ? s.spine : s.thumb} loading="lazy" />;
}

const SOURCE_LABEL: Record<NonNullable<BookCandidate["thicknessSource"]>, string> = {
  spine: "책등 이미지 비율",
  estimate: "쪽수로 추정",
  yes24: "YES24 크기",
  user: "직접 입력",
};

function Detail({ b, cached }: { b: BookCandidate; cached: boolean }) {
  const d = b.dims;
  return (
    <div className={s.detailIn}>
      <div className={s.images}>
        <Thumb url={b.coverUrl} />
        <Thumb url={b.sideCoverUrl} tall />
        <Thumb url={b.backCoverUrl} />
      </div>
      <div className={s.body}>
        <b>{b.title}</b>
        {b.subTitle && <span className={s.sub}>{b.subTitle}</span>}
        <span className={s.sub}>{[b.author, b.publisher, b.publishDate, b.category].filter(Boolean).join(" · ")}</span>
        <span>
          쪽수 <b>{b.pages ?? "없음 → 사용자에게 묻기"}</b> · 두께 <b>{b.thicknessMm != null ? `${b.thicknessMm}mm` : "모름"}</b>
          {b.thicknessSource ? ` (${SOURCE_LABEL[b.thicknessSource]})` : ""}
        </span>
        <span className={s.code}>
          YES24 크기 가로 {d.width ?? "-"} · 두께 {d.height ?? "-"} · 세로 {d.length ?? "-"} mm · 무게 {d.weight ?? "-"} g
          {b.spinePx ? ` · 책등 ${b.spinePx.w}×${b.spinePx.h}px` : b.sideCoverUrl ? "" : " · 책등 이미지 없음"}
        </span>
        <span className={s.code}>{b.workKey} · {b.isbn13}{cached ? " · 캐시" : ""}</span>
        {b.intro && <p className={s.intro}>{b.intro.slice(0, 200)}{b.intro.length > 200 ? "…" : ""}</p>}
        {b.link && (
          <a href={b.link} target="_blank" rel="noreferrer" className={s.link}>
            YES24에서 보기
          </a>
        )}
      </div>
    </div>
  );
}
