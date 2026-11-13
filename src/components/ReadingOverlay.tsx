"use client";
/* eslint-disable @next/next/no-img-element -- YES24 표지·책등은 응답 URL 그대로 (약관) */

// 꺼내 읽기 연출 — 책장에서 꺼낸 책이 책등 자리에서 화면 가운데로 날아오며 표지로 바뀌고(out),
// 타이머가 도는 동안 읽고(reading), 덮을 때 '몇 쪽까지'를 남기면 다시 제자리로 날아가 꽂힌다(back).
// prefers-reduced-motion 이면 날아가는 연출 없이 바로.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatClock, formatMinutes, minutesLeft, type Speed } from "@/lib/books/reading";
import { shortAuthor, type LibraryBook } from "@/lib/books/types";
import { Progress } from "./Bits";
import { Sparkle, StarDoodle } from "./Deco";
import s from "./shelf.module.css";
import ui from "./ui.module.css";

export type FlowPhase = "out" | "reading" | "back";
export type Flow = { book: LibraryBook; phase: FlowPhase; startedAt: number; from: DOMRect | null };
export type FinishInput = { toPage: number | null; minutes: number; finished: boolean };

const COVER_W = 150;
const COVER_H = Math.round(COVER_W * 1.45);
const COVER_TOP = 64;

export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function target() {
  const vw = typeof window !== "undefined" ? window.innerWidth : 390;
  return { left: Math.round((vw - COVER_W) / 2), top: COVER_TOP, width: COVER_W, height: COVER_H };
}

