"use client";

// 책마을 — 친구에게 책 추천하기 (책 상세). 친구를 고르면 둘만의 이야기에 표지 카드로 간다 → 받은 친구는 '내 책장에 담기'
// 11-13 사용자: "책도 공유해 주기도 하고 친구한테 책 추천해 주기"

import { useState } from "react";
import { api } from "@/lib/client/api";
import { josa } from "@/lib/ko";
import type { LibraryBook } from "@/lib/books/types";
import ui from "./ui.module.css";
import c from "./chat.module.css";

type Friend = { handle: string; nickname: string };

export function RecommendButton({ book }: { book: LibraryBook }) {
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [note, setNote] = useState("이 책 추천해!");
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function show() {
    setOpen(true);
    setErr(null);
    api<{ friends: Friend[] }>("/api/friends")
      .then((r) => setFriends(r.friends))
      .catch((e: Error) => setErr(e.message));
  }

  async function send(f: Friend) {
    setErr(null);
    try {
      await api(`/api/chat/${encodeURIComponent(f.handle)}`, {
        json: { text: note.trim().slice(0, 200), book: { title: book.title, author: book.author, coverUrl: book.coverUrl, isbn13: book.isbn13, itemId: null } },
      });
      setDone(`${f.nickname}에게 『${book.title}』${josa(book.title, "을", "를")} 추천했어요`);
      setOpen(false);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.btnWide}`} style={{ marginTop: 14 }} onClick={show}>
        친구에게 추천하기
      </button>
      {done && <p className={ui.muted} style={{ marginTop: 8, textAlign: "center" }}>{done} — 친구 집 &lsquo;이야기&rsquo;에서 볼 수 있어요</p>}
      {open && (
        <div className={c.root} role="dialog" aria-label="친구에게 추천하기">
          <button type="button" className={c.scrim} aria-label="닫기" onClick={() => setOpen(false)} />
          <section className={c.sheet} style={{ height: "auto", maxHeight: "70dvh" }}>
            <header className={c.head}>
              <b>누구에게 추천할까요?</b>
            </header>
            <div className={c.list}>
              <input className={ui.field} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} aria-label="같이 보낼 한마디" />
              {friends === null && !err && <p className={c.empty}>친구를 불러오는 중…</p>}
              {friends?.length === 0 && <p className={c.empty}>아직 책장 친구가 없어요 — 마이에서 내 도서관을 공유해 친구를 불러요</p>}
              {friends?.map((f) => (
                <button key={f.handle} type="button" className={`${ui.btn} ${ui.btnWide}`} onClick={() => send(f)}>
                  {f.nickname}에게 보내기
                </button>
              ))}
              {err && <p className={c.err}>{err}</p>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
