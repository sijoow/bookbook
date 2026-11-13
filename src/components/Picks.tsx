"use client";

// 맞춤 추천 · 이어지는 책 — 가로로 미는 표지 줄 + 책 상세의 '이어지는 책' (11-13 사용자: "내가 주로 읽는 책들 위주로 추천 + 연관 책들까지 분석")
// 고르면 책 추가 화면으로 (/add?isbn=… — 그 책 고르기 카드가 바로 열린다)

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CoverSticker } from "@/components/Bits";
import { Tape } from "@/components/Deco";
import ui from "@/components/ui.module.css";
import { api } from "@/lib/client/api";
import { josa } from "@/lib/ko";
import type { FriendPick, PickBook, RelatedView } from "@/lib/books/picks";
import type { BookStatus } from "@/lib/books/types";
import p from "./picks.module.css";

export type PickCard = { key: string; book: PickBook; note?: string | null; mint?: boolean; say?: string | null };

export function PickRow({ items, onPick, label }: { items: PickCard[]; onPick: (b: PickBook) => void; label: string }) {
  return (
    <div className={p.row} aria-label={label}>
      {items.map((c, i) => (
        <button key={c.key} type="button" className={p.card} onClick={() => onPick(c.book)}>
          <CoverSticker src={c.book.coverUrl} title={c.book.title} w={72} tilt={i % 2 ? 1.5 : -2} />
          <span className={p.title}>{c.book.title}</span>
          {c.note && <span className={`${p.note} ${c.mint ? p.noteMint : ""}`}>{c.note}</span>}
          {c.say && <span className={p.say}>&ldquo;{c.say}&rdquo;</span>}
        </button>
      ))}
    </div>
  );
}

/** 친구가 그 책을 어디까지 — 문장 속에 (칩용 STATUS_LABEL '읽은'은 문장에선 어색해서) */
const SAY: Record<BookStatus, string> = { read: "다 읽음", reading: "읽는 중", want: "읽고 싶어 함", stopped: "쉬는 중" };

const star = (r: number | null) => (r ? ` ★${r % 1 ? r.toFixed(1) : r}` : "");

/** 친구 책장에서 고른 책 → 카드 (누가·별·한줄평) */
export function friendCards(list: FriendPick[]): PickCard[] {
  return list.map((f) => {
    const first = f.who[0];
    const more = f.who.length > 1 ? ` 외 ${f.who.length - 1}명` : "";
    return {
      key: f.book.workKey,
      book: f.book,
      note: `${first.nickname}${more}${first.status === "read" ? star(first.rating) : ` · ${SAY[first.status]}`}`,
      mint: true,
      say: f.say?.text ?? null,
    };
  });
}

/** 고르면 책 추가 화면으로 — ISBN 이 있으면 그 책 고르기 카드가 바로, 없으면 제목으로 찾기 */
export function addHref(b: PickBook): string {
  return b.isbn13 ? `/add?isbn=${b.isbn13}` : `/add?q=${encodeURIComponent(b.title)}`;
}

/** 책 상세 — 이어지는 책: 같은 책을 읽은 친구(통로) · 그 친구들이 좋아한 다른 책 · 같은 작가의 다른 책 */
export function RelatedBooks({ bookId, className }: { bookId: string; className?: string }) {
  const router = useRouter();
  const [r, setR] = useState<RelatedView | null>(null);
  useEffect(() => {
    let alive = true;
    api<RelatedView>(`/api/library/${bookId}/related`)
      .then((x) => alive && setR(x))
      .catch(() => {}); // 없어도 그만
    return () => {
      alive = false;
    };
  }, [bookId]);
  if (!r) return null;
  const authorItems = r.author?.items ?? [];
  if (!r.readers.length && !r.alsoLiked.length && !authorItems.length) return null;
  const go = (b: PickBook) => router.push(addHref(b));
  return (
    <section className={className ?? ui.paper}>
      <Tape color="mint" />
      <span className={ui.paperLabel}>이어지는 책</span>

      {r.readers.length > 0 && (
        <div className={p.group}>
          <p className={p.groupHead}>같은 책을 읽은 친구</p>
          <div className={p.readers}>
            {r.readers.map((x) => (
              <Link key={x.handle} href={`/u/${x.handle}`} className={p.reader}>
                <i className={`${p.portalDot} ${x.status === "read" ? "" : p.portalFaint}`} aria-hidden />
                <b>{x.nickname}</b>
                <span>
                  {SAY[x.status]}
                  {star(x.rating)}
                  {x.oneLiner ? ` — “${x.oneLiner}”` : ""}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {r.alsoLiked.length > 0 && (
        <div className={p.group}>
          <p className={p.groupHead}>이 책을 읽은 친구가 좋아한 책</p>
          <PickRow items={friendCards(r.alsoLiked)} onPick={go} label="이 책을 읽은 친구가 좋아한 책" />
        </div>
      )}

      {r.author && authorItems.length > 0 && (
        <div className={p.group}>
          <p className={p.groupHead}>
            {r.author.name} 작가의 다른 책
          </p>
          {r.mineByAuthor.length > 0 && (
            <p className={p.sub}>
              내 책장에 {r.mineByAuthor.map((b) => `『${b.title}』`).join(" ")}
              {josa(r.mineByAuthor[r.mineByAuthor.length - 1].title, "이", "가")} 있어요
            </p>
          )}
          <PickRow items={authorItems.map((b) => ({ key: b.workKey, book: b }))} onPick={go} label={`${r.author.name} 작가의 다른 책`} />
        </div>
      )}
    </section>
  );
}
