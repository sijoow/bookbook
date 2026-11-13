"use client";
/* eslint-disable @next/next/no-img-element -- YES24 책등은 응답 URL 그대로(약관), 북엔드는 우리 행성 스티커 */

// 책장 — 실제 책등이 세로로 꽂힌다. 높이 = 책 세로, 폭 = 두께 (얇은 책도 누를 수 있게 1.5배·최소 14px)
// 읽는 중 = 위로 튀어나온 책갈피, 다 읽음 = 별 스티커, 통로(친구와 같은 책) = 반짝이. 남는 자리에 행성 북엔드.
// editing 이면 책을 끌어서 순서를 바꾼다 (마우스·손가락 모두 포인터 이벤트로). 누르면 꺼내기는 editing 이 아닐 때만.

import Link from "next/link";
import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { dropTarget as dropAt } from "@/lib/books/drop";
import { ADD_SLOT_W, SPINE_GAP, packRows, rowWidth, spineSize } from "@/lib/books/shelf";
import type { LibraryBook } from "@/lib/books/types";
import { Sparkle, StarDoodle } from "./Deco";
import s from "./shelf.module.css";

const PASTEL = ["var(--apricot)", "var(--mint)", "var(--butter)", "var(--coral)", "var(--sky)"];
const BOOKENDS = ["planet-mint", "planet-coral", "planet-yellow", "planet-orange", "planet-brown"];

function hash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h;
}

type Drag = {
  id: string;
  x: number;
  y: number;
  offX: number;
  offY: number;
  w: number;
  h: number;
  rects: Array<{ id: string; r: DOMRect }>; // 끌기 시작할 때 잰 다른 책들 자리
  before: string | null; // 이 책 앞에 넣는다
  after: string | null; // 칸 끝이면 이 책 뒤에
};

/** 포인터 자리 → 어느 책 앞(또는 칸 끝 책 뒤)에 넣을지 — 입체 책장과 같은 규칙 (lib/books/drop) */
function dropTarget(rects: Drag["rects"], x: number, y: number): { before: string | null; after: string | null } {
  return dropAt(
    rects.map(({ id, r }) => ({ id, left: r.left, right: r.right, top: r.top, bottom: r.bottom })),
    x,
    y,
  );
}

