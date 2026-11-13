"use client";

// 책 상세 — 상태·별점·읽은 쪽·한줄평·메모, YES24 소개(실시간 조회, 저장 안 함) + 'YES24에서 보기' (약관상 필수)

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { TopBar } from "@/components/Bars";
import { CoverSticker, Progress, Stars } from "@/components/Bits";
import { Tape, Yes24Credit } from "@/components/Deco";
import { RelatedBooks } from "@/components/Picks";
import ui from "@/components/ui.module.css";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { josa } from "@/lib/ko";
import { DEFAULT_PPM, formatMinutes, minutesLeft, readingSpeed, type Speed } from "@/lib/books/reading";
import { STATUS_LABEL, STATUS_ORDER, shortAuthor, type BookStatus, type LibraryBook, type Memo, type ReadingSession } from "@/lib/books/types";
import type { BookCandidate } from "@/lib/yes24/candidate";
import s from "../../screens.module.css";

const SOURCE: Record<string, string> = { spine: "책등으로 잰 두께", estimate: "쪽수로 어림한 두께", yes24: "YES24 두께", user: "직접 넣은 두께" };

export default function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [book, setBook] = useState<LibraryBook | null>(null);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [info, setInfo] = useState<BookCandidate | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [oneLiner, setOneLiner] = useState("");
  const [page, setPage] = useState("");
  const [pages, setPages] = useState("");
  const [memo, setMemo] = useState({ text: "", page: "" });
  const [introOpen, setIntroOpen] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [mins, setMins] = useState("");
  const [speed, setSpeed] = useState<Speed>({ ppm: DEFAULT_PPM, measured: false });

  useEffect(() => {
    let alive = true;
    api<{ book: LibraryBook; memos: Memo[] }>(`/api/library/${id}`)
      .then((r) => {
        if (!alive) return;
        setBook(r.book);
        setMemos(r.memos);
        setOneLiner(r.book.oneLiner ?? "");
        setPage(r.book.currentPage != null ? String(r.book.currentPage) : "");
        setPages(r.book.pages != null ? String(r.book.pages) : "");
        // YES24 소개·별점은 저장하지 않고 볼 때마다 (24시간 캐시)
        if (r.book.isbn13) {
          api<{ item: BookCandidate | null }>(`/api/books/isbn/${r.book.isbn13}`)
            .then((x) => alive && setInfo(x.item))
            .catch(() => {});
        }
        // 남은 시간 어림에 쓸 나의 읽는 속도
        api<{ sessions: ReadingSession[] }>("/api/sessions")
          .then((x) => alive && setSpeed(readingSpeed(x.sessions)))
          .catch(() => {});
      })
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [id]);

  async function patch(p: Partial<{ status: BookStatus; rating: number | null; oneLiner: string | null; pages: number | null; currentPage: number | null }>, msg?: string) {
    setErr(null);
    try {
      const r = await api<{ book: LibraryBook }>(`/api/library/${id}`, { method: "PATCH", json: p });
      setBook(r.book);
      if (msg) {
        setSaved(msg);
        setTimeout(() => setSaved(null), 1600);
      }
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  /** 타이머 없이 직접 적기 — 몇 쪽까지 · 몇 분 */
  async function record(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const n = Number(page);
      const r = await api<{ book: LibraryBook; session: ReadingSession }>(`/api/library/${id}/sessions`, {
        json: { toPage: n > 0 ? n : null, minutes: Number(mins) || 0 },
      });
      setBook(r.book);
      setPage(r.book.currentPage != null ? String(r.book.currentPage) : "");
      setMins("");
      setSaved(r.book.status === "read" ? "다 읽었어요! 책장에 별이 붙어요" : `${r.book.currentPage ?? 0}쪽까지 남겼어요`);
      setTimeout(() => setSaved(null), 2000);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function addMemo(e: FormEvent) {
    e.preventDefault();
    if (!memo.text.trim()) return;
    try {
      const n = Number(memo.page);
      const r = await api<{ memo: Memo }>(`/api/library/${id}/memos`, { json: { text: memo.text, page: n > 0 ? n : null } });
      setMemos([r.memo, ...memos]);
      setMemo({ text: "", page: "" });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function removeMemo(mid: string) {
    try {
      await api(`/api/memos/${mid}`, { method: "DELETE" });
      setMemos(memos.filter((m) => m.id !== mid));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function removeBook() {
    if (!book || !confirm(`『${book.title}』${josa(book.title, "을", "를")} 책장에서 뺄까요? 메모와 읽은 기록도 함께 지워져요.`)) return;
    try {
      await api(`/api/library/${id}`, { method: "DELETE" });
      router.push("/library");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (!book) {
    return (
      <>
        <TopBar back="/" title="책 이야기" />
        {err ? <p className={ui.error}>{err}</p> : <p className={ui.muted} style={{ marginTop: 24 }}>불러오는 중…</p>}
      </>
    );
  }

  const link = info?.link ?? book.link;
  const intro = info?.intro;
  const left = book.status !== "read" ? minutesLeft(book, speed) : null;

  return (
    <>
      <TopBar back="/" title="책 이야기" />

      <div className={s.detailHead}>
        <CoverSticker src={book.coverUrl} title={book.title} w={112} tilt={-3} />
        <div className={s.detailMeta}>
          <h1 className={s.handTitle}>{book.title}</h1>
          <span className={ui.muted}>{[shortAuthor(book.author), book.publisher].filter(Boolean).join(" · ")}</span>
          <div className={s.facts}>
            {book.pages && <span>{book.pages}쪽</span>}
            {book.thicknessMm != null && (
              <span>
                {book.thicknessMm}mm ({SOURCE[book.thicknessSource ?? "estimate"]})
              </span>
            )}
            {book.category && <span>{book.category.replace(/^국내도서-/, "")}</span>}
            {book.readMinutes > 0 && <span>읽은 시간 {formatMinutes(book.readMinutes)}</span>}
          </div>
          <Stars value={book.rating} onChange={(v) => patch({ rating: v })} size={26} />
        </div>
      </div>

      {err && <p className={ui.error}>{err}</p>}
      {saved && <p className={ui.muted}>✓ {saved}</p>}

      <div className={ui.chips} style={{ margin: "14px 0 4px" }}>
        {STATUS_ORDER.map((st) => (
          <button key={st} type="button" className={`${ui.chip} ${book.status === st ? ui.chipOn : ""}`} onClick={() => patch({ status: st })}>
            {STATUS_LABEL[st]}
          </button>
        ))}
      </div>

      <Link href={`/?read=${book.id}`} className={`${ui.btn} ${ui.btnWide}`} style={{ marginTop: 14 }}>
        책장에서 꺼내 읽기 ▸
      </Link>

      {(book.status !== "read" || !book.pages) && (
        <section className={`${ui.paper} ${s.section}`}>
          <Tape color="mint" />
          <span className={ui.paperLabel}>{book.pages ? "읽은 것 직접 적기" : "쪽수"}</span>
          {!book.pages ? (
            <form
              className={s.row2}
              onSubmit={(e) => {
                e.preventDefault();
                const n = Number(pages);
                if (n > 0) patch({ pages: n }, "쪽수를 넣었어요 — 탑 높이에 들어가요");
              }}
            >
              <input className={ui.field} inputMode="numeric" placeholder="전체 쪽수" value={pages} onChange={(e) => setPages(e.target.value.replace(/\D/g, ""))} />
              <button className={ui.btn}>넣기</button>
            </form>
          ) : (
            <>
              <Progress value={((book.currentPage ?? 0) / book.pages) * 100} />
              <p className={ui.muted} style={{ marginTop: 6 }}>
                {book.currentPage ?? 0} / {book.pages}쪽
                {left ? ` · 남은 시간 ${speed.measured ? "" : "어림 "}${formatMinutes(left)}` : ""}
              </p>
              <form className={s.row2} style={{ marginTop: 10 }} onSubmit={record}>
                <input className={ui.field} inputMode="numeric" placeholder="몇 쪽까지" value={page} onChange={(e) => setPage(e.target.value.replace(/\D/g, ""))} aria-label="몇 쪽까지" />
                <input className={ui.field} inputMode="numeric" placeholder="몇 분" value={mins} onChange={(e) => setMins(e.target.value.replace(/\D/g, ""))} aria-label="읽은 분" />
                <button className={ui.btn}>기록</button>
              </form>
            </>
          )}
        </section>
      )}

      <section className={`${ui.paper} ${s.section}`}>
        <Tape color="coral" />
        <span className={ui.paperLabel}>한줄평</span>
        <textarea className={ui.textarea} maxLength={120} placeholder="이 책을 한 줄로 남긴다면?" value={oneLiner} onChange={(e) => setOneLiner(e.target.value)} />
        <div className={s.row2} style={{ justifyContent: "space-between", marginTop: 8 }}>
          <span className={ui.muted}>{oneLiner.length}/120</span>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnGhost}`}
            disabled={oneLiner === (book.oneLiner ?? "")}
            onClick={() => patch({ oneLiner: oneLiner || null }, "한줄평을 남겼어요")}
          >
            남기기
          </button>
        </div>
      </section>

      <section className={`${ui.paper} ${s.section}`}>
        <Tape color="butter" />
        <span className={ui.paperLabel}>메모</span>
        <form onSubmit={addMemo} className={s.manual}>
          <textarea className={ui.textarea} placeholder="마음에 남은 문장이나 생각" value={memo.text} onChange={(e) => setMemo({ ...memo, text: e.target.value })} maxLength={1000} />
          <div className={s.row2}>
            <input className={ui.field} inputMode="numeric" placeholder="쪽 (선택)" value={memo.page} onChange={(e) => setMemo({ ...memo, page: e.target.value.replace(/\D/g, "") })} />
            <button className={ui.btn} disabled={!memo.text.trim()}>
              적기
            </button>
          </div>
        </form>
        {memos.length > 0 && <hr className={ui.dashed} />}
        {memos.map((m) => (
          <div key={m.id} className={s.memo}>
            <p>
              {m.text}
              <br />
              <span className={ui.muted}>
                {m.page ? `p.${m.page} · ` : ""}
                {m.createdAt.slice(0, 10)}
              </span>
            </p>
            <button type="button" className={ui.textBtn} onClick={() => removeMemo(m.id)} aria-label="메모 지우기">
              지우기
            </button>
          </div>
        ))}
      </section>

      {(intro || link) && (
        <section className={`${ui.paper} ${s.section}`}>
          <Tape color="sky" />
          <span className={ui.paperLabel}>책 소개</span>
          {intro && (
            <>
              <p className={`${s.intro} ${introOpen ? s.introOpen : ""}`}>{intro}</p>
              {intro.length > 160 && (
                <button type="button" className={ui.textBtn} onClick={() => setIntroOpen(!introOpen)}>
                  {introOpen ? "접기" : "더 보기"}
                </button>
              )}
            </>
          )}
          {info?.yes24Rating ? <p className={ui.muted}>YES24 회원 별점 {info.yes24Rating} / 10</p> : null}
          {link && (
            <a href={link} target="_blank" rel="noreferrer" className={s.yesLink}>
              YES24에서 보기 ›
            </a>
          )}
        </section>
      )}

      {/* 이어지는 책 — 같은 책을 읽은 친구 · 그 친구들이 좋아한 책 · 같은 작가의 다른 책 (11-13) */}
      <RelatedBooks bookId={book.id} className={`${ui.paper} ${s.section}`} />

      <div style={{ textAlign: "center", marginTop: 22 }}>
        <button type="button" className={ui.textBtn} onClick={removeBook}>
          책장에서 빼기
        </button>
      </div>
      {(book.coverUrl || link) && <Yes24Credit />}
    </>
  );
}
