// 책을 끌어다 놓을 자리 — 2D 책장과 입체 책장이 같이 쓴다. 순수 함수.
// 줄 = 책 아래끝(선반)이 같은 것끼리. 손가락에 세로로 가장 가까운 줄에서, 가운데를 넘은 첫 책 앞 (없으면 그 줄 끝 책 뒤).

export type SpineRect = { id: string; left: number; right: number; top: number; bottom: number };
export type DropTarget = { before: string | null; after: string | null };

export function dropTarget(rects: SpineRect[], x: number, y: number): DropTarget {
  if (!rects.length) return { before: null, after: null };
  const rows = new Map<number, SpineRect[]>();
  for (const it of rects) {
    const key = Math.round(it.bottom / 8);
    rows.set(key, [...(rows.get(key) ?? []), it]);
  }
  let best: SpineRect[] = [];
  let bestD = Infinity;
  for (const row of rows.values()) {
    const top = Math.min(...row.map((i) => i.top));
    const bottom = Math.max(...row.map((i) => i.bottom));
    const d = y < top ? top - y : y > bottom ? y - bottom : 0;
    if (d < bestD) {
      bestD = d;
      best = row;
    }
  }
  const sorted = [...best].sort((a, b) => a.left - b.left);
  const hit = sorted.find((i) => x < (i.left + i.right) / 2);
  return hit ? { before: hit.id, after: null } : { before: null, after: sorted[sorted.length - 1].id };
}

/** 놓은 뒤 새 순서 (바뀌지 않았으면 같은 배열 내용) */
export function moveTo(ids: string[], id: string, t: DropTarget): string[] {
  const others = ids.filter((x) => x !== id);
  let at = others.length;
  if (t.before && others.includes(t.before)) at = others.indexOf(t.before);
  else if (t.after && others.includes(t.after)) at = others.indexOf(t.after) + 1;
  return [...others.slice(0, at), id, ...others.slice(at)];
}