export function Bookshelf({
  title,
  books,
  outId = null,
  onPick,
  register,
  editing = false,
  onReorder,
  marks,
  addSlot = true,
  pickLabel = "꺼내 읽기",
}: {
  title: string;
  books: LibraryBook[];
  outId?: string | null;
  onPick?: (b: LibraryBook) => void;
  register?: (id: string, el: HTMLElement | null) => void;
  editing?: boolean;
  onReorder?: (ids: string[]) => void;
  marks?: Set<string>; // 반짝이를 붙일 책 (친구 책장에서 나와 같은 책)
  addSlot?: boolean;
  pickLabel?: string; // 책등을 누르면 하는 일 (읽기 도우미용 이름) — 친구 책장은 '보기'
}) {
  const ref = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width) - 8)); // 칸 좌우 여백 4px씩
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = width > 0 ? packRows(books, width, addSlot) : [];

  function down(e: ReactPointerEvent<HTMLButtonElement>, b: LibraryBook) {
    if (!editing) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    const rects = books.filter((x) => x.id !== b.id).flatMap((x) => {
      const el = els.current.get(x.id);
      return el ? [{ id: x.id, r: el.getBoundingClientRect() }] : [];
    });
    setDrag({ id: b.id, x: e.clientX, y: e.clientY, offX: e.clientX - r.left, offY: e.clientY - r.top, w: r.width, h: r.height, rects, ...dropTarget(rects, e.clientX, e.clientY) });
  }

  function move(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    setDrag({ ...drag, x: e.clientX, y: e.clientY, ...dropTarget(drag.rects, e.clientX, e.clientY) });
  }

  function up() {
    if (!drag) return;
    const others = books.filter((b) => b.id !== drag.id).map((b) => b.id);
    let at = others.length;
    if (drag.before) at = others.indexOf(drag.before);
    else if (drag.after) at = others.indexOf(drag.after) + 1;
    const next = [...others.slice(0, at), drag.id, ...others.slice(at)];
    setDrag(null);
    if (next.join() !== books.map((b) => b.id).join()) onReorder?.(next);
  }

  const dragged = drag ? books.find((b) => b.id === drag.id) : null;

  return (
    <div className={`${s.case} ${editing ? s.editing : ""}`}>
      <span className={s.plaque}>{title}</span>
      <div ref={ref}>
        {rows.map((row, i) => {
          const last = i === rows.length - 1;
          const room = width - rowWidth(row) - (last && addSlot ? SPINE_GAP + ADD_SLOT_W : 0);
          const end = room >= 54 ? BOOKENDS[i % BOOKENDS.length] : null;
          return (
            <div key={i} className={s.row}>
              <div className={s.books}>
                {row.map((b) => {
                  const { w, h } = spineSize(b);
                  const k = hash(b.id);
                  return [
                    drag?.before === b.id && drag.id !== b.id ? <i key={`${b.id}-bar`} className={s.insertBar} style={{ height: h }} /> : null,
                    <button
                      key={b.id}
                      ref={(el) => {
                        if (el) els.current.set(b.id, el);
                        else els.current.delete(b.id);
                        register?.(b.id, el);
                      }}
                      type="button"
                      className={`${s.spine} ${outId === b.id ? s.out : ""} ${drag?.id === b.id ? s.lifted : ""}`}
                      style={{ width: w, height: h, animationDelay: `${-(k % 7) * 0.09}s` }}
                      onClick={() => !editing && onPick?.(b)}
                      onPointerDown={(e) => down(e, b)}
                      onPointerMove={move}
                      onPointerUp={up}
                      onPointerCancel={() => setDrag(null)}
                      aria-label={editing ? `${b.title} 옮기기` : onPick ? `${b.title} ${pickLabel}` : b.title}
                      title={b.title}
                    >
                      {b.sideCoverUrl ? (
                        <img src={b.sideCoverUrl} alt="" className={s.spineImg} draggable={false} />
                      ) : (
                        <span className={s.fake} style={{ background: PASTEL[k % PASTEL.length], fontSize: Math.min(13, Math.max(9, w - 5)) }}>
                          {b.title}
                        </span>
                      )}
                      {b.status === "reading" && <i className={s.ribbon} aria-hidden />}
                      {b.status === "read" && (
                        <span className={s.done} aria-hidden>
                          <StarDoodle size={Math.min(12, w - 3)} />
                        </span>
                      )}
                      {marks?.has(b.id) && (
                        <span className={s.portalMark} aria-hidden>
                          <Sparkle size={14} color="var(--mint)" />
                        </span>
                      )}
                    </button>,
                    drag?.after === b.id && drag.id !== b.id ? <i key={`${b.id}-bar-after`} className={s.insertBar} style={{ height: h }} /> : null,
                  ];
                })}
                {last && addSlot && !editing && (
                  <Link href="/add" className={s.addSlot} aria-label="책 추가">
                    +
                  </Link>
                )}
                {end && <img src={`/img/${end}.webp`} alt="" className={s.bookend} width={Math.min(64, room - 10)} />}
              </div>
              <div className={s.plank} />
            </div>
          );
        })}
      </div>

      {drag && dragged && (
        <div className={s.ghost} style={{ left: drag.x - drag.offX, top: drag.y - drag.offY, width: drag.w, height: drag.h }} aria-hidden>
          {dragged.sideCoverUrl ? (
            <img src={dragged.sideCoverUrl} alt="" className={s.spineImg} draggable={false} />
          ) : (
            <span className={s.fake} style={{ background: PASTEL[hash(dragged.id) % PASTEL.length] }}>
              {dragged.title}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