/** 날아가는 책: from(책등 자리) ↔ 가운데 표지 자리. mode 가 reading 이면 가운데에 가만히 */
function FlyingBook({ book, from, mode, onDone }: { book: LibraryBook; from: DOMRect | null; mode: FlowPhase; onDone?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const spine = useRef<HTMLImageElement>(null);
  const done = useRef(onDone);
  const t = target();

  useLayoutEffect(() => {
    done.current = onDone;
  });

  useLayoutEffect(() => {
    if (mode === "reading") return;
    const el = box.current;
    if (!el || !from || reducedMotion()) {
      done.current?.();
      return;
    }
    const at = `translate(${from.left - t.left}px, ${from.top - t.top}px) scale(${from.width / t.width}, ${from.height / t.height})`;
    const center = "translate(0px, 0px) scale(1, 1)";
    const frames = mode === "out" ? [{ transform: at }, { transform: center }] : [{ transform: center }, { transform: at }];
    const fly = el.animate(frames, { duration: 560, easing: "cubic-bezier(.22,.8,.24,1)", fill: "forwards" });
    // 처음엔 책등 그림, 커지면서 표지로 (돌아갈 땐 반대로)
    const fadeFrames = mode === "out" ? [{ opacity: 1 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 0, offset: 0.65 }, { opacity: 1 }];
    const fade = spine.current?.animate(fadeFrames, { duration: 560, fill: "forwards" });
    fly.finished.then(() => done.current?.()).catch(() => {});
    return () => {
      fly.cancel();
      fade?.cancel();
    };
    // from·mode 가 바뀔 때만 (target 은 화면 폭으로 매번 같다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, mode]);

  return (
    <div ref={box} className={s.flying} style={{ left: t.left, top: t.top, width: t.width, height: t.height }}>
      {book.coverUrl ? (
        <img src={book.coverUrl} alt={book.title} className={s.flyCover} />
      ) : (
        <span className={`${s.flyCover} ${s.flyBlank}`}>{book.title}</span>
      )}
      {mode !== "reading" && book.sideCoverUrl && <img ref={spine} src={book.sideCoverUrl} alt="" className={s.flySpine} style={{ opacity: mode === "back" ? 0 : 1 }} />}
    </div>
  );
}

export function ReadingOverlay({
  flow,
  speed,
  busy,
  error,
  onOutDone,
  onBackDone,
  onFinish,
  onPutBack,
}: {
  flow: Flow;
  speed: Speed;
  busy: boolean;
  error: string | null;
  onOutDone: () => void;
  onBackDone: () => void;
  onFinish: (input: FinishInput) => void;
  onPutBack: () => void;
}) {
  const t = target();
  return (
    <div className={`${s.overlay} ${s.fade}`} role="dialog" aria-modal="true" aria-label={`${flow.book.title} 읽는 중`}>
      <FlyingBook
        key={flow.phase}
        book={flow.book}
        from={flow.from}
        mode={flow.phase}
        onDone={flow.phase === "out" ? onOutDone : flow.phase === "back" ? onBackDone : undefined}
      />
      {flow.phase === "reading" && (
        <div className={`${s.panel} ${s.fade}`} style={{ paddingTop: t.top + t.height + 22 }}>
          <ReadingPanel book={flow.book} startedAt={flow.startedAt} speed={speed} busy={busy} error={error} onFinish={onFinish} onPutBack={onPutBack} />
        </div>
      )}
    </div>
  );
}

/** 읽는 동안 — 제목·타이머·진도, '책 덮기'를 누르면 '오늘은 몇 쪽까지' (2D 꺼내기 연출과 입체 도서관이 함께 쓴다) */
export function ReadingPanel({
  book,
  startedAt,
  speed,
  busy,
  error,
  onFinish,
  onPutBack,
  onClosing,
  compact = false,
  onMode,
  onCollapse,
}: {
  book: LibraryBook;
  startedAt: number;
  speed: Speed;
  busy: boolean;
  error: string | null;
  onFinish: (input: FinishInput) => void;
  onPutBack: () => void;
  onClosing?: () => void; // '책 덮기'를 눌렀을 때 (아바타 한마디)
  compact?: boolean; // 입체 홈 — 읽는 동안엔 작은 줄만 (타이머는 아바타 머리 위)
  onMode?: (closing: boolean) => void; // '몇 쪽까지' 창이 열렸다/닫혔다
  onCollapse?: () => void; // 작은 줄 접기 (∨) — 입체 홈은 다시 ^ 손잡이만
}) {
  const [now, setNow] = useState(() => Date.now());
  const [closing, setClosing] = useState(false);
  const [toPage, setToPage] = useState(String(book.currentPage ?? ""));
  const [minutes, setMinutes] = useState("");
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedMin = Math.max(0, Math.round((now - startedAt) / 60000));
  const left = minutesLeft(book, speed);
  const page = Number(toPage);

  function close() {
    setMinutes(String(elapsedMin));
    setClosing(true);
    onMode?.(true);
    onClosing?.();
  }

  // 입체 홈 — 읽는 동안엔 작은 줄만 (제목·지난번 쪽 · 책 덮기). 타이머는 아바타 머리 위
  if (compact && !closing) {
    return (
      <div className={s.compactRow}>
        <div className={s.compactInfo}>
          <b className={s.compactTitle}>{book.title}</b>
          <span className={ui.muted}>
            {book.pages ? `지난번 ${book.currentPage ?? 0}쪽까지 · 전체 ${book.pages}쪽` : shortAuthor(book.author)}
            {left != null && left > 0 ? ` · 남은 ${formatMinutes(left)}` : ""}
          </span>
        </div>
        <button type="button" className={ui.btn} onClick={close}>
          책 덮기
        </button>
        {onCollapse && (
          <button type="button" className={s.collapseBtn} onClick={onCollapse} aria-label="읽기 메뉴 접기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <>
          <h2 className={s.panelTitle}>{book.title}</h2>
          <p className={ui.muted}>{shortAuthor(book.author)}</p>

          {!closing ? (
            <>
              <div className={s.timer}>{formatClock(now - startedAt)}</div>
              <span className={s.reading}>
                <Sparkle size={14} className={s.twinkle} />
                <span className={s.timerLabel}>읽는 중</span>
                <StarDoodle size={12} color="var(--coral)" className={s.twinkle} />
                <Sparkle size={14} color="var(--mint)" className={s.twinkle} />
              </span>
              {book.pages ? (
                <div className={s.progressWrap}>
                  <Progress value={((book.currentPage ?? 0) / book.pages) * 100} />
                  <p className={ui.muted} style={{ marginTop: 6 }}>
                    지난번 {book.currentPage ?? 0}쪽까지 · 전체 {book.pages}쪽
                    {left != null && left > 0 ? ` · 남은 시간 ${speed.measured ? "" : "어림 "}${formatMinutes(left)}` : ""}
                  </p>
                </div>
              ) : null}
              <button type="button" className={`${ui.btn} ${ui.btnWide}`} style={{ marginTop: 22 }} onClick={close}>
                책 덮기
              </button>
            </>
          ) : (
            <form
              className={`${ui.paper} ${s.finish}`}
              onSubmit={(e) => {
                e.preventDefault();
                onFinish({ toPage: toPage ? page : null, minutes: Number(minutes) || 0, finished });
              }}
            >
              <span className={ui.paperLabel}>오늘은 몇 쪽까지 읽었어요?</span>
              <div className={s.finishRow}>
                <input
                  className={ui.field}
                  inputMode="numeric"
                  value={toPage}
                  onChange={(e) => setToPage(e.target.value.replace(/\D/g, ""))}
                  placeholder={book.currentPage ? `${book.currentPage}` : "쪽"}
                  aria-label="읽은 쪽"
                />
                <span className={ui.muted} style={{ whiteSpace: "nowrap" }}>
                  {book.pages ? `/ ${book.pages}쪽` : "쪽"}
                </span>
              </div>
              <div className={s.quick}>
                {[10, 20, 30].map((n) => (
                  <button key={n} type="button" className={ui.chip} onClick={() => setToPage(String(Math.min(book.pages ?? Infinity, (Number(toPage) || book.currentPage || 0) + n)))}>
                    +{n}쪽
                  </button>
                ))}
                <button type="button" className={`${ui.chip} ${finished ? ui.chipOn : ""}`} onClick={() => setFinished(!finished)}>
                  다 읽었어요
                </button>
              </div>
              <div className={s.finishRow}>
                <span className={ui.muted} style={{ whiteSpace: "nowrap" }}>
                  읽은 시간
                </span>
                <input className={ui.field} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} aria-label="읽은 분" />
                <span className={ui.muted}>분</span>
              </div>
              {error && <p className={ui.error}>{error}</p>}
              <button className={`${ui.btn} ${ui.btnWide}`} style={{ marginTop: 16 }} disabled={busy}>
                {finished ? "다 읽고 책장에 꽂기 ▸" : "책장에 다시 꽂기 ▸"}
              </button>
              <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 10 }}>
                {compact && (
                  <button
                    type="button"
                    className={ui.textBtn}
                    disabled={busy}
                    onClick={() => {
                      setClosing(false);
                      onMode?.(false);
                    }}
                  >
                    더 읽을래요
                  </button>
                )}
                <button type="button" className={ui.textBtn} onClick={onPutBack} disabled={busy}>
                  기록 없이 꽂기
                </button>
              </div>
            </form>
          )}
    </>
  );
}
