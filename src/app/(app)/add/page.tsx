"use client";
/* eslint-disable @next/next/no-img-element -- 우리 그림 (작은 webp) */

// 책 추가 — 검색 → 고르면 상세(쪽수·두께·책등) → 상태 고르기 → 내 우주에 쌓기. 검색에 없으면 직접 입력.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { TopBar } from "@/components/Bars";
import { CoverSticker } from "@/components/Bits";
import { Tape, Yes24Credit } from "@/components/Deco";
import { MenuIcon } from "@/components/MenuIcon";
import ui from "@/components/ui.module.css";
import { api } from "@/lib/client/api";
import { STATUS_LABEL, shortAuthor, type BookStatus, type LibraryBook } from "@/lib/books/types";
import type { BookCandidate } from "@/lib/yes24/candidate";
import s from "../screens.module.css";

const ADD_STATUSES: BookStatus[] = ["read", "reading", "want"];

export default function AddBook() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<BookCandidate[] | null>(null);
  const [picked, setPicked] = useState<BookCandidate | null>(null);
  const [detail, setDetail] = useState<BookCandidate | null>(null);
  const [status, setStatus] = useState<BookStatus>("read");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dup, setDup] = useState<LibraryBook | null>(null);
  const [manual, setManual] = useState(false);
  const [m, setM] = useState({ title: "", author: "", pages: "" });
  const [scanning, setScanning] = useState(false);
  const [from, setFrom] = useState<"search" | "barcode">("search");
  const [manualIsbn, setManualIsbn] = useState<string | null>(null); // 바코드는 찍었는데 YES24 에 없는 책
  const [note, setNote] = useState<string | null>(null);

  /** 바코드를 읽으면 — 상세(쪽수·두께·책등)를 불러와 고르기 카드로. YES24 에 없으면 직접 적기로 (ISBN 은 같이 저장) */
  async function onBarcode(isbn: string) {
    setScanning(false);
    setErr(null);
    setDup(null);
    setResults(null);
    setManual(false);
    setNote(null);
    setFrom("barcode");
    setBusy(true);
    try {
      const r = await api<{ item: BookCandidate | null }>(`/api/books/isbn/${isbn}`);
      if (!r.item) throw new Error("없음");
      setPicked(r.item);
      setDetail(r.item);
    } catch {
      setPicked(null);
      setDetail(null);
      setManualIsbn(isbn);
      setManual(true);
      setNote(`YES24 에 없는 책이에요 (ISBN ${isbn}). 제목과 쪽수를 적어 주세요.`);
    } finally {
      setBusy(false);
    }
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    await runSearch(q);
  }

  /** 추천 칩·검색창 — 글자로 찾기 */
  async function runSearch(text: string) {
    if (!text.trim()) return;
    setBusy(true);
    setErr(null);
    setPicked(null);
    setDetail(null);
    setFrom("search");
    setNote(null);
    try {
      const r = await api<{ items: BookCandidate[] }>(`/api/books/search?q=${encodeURIComponent(text.trim())}`);
      setResults(r.items);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function pick(b: BookCandidate) {
    setPicked(b);
    setDetail(null);
    setDup(null);
    if (!b.isbn13) return;
    try {
      const r = await api<{ item: BookCandidate | null }>(`/api/books/isbn/${b.isbn13}`);
      if (r.item) setDetail(r.item);
    } catch {
      // 상세가 안 나와도 추가할 때 서버가 상품 번호로 다시 찾는다
    }
  }

  async function add() {
    if (!picked) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ book: LibraryBook; duplicate: boolean }>("/api/library", {
        json: { isbn13: picked.isbn13 ?? undefined, itemId: picked.itemId && picked.itemId > 0 ? picked.itemId : undefined, status, from },
      });
      if (r.duplicate) setDup(r.book);
      else router.push(status === "want" ? "/library" : "/");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addManual(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const pages = Number(m.pages);
      await api("/api/library", {
        json: { manual: { title: m.title, author: m.author || null, pages: pages > 0 ? pages : null, isbn13: manualIsbn }, status },
      });
      router.push(status === "want" ? "/library" : "/");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const shown = detail ?? picked;

  return (
    <>
      <TopBar back="/" title="책 추가" />

      {!manual ? (
        <form onSubmit={search} className={s.searchRow}>
          <input id="book-q" className={ui.field} value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목이나 저자로 찾기" enterKeyHint="search" />
          <button className={ui.btn} disabled={busy || !q.trim()}>
            찾기
          </button>
        </form>
      ) : null}

      <div className={s.row2} style={{ justifyContent: "space-between" }}>
        <button type="button" className={ui.textBtn} onClick={() => setManual((v) => !v)}>
          {manual ? "← 검색으로 찾기" : "찾는 책이 없나요? 직접 적기"}
        </button>
        <button type="button" className={`${ui.btn} ${ui.btnGhost}`} style={{ minHeight: 40, fontSize: 18 }} onClick={() => setScanning(true)}>
          바코드로 찾기
        </button>
      </div>

      {err && <p className={ui.error}>{err}</p>}
      {note && <p className={ui.muted} style={{ marginTop: 10 }}>{note}</p>}
      {scanning && <BarcodeScanner onFound={onBarcode} onClose={() => setScanning(false)} />}

      {manual && (
        <form onSubmit={addManual} className={`${ui.paper} ${s.manual}`} style={{ marginTop: 18 }}>
          <Tape color="mint" />
          <span className={ui.paperLabel}>직접 적기</span>
          <input className={ui.field} placeholder="제목" value={m.title} onChange={(e) => setM({ ...m, title: e.target.value })} required />
          <input className={ui.field} placeholder="저자 (선택)" value={m.author} onChange={(e) => setM({ ...m, author: e.target.value })} />
          <input
            className={ui.field}
            placeholder="쪽수 — 남은 시간 계산에 써요"
            inputMode="numeric"
            value={m.pages}
            onChange={(e) => setM({ ...m, pages: e.target.value.replace(/\D/g, "") })}
          />
          <StatusChips value={status} onChange={setStatus} />
          <button className={`${ui.btn} ${ui.btnWide}`} disabled={busy || !m.title.trim()}>
            책장에 꽂기 ▸
          </button>
        </form>
      )}

      {!manual && results && (
        <div className={s.results}>
          {results.length === 0 && <p className={ui.muted}>찾는 책이 없어요. 직접 적어도 돼요.</p>}
          {results.map((b, i) => (
            <button
              key={`${b.itemId}-${i}`}
              type="button"
              className={`${s.result} ${picked?.itemId === b.itemId ? s.resultOn : ""}`}
              onClick={() => pick(b)}
            >
              <CoverSticker src={b.coverUrl} title={b.title} w={46} tilt={0} />
              <span className={s.nowBody}>
                <span className={s.bookTitle}>{b.title}</span>
                <span className={ui.muted}>{[shortAuthor(b.author), b.publisher, b.publishDate?.slice(0, 4)].filter(Boolean).join(" · ")}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {!manual && shown && (
        <div className={`${ui.paper} ${s.pick}`}>
          <Tape color="butter" />
          <div className={s.pickHead}>
            <CoverSticker src={shown.coverUrl} title={shown.title} w={56} />
            <div className={s.nowBody}>
              <span className={s.bookTitle}>{shown.title}</span>
              <span className={ui.muted}>
                {detail
                  ? detail.thicknessMm
                    ? `${detail.pages ? `${detail.pages}쪽 · ` : ""}두께 ${detail.thicknessMm}mm`
                    : "쪽수를 몰라요 — 추가한 뒤 넣어 주세요"
                  : "책 정보를 불러오는 중…"}
              </span>
            </div>
          </div>
          <StatusChips value={status} onChange={setStatus} />
          {dup ? (
            <p className={ui.muted} style={{ marginTop: 12 }}>
              이미 서재에 있는 책이에요 —{" "}
              <Link href={`/book/${dup.id}`} style={{ textDecoration: "underline" }}>
                보러 가기
              </Link>
            </p>
          ) : (
            <button type="button" className={`${ui.btn} ${ui.btnWide}`} style={{ marginTop: 14 }} disabled={busy} onClick={add}>
              {status === "want" ? "읽고 싶은 책으로 꽂기 ▸" : "책장에 꽂기 ▸"}
            </button>
          )}
        </div>
      )}

      {/* 아직 안 찾았을 때 — 그림 + 세 가지 방법 + 추천 칩 */}
      {!manual && !results && !busy && !scanning && (
        <section className={`${ui.paper} ${s.addEmpty}`}>
          <Tape color="butter" />
          <img src="/img/add-hero.webp" alt="" className={s.addHero} />
          <p className={s.addTitle}>어떤 책을 꽂을까요?</p>
          <p className={ui.muted} style={{ textAlign: "center" }}>
            꽂으면 책장에 책등이 쏙 — 친구와 같은 책이면 통로가 열려요
          </p>
          <div className={s.addWays}>
            <button type="button" className={s.addWay} onClick={() => document.getElementById("book-q")?.focus()}>
              <MenuIcon name="zoom" />
              <b>제목으로 찾기</b>
              <span>제목·저자 한 단어면 돼요</span>
            </button>
            <button type="button" className={s.addWay} onClick={() => setScanning(true)}>
              <MenuIcon name="add-book" />
              <b>바코드 찍기</b>
              <span>책 뒤 ISBN 바코드</span>
            </button>
            <button type="button" className={s.addWay} onClick={() => setManual(true)}>
              <MenuIcon name="log" />
              <b>직접 적기</b>
              <span>찾는 책이 없을 때</span>
            </button>
          </div>
          <p className={s.addAsk}>이런 책은 어때요?</p>
          <div className={s.addChips}>
            {PICKS.map((t) => (
              <button
                key={t}
                type="button"
                className={ui.chip}
                onClick={() => {
                  setQ(t);
                  void runSearch(t);
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </section>
      )}

      {results && results.length > 0 && <Yes24Credit />}
    </>
  );
}

/** 빈 화면 추천 — 누르면 그 제목으로 바로 찾는다 (책 목록을 쌓아 두지 않는다 — YES24 약관) */
const PICKS = ["어린 왕자", "데미안", "아몬드", "불편한 편의점", "프로젝트 헤일메리", "코스모스", "모순", "급류"];

function StatusChips({ value, onChange }: { value: BookStatus; onChange: (s: BookStatus) => void }) {
  return (
    <div className={ui.chips}>
      {ADD_STATUSES.map((st) => (
        <button key={st} type="button" className={`${ui.chip} ${value === st ? ui.chipOn : ""}`} onClick={() => onChange(st)}>
          {STATUS_LABEL[st]}
        </button>
      ))}
    </div>
  );
}
