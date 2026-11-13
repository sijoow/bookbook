"use client";

// 오늘의 미션 · 이번 주 읽은 날 — 홈 옆 서랍 맨 위 (11-13 사용자: "간단한 미션들도 주고 거기서 포인트 주고")
// 다 한 미션은 '받기'(포인트) · 안 한 미션은 누르면 하러 가기 · 셋 다 받으면 보너스 · 이번 주 5일 읽으면 보너스

import Link from "next/link";
import { useState } from "react";
import type { ClaimId, MissionsView } from "@/lib/missions/missions";
import m from "./missions.module.css";

export function MissionPanel({ view, onClaim, onGo }: { view: MissionsView; onClaim: (id: ClaimId) => Promise<number>; onGo?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [pop, setPop] = useState<{ id: string; n: number } | null>(null);
  const doneCount = view.missions.filter((x) => x.done).length;

  async function claim(id: ClaimId) {
    if (busy) return;
    setBusy(id);
    try {
      const n = await onClaim(id);
      if (n > 0) {
        setPop({ id, n });
        setTimeout(() => setPop((p) => (p?.id === id ? null : p)), 1400);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={m.panel} aria-label="오늘의 미션">
      {/* 출석 체크 — 하루 한 번 도장, 7일째마다 보너스 (11-13) */}
      <div className={m.attend}>
        <div className={m.head}>
          <h3 className={m.title}>출석 체크</h3>
          <span className={m.count}>
            {view.attend.streak}일째 이어서 · {view.attend.goal}일마다 +{50}
          </span>
        </div>
        <ol className={m.days}>
          {view.attend.days.map((d) => (
            <li key={d.day} className={`${m.day} ${d.on ? m.dayStamp : ""} ${d.today ? m.dayToday : ""} ${d.future ? m.dayFuture : ""}`} aria-label={`${d.label}요일 ${d.on ? "출석" : "결석"}`}>
              <span>{d.label}</span>
              <i aria-hidden>{d.on ? "★" : ""}</i>
            </li>
          ))}
        </ol>
        <div className={m.item}>
          {view.attend.claimed ? (
            <p className={m.sub}>오늘 출석 도장 쾅! 내일 또 만나요</p>
          ) : (
            <button type="button" className={`${m.claim} ${m.claimWide}`} disabled={busy === "attend"} onClick={() => claim("attend")}>
              <i className={m.coin} aria-hidden />
              오늘 출석 도장 찍기 +{view.attend.reward}
              {view.attend.bonus ? ` · ${view.attend.streak}일 보너스 +${view.attend.bonus}` : ""}
            </button>
          )}
          {pop?.id === "attend" && <span className={m.pop}>+{pop.n}</span>}
        </div>
      </div>
      <div className={m.head}>
        <h3 className={m.title}>오늘의 미션</h3>
        <span className={m.count}>
          {doneCount}/{view.missions.length}
          {view.bonus.claimed ? " · 보너스 받음" : ` · 다 하면 +${view.bonus.reward}`}
        </span>
      </div>
      <ul className={m.list}>
        {view.missions.map((x) => {
          const body = (
            <>
              <i className={`${m.check} ${x.done ? m.checkOn : ""}`} aria-hidden>
                {x.done && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                )}
              </i>
              <span className={m.text}>
                <b>{x.title}</b>
                <span className={m.sub}>
                  {x.goal > 1 ? `${x.now} / ${x.goal}${x.unit}` : x.done ? "했어요" : x.hint}
                </span>
                {x.goal > 1 && (
                  <span className={m.bar} aria-hidden>
                    <span style={{ width: `${Math.round((x.now / x.goal) * 100)}%` }} />
                  </span>
                )}
              </span>
            </>
          );
          return (
            <li key={x.id} className={m.item}>
              {x.done ? (
                <div className={m.row}>{body}</div>
              ) : (
                <Link href={x.go} className={m.row} onClick={onGo}>
                  {body}
                </Link>
              )}
              {x.claimed ? (
                <span className={m.got}>받음</span>
              ) : x.done ? (
                <button type="button" className={m.claim} disabled={busy === x.id} onClick={() => claim(x.id)}>
                  <i className={m.coin} aria-hidden />
                  받기 +{x.reward}
                </button>
              ) : (
                <span className={m.reward}>+{x.reward}</span>
              )}
              {pop?.id === x.id && <span className={m.pop}>+{pop.n}</span>}
            </li>
          );
        })}
      </ul>

      <div className={m.week}>
        <div className={m.head}>
          <h3 className={m.title}>이번 주 읽은 날</h3>
          <span className={m.count}>
            {view.week.count}/{view.week.goal}일{view.week.claimed ? " · 받음" : ` · 채우면 +${view.week.reward}`}
          </span>
        </div>
        <ol className={m.days}>
          {view.week.days.map((d) => (
            <li key={d.day} className={`${m.day} ${d.read ? m.dayRead : ""} ${d.today ? m.dayToday : ""} ${d.future ? m.dayFuture : ""}`} aria-label={`${d.label}요일 ${d.read ? "읽음" : "안 읽음"}`}>
              <span>{d.label}</span>
              <i aria-hidden>
                {d.read && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                )}
              </i>
            </li>
          ))}
        </ol>
        {view.week.done && !view.week.claimed && (
          <div className={m.item}>
            <button type="button" className={`${m.claim} ${m.claimWide}`} disabled={busy === "week"} onClick={() => claim("week")}>
              <i className={m.coin} aria-hidden />
              이번 주 {view.week.goal}일 읽었어요 — 받기 +{view.week.reward}
            </button>
            {pop?.id === "week" && <span className={m.pop}>+{pop.n}</span>}
          </div>
        )}
      </div>
    </section>
  );
}
