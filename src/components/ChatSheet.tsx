"use client";

// 책마을 — 둘만의 이야기 창 (친구 집 '이야기' · 홈 서랍에서). 4초마다 새 말을 가져온다. 책 추천은 표지 카드로 → '내 책장에 담기'
/* eslint-disable @next/next/no-img-element -- YES24 표지 (작은 그림) */

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/client/api";
import { ITEM } from "@/lib/deco/items";
import { IconClose } from "./InkIcons";
import c from "./chat.module.css";

export type ChatBook = { title: string; author: string | null; coverUrl: string | null; isbn13: string | null; itemId: number | null };
type Msg = { id: string; mine: boolean; text: string; book: ChatBook | null; gift: string | null; at: string };
type Reading = { title: string; coverUrl: string | null; since: string } | null;

export function ChatSheet({ handle, nickname, onClose }: { handle: string; nickname: string; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reading, setReading] = useState<Reading>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const lastAt = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    const pull = () =>
      api<{ friend: { reading: Reading }; messages: Msg[] }>(`/api/chat/${encodeURIComponent(handle)}${lastAt.current ? `?after=${encodeURIComponent(lastAt.current)}` : ""}`)
        .then((r) => {
          if (!alive) return;
          setReading(r.friend.reading);
          if (r.messages.length) {
            lastAt.current = r.messages[r.messages.length - 1].at;
            setMsgs((xs) => {
              const seen = new Set(xs.map((x) => x.id));
              return [...xs, ...r.messages.filter((m) => !seen.has(m.id))];
            });
          }
        })
        .catch((e: Error) => alive && setErr(e.message));
    void pull();
    const id = window.setInterval(pull, 4000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [handle]);

  // 새 말이 오면 아래로
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ message: Msg }>(`/api/chat/${encodeURIComponent(handle)}`, { json: { text: t } });
      setText("");
      lastAt.current = r.message.at;
      setMsgs((xs) => [...xs, r.message]);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={c.root} role="dialog" aria-label={`${nickname}와 이야기`}>
      <button type="button" className={c.scrim} aria-label="닫기" onClick={onClose} />
      <section className={c.sheet}>
        <header className={c.head}>
          <b>{nickname}와 이야기</b>
          <button type="button" className={c.close} onClick={onClose} aria-label="닫기">
            <IconClose size={16} />
          </button>
        </header>
        {reading && (
          <p className={c.reading}>
            <i className={c.dot} aria-hidden />
            지금 『{reading.title}』 읽는 중
          </p>
        )}
        <div ref={list} className={c.list}>
          {msgs.length === 0 && <p className={c.empty}>둘만 보는 이야기예요. 먼저 인사해 볼까요?</p>}
          {msgs.map((m) => (
            <div key={m.id} className={`${c.row} ${m.mine ? c.mine : ""}`}>
              {m.gift ? (
                <div className={`${c.bubble} ${c.gift}`}>
                  <img src={`/img/stickers/${m.gift}.webp`} alt="" />
                  <span>{m.mine ? `${ITEM[m.gift]?.label ?? "선물"}을 보냈어요` : `${ITEM[m.gift]?.label ?? "선물"} 선물이 도착했어요 — 방에 상자가 있어요`}</span>
                </div>
              ) : m.book ? (
                <div className={`${c.bubble} ${c.book}`}>
                  {m.book.coverUrl ? <img src={m.book.coverUrl} alt="" /> : <span className={c.noCover}>{m.book.title}</span>}
                  <span className={c.bookBody}>
                    <b>『{m.book.title}』</b>
                    {m.text && <span>{m.text}</span>}
                    {!m.mine && (
                      <Link href={m.book.isbn13 ? `/add?isbn=${m.book.isbn13}` : `/add?q=${encodeURIComponent(m.book.title)}`} className={c.take}>
                        내 책장에 담기 ›
                      </Link>
                    )}
                  </span>
                </div>
              ) : (
                <p className={c.bubble}>{m.text}</p>
              )}
            </div>
          ))}
        </div>
        {err && <p className={c.err}>{err}</p>}
        <form className={c.input} onSubmit={send}>
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="한마디 남기기" enterKeyHint="send" aria-label="보낼 말" />
          <button type="submit" disabled={busy || !text.trim()}>
            보내기
          </button>
        </form>
      </section>
    </div>
  );
}
