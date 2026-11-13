// 통로 — 두 책장에 같은 책(workKey 같음)이 꽂혀 있으면 생긴다 (docs/02 2-2, 11-12 책장 컨셉)
//   열린 통로: 둘 다 '읽은'  ·  희미한 통로: 그 밖 (한쪽이라도 읽는 중·읽고 싶은)  ·  없음: 어느 쪽이든 '중단'
// 순수 함수라 서버·화면 어디서나.

import type { BookStatus } from "./types";

type B = { id: string; workKey: string; status: BookStatus };

export type Portal<T extends B = B> = { workKey: string; mine: T; theirs: T; open: boolean };

export function portalsBetween<T extends B>(mine: T[], theirs: T[]): Portal<T>[] {
  const theirByKey = new Map<string, T>();
  for (const b of theirs) if (!theirByKey.has(b.workKey)) theirByKey.set(b.workKey, b);
  const seen = new Set<string>();
  const out: Portal<T>[] = [];
  for (const m of mine) {
    if (seen.has(m.workKey)) continue; // 내 책장에 같은 책이 두 판본 있어도 통로는 하나
    const t = theirByKey.get(m.workKey);
    if (!t) continue;
    seen.add(m.workKey);
    if (m.status === "stopped" || t.status === "stopped") continue;
    out.push({ workKey: m.workKey, mine: m, theirs: t, open: m.status === "read" && t.status === "read" });
  }
  // 열린 통로 먼저
  return out.sort((a, b) => Number(b.open) - Number(a.open));
}

export function portalCounts(portals: Array<{ open: boolean }>): { open: number; faint: number } {
  const open = portals.filter((p) => p.open).length;
  return { open, faint: portals.length - open };
}
