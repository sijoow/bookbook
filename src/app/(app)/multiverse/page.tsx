"use client";
/* eslint-disable @next/next/no-img-element -- 우리 행성 스티커(public/img) */

// 멀티버스 — 사람마다 자기 책장(= 자기 우주). 같은 책이 꽂힌 책장끼리 통로가 생긴다.
// 둘 다 다 읽은 같은 책이 많을수록 선이 굵고, 같은 책은 있지만 아직 둘 다 다 읽지 않았으면 점선.
// 행성을 누르면 친구 책장에 놀러 간다. 아래에서 초대 링크를 만든다.

import Link from "next/link";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/Bars";
import { Sparkle, StarDoodle, Tape } from "@/components/Deco";
import ui from "@/components/ui.module.css";
import { api } from "@/lib/client/api";
import s from "../screens.module.css";

type Friend = { handle: string; nickname: string; bookCount: number; open: number; faint: number };
type Data = { me: { handle: string; nickname: string; bookCount: number }; friends: Friend[] };

const PLANETS = ["planet-orange", "planet-mint", "planet-coral", "planet-yellow", "planet-brown"];
const EMPTY_SEATS = [
  { img: "planet-orange", x: 22, y: 20, w: 92 },
  { img: "planet-mint", x: 80, y: 18, w: 96 },
  { img: "planet-coral", x: 18, y: 80, w: 74 },
  { img: "planet-yellow", x: 82, y: 82, w: 88 },
];
const ME = { x: 50, y: 50 };

function hash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h;
}

/** 친구를 나 둘레에 고르게 (위에서 시작, 시계 방향) */
function seat(i: number, n: number) {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n + (n === 2 ? Math.PI / 4 : 0);
  return { x: ME.x + Math.cos(a) * 34, y: ME.y + Math.sin(a) * 36 };
}

export default function Multiverse() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    api<Data>("/api/friends")
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, []);

  async function makeInvite() {
    setErr(null);
    try {
      const r = await api<{ code: string }>("/api/invites", { method: "POST" });
      setLink(`${window.location.origin}/i/${r.code}`);
      setCopied(false);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setErr("복사가 안 되는 브라우저예요. 링크를 길게 눌러 복사해 주세요.");
    }
  }

  async function share() {
    if (!link) return;
    try {
      await navigator.share({ title: "bookbook 책장 친구", text: "내 책장에 놀러 와! 같은 책을 읽으면 우리 책장 사이에 통로가 열려.", url: link });
    } catch {
      // 공유를 닫았으면 그대로
    }
  }

  const friends = data?.friends ?? [];
  const shown = friends.slice(0, 8);

  return (
    <>
      <TopBar title="멀티버스" />
      {err && <p className={ui.error}>{err}</p>}

      <div className={s.verse}>
        <svg className={s.verseSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {data && friends.length === 0
            ? EMPTY_SEATS.map((p) => (
                <line key={p.img} x1={ME.x} y1={ME.y} x2={p.x} y2={p.y} stroke="var(--line)" strokeDasharray="2 2.4" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 2.5 }} />
              ))
            : shown.map((f, i) => {
                const p = seat(i, shown.length);
                return (
                  <line
                    key={f.handle}
                    x1={ME.x}
                    y1={ME.y}
                    x2={p.x}
                    y2={p.y}
                    stroke={f.open ? "var(--ink)" : f.faint ? "var(--ink-soft)" : "var(--line)"}
                    strokeDasharray={f.open ? undefined : f.faint ? "3 3" : "1 3"}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    style={{ strokeWidth: f.open ? 1.5 + f.open * 1.6 : 2 }}
                  />
                );
              })}
        </svg>

        {data && friends.length === 0
          ? EMPTY_SEATS.map((p) => (
              <div key={p.img} className={`${s.versePlanet} ${s.versePlanetFaint}`} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                <img src={`/img/${p.img}.webp`} alt="" width={p.w} />
                <span className={`${s.verseTag} ${s.verseTagFaint}`}>친구 책장</span>
              </div>
            ))
          : shown.map((f, i) => {
              const p = seat(i, shown.length);
              return (
                <Link key={f.handle} href={`/u/${f.handle}`} className={s.versePlanet} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                  <img src={`/img/${PLANETS[hash(f.handle) % PLANETS.length]}.webp`} alt="" width={Math.min(104, 62 + f.bookCount * 3)} />
                  <span className={s.verseTag}>
                    {f.nickname} · {f.open ? `통로 ${f.open}` : f.faint ? `같은 책 ${f.faint}` : "아직"}
                  </span>
                </Link>
              );
            })}

        <div className={s.versePlanet} style={{ left: `${ME.x}%`, top: `${ME.y}%` }}>
          <img src="/img/planet-home.webp" alt="" width={116} />
          <span className={s.verseTag}>나의 책장 · {data ? `${data.me.bookCount}권` : "…"}</span>
        </div>
        <Sparkle size={18} style={{ position: "absolute", left: "48%", top: "4%" }} />
        <StarDoodle size={16} style={{ position: "absolute", left: "4%", top: "48%" }} color="var(--coral)" />
        <Sparkle size={16} style={{ position: "absolute", right: "4%", top: "52%" }} color="var(--mint)" />
      </div>

      {friends.length > 0 && (
        <section className={s.section}>
          <div className={s.stack12}>
            {friends.map((f) => (
              <Link key={f.handle} href={`/u/${f.handle}`} className={`${ui.paper} ${s.friendRow}`}>
                <img src={`/img/${PLANETS[hash(f.handle) % PLANETS.length]}.webp`} alt="" width={52} />
                <span className={s.nowBody}>
                  <span className={s.bookTitle}>{f.nickname}의 책장</span>
                  <span className={ui.muted}>
                    책 {f.bookCount}권 · 열린 통로 {f.open} · 같은 책 {f.open + f.faint}
                  </span>
                </span>
                <span className={s.go}>놀러 가기 ›</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className={`${ui.paper} ${s.section}`}>
        <Tape color="apricot" />
        <span className={ui.paperLabel}>책장 친구 초대</span>
        <p style={{ fontSize: 14 }}>
          친구 책장에 <b>나와 같은 책</b>이 꽂혀 있으면 두 책장 사이에 통로가 생기고, 둘 다 다 읽으면 통로가 열려요. 친구 책장에 놀러 가서 그 책을 얼마나 걸려
          읽었는지, 한줄평은 뭔지 보고, 마음에 드는 책을 내 책장에 담아 올 수 있어요.
        </p>
        {link ? (
          <div className={s.manual} style={{ marginTop: 12 }}>
            <input className={ui.field} value={link} readOnly onFocus={(e) => e.target.select()} aria-label="초대 링크" />
            <div className={s.row2}>
              <button type="button" className={`${ui.btn} ${ui.btnWide}`} onClick={copy}>
                {copied ? "복사했어요" : "링크 복사"}
              </button>
              {typeof navigator !== "undefined" && "share" in navigator && (
                <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.btnWide}`} onClick={share}>
                  공유하기
                </button>
              )}
            </div>
            <p className={ui.muted}>7일 동안 쓸 수 있어요.</p>
          </div>
        ) : (
          <button type="button" className={`${ui.btn} ${ui.btnWide}`} style={{ marginTop: 14 }} onClick={makeInvite}>
            초대 링크 만들기
          </button>
        )}
      </section>
    </>
  );
}
