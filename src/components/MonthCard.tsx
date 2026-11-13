"use client";

// 이달의 독서 카드 (기록 탭 맨 위) — 다 읽은 책 표지 · 읽은 시간·쪽·날 · 많이 읽은 분야·작가 · 공유하기 (11-13 사용자: "월간 독서 리포트 … 공유도")

import { useState } from "react";
import { CoverSticker } from "@/components/Bits";
import { Tape } from "@/components/Deco";
import ui from "@/components/ui.module.css";
import { formatMinutes } from "@/lib/books/reading";
import type { MonthReport } from "@/lib/books/report";
import m from "./month.module.css";

export function MonthCard({ r }: { r: MonthReport }) {
  const [done, setDone] = useState<string | null>(null);

  async function share() {
    const titles = r.finished.slice(0, 5).map((b) => `『${b.title}』`).join(" ");
    const text = `${r.line}${titles ? `\n${titles}` : ""}\n— bookbook 나만의 도서관`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${r.label} 독서 카드`, text, url: window.location.origin });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${window.location.origin}`);
      setDone("복사했어요 — 붙여 넣어 보내 주세요");
    } catch {
      // 공유 창을 닫았으면 그대로
    }
  }

  return (
    <section className={`${ui.paper} ${m.card}`} aria-label={`${r.label} 독서 카드`}>
      <Tape color="mint" />
      <span className={ui.paperLabel}>{r.label}의 독서 카드</span>
      <p className={m.line}>{r.line}</p>
      {r.finished.length > 0 && (
        <div className={m.covers}>
          {r.finished.slice(0, 8).map((b, i) => (
            <CoverSticker key={b.id} src={b.coverUrl} title={b.title} w={52} tilt={i % 2 ? 3 : -3} />
          ))}
        </div>
      )}
      <div className={m.stats}>
        <span>
          <b>{r.finished.length}권</b>다 읽음
        </span>
        <span>
          <b>{formatMinutes(r.minutes)}</b>읽은 시간
        </span>
        <span>
          <b>{r.pages.toLocaleString()}쪽</b>넘긴 쪽
        </span>
        <span>
          <b>{r.days}일</b>읽은 날
        </span>
      </div>
      {(r.topGenre || r.topAuthor) && (
        <p className={m.best}>
          {r.topGenre && <>가장 많이 읽은 분야 <b>{r.topGenre}</b></>}
          {r.topGenre && r.topAuthor && " · "}
          {r.topAuthor && <>이달의 작가 <b>{r.topAuthor.name}</b> {r.topAuthor.count}권</>}
        </p>
      )}
      <button type="button" className={`${ui.btn} ${ui.btnWide}`} style={{ marginTop: 12 }} onClick={share}>
        카드 공유하기
      </button>
      {done && <p className={ui.muted} style={{ textAlign: "center", marginTop: 6 }}>{done}</p>}
    </section>
  );
}
