"use client";

// 내 도서관 공유하기 — 초대 링크(7일)를 만들어 폰 공유창(카카오톡 등)으로, 공유창이 없으면 링크 복사.
// 11-12 사용자: "친구네 집 놀러 가서 방문하기 … 내 책장 공유하기 하면서". 링크를 연 친구는 내 도서관을 보고 친구가 된다.

import { useState } from "react";
import { api } from "@/lib/client/api";
import ui from "./ui.module.css";

/** 공유하기 손잡이 — 홈 퀵메뉴(공유)와 아래 버튼이 같이 쓴다 */
export function useShareLibrary(name: string, onDone?: (msg: string) => void) {
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    try {
      const r = await api<{ code: string }>("/api/invites", { method: "POST" });
      const url = `${window.location.origin}/i/${r.code}`;
      const text = `${name}의 도서관에 놀러 와! 같은 책을 읽으면 우리 도서관 사이에 통로가 열려.`;
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title: "bookbook 도서관 초대", text, url });
          onDone?.("공유했어요 — 친구가 링크를 열면 놀러 올 수 있어요");
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return; // 공유창을 닫았다
        }
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      onDone?.("초대 링크를 복사했어요 — 카카오톡에 붙여 보내 주세요 (7일 동안 열려요)");
    } catch (e) {
      onDone?.((e as Error).message || "공유를 못 했어요");
    } finally {
      setBusy(false);
    }
  }
  return { share, busy };
}

export function ShareLibrary({ name, wide = false, onDone }: { name: string; wide?: boolean; onDone?: (msg: string) => void }) {
  const { share, busy } = useShareLibrary(name, onDone);
  return (
    <button type="button" className={`${ui.btn} ${wide ? ui.btnWide : ui.btnGhost}`} onClick={share} disabled={busy}>
      내 도서관 공유하기
    </button>
  );
}
