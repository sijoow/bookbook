"use client";

// 책마을 — 친구에게 선물 고르기 (친구 집 '선물'). 친구가 아직 없는 물건만 · 내 포인트로 → 보내면 내 아바타가 상자를 들고 가서 건넨다
/* eslint-disable @next/next/no-img-element -- 스티커 그림 */

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { POINT_NAME, TRACK, type DecoItem } from "@/lib/deco/items";
import { josa } from "@/lib/ko";
import ui from "./ui.module.css";
import c from "./chat.module.css";

export function GiftSheet({ to, nickname, has, onClose, onSent }: { to: string; nickname: string; has: string[]; onClose: () => void; onSent: () => void }) {
  const [points, setPoints] = useState<number | null>(null);
  const [pick, setPick] = useState<DecoItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const items = TRACK.filter((t) => !has.includes(t.id));

  useEffect(() => {
    let alive = true;
    api<{ points: number }>("/api/me")
      .then((r) => alive && setPoints(r.points))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function send() {
    if (!pick || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api("/api/gift", { json: { to, id: pick.id } });
      onSent();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={c.root} role="dialog" aria-label={`${nickname}에게 선물`}>
      <button type="button" className={c.scrim} aria-label="닫기" onClick={onClose} />
      <section className={c.sheet} style={{ height: "min(78dvh, 660px)" }}>
        <header className={c.head}>
          <b>{nickname}에게 선물</b>
          <span className={ui.muted}>
            내 {POINT_NAME} {points?.toLocaleString() ?? "…"}
          </span>
        </header>
        <div className={c.list}>
          {items.length === 0 ? (
            <p className={c.empty}>{nickname}{josa(nickname, "은", "는")} 벌써 다 가지고 있어요</p>
          ) : (
            <div className={c.giftGrid}>
              {items.map((it) => (
                <button key={it.id} type="button" className={`${ui.stickerTile} ${pick?.id === it.id ? ui.stickerOn : ""}`} onClick={() => setPick(it)} aria-pressed={pick?.id === it.id}>
                  <img src={`/img/stickers/${it.id}.webp`} alt="" />
                  <span>{it.label}</span>
                  <small>{it.price}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        {err && <p className={c.err}>{err}</p>}
        <div className={c.input}>
          <button type="button" style={{ flex: 1, minHeight: 46 }} disabled={!pick || busy || (points !== null && pick !== null && points < pick.price)} onClick={send}>
            {pick ? (points !== null && points < pick.price ? `${pick.price - points} ${POINT_NAME}가 모자라요` : `${pick.label} 들고 가서 주기 ▸`) : "선물할 물건을 골라요"}
          </button>
        </div>
      </section>
    </div>
  );
}
