// 입체 도서관 책장 배치 — 책 크기(cm)로 줄을 나누고 자리를 정한다. 순수 함수 (three.js 없이 시험).
// 책장 한 개 = 안쪽 폭 64cm · 최대 3줄. 책이 적으면(한 줄) 책장 폭이 책에 맞게 좁아져(36cm~) 책이 크게 보이고,
// 책이 늘면 64cm 까지 넓어진 뒤 1줄 → 2줄 → 3줄로 자라고, 넘치면 옆에 책장이 하나 더 선다. (11-12 사용자: "책장을 더 크게, 책을 자세히 고르게")
// 순서는 2D 책장과 같다: 위 줄 왼쪽부터 (순서 바꾸기 화면과 똑같이 보이게)
// 좌표: 단위 cm, 바닥 y=0, 책등 쪽(앞) = +z. 책등 앞면은 z = -SPINE_INSET.

export const CASE = {
  innerW: 64, // 칸 안쪽 폭 (가장 넓을 때)
  minInnerW: 36, // 책이 적을 때 가장 좁은 폭
  endRoom: 12, // 한 줄일 때 끝에 남겨 두는 자리 (행성 북엔드)
  side: 2.4, // 옆판 두께
  board: 2, // 선반 두께
  top: 2.6, // 지붕판
  plinth: 4, // 받침
  depth: 24, // 책장 깊이
  gap: 16, // 책장 사이
  maxRows: 3,
  pad: 0.8, // 칸 안 좌우 여백
  bookGap: 0.3,
};
export const SPINE_INSET = 0.8;

/** 책장 꾸미기 (상점, 11-13 사용자: "꾸미기에서 책장 넓히기나 이런 것들도") — 넓은 책장 = 칸 폭 88, 높은 책장 = 4줄 */
export type ShelfOpts = { wide?: boolean; tall?: boolean };
export const SHELF_WIDE_INNER = 88;
export const SHELF_TALL_ROWS = 4;
const ADD_W = 4.2; // '+' 빈 자리 폭

type Sized = { id: string; thicknessMm: number | null; lengthMm: number | null };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 책 한 권 크기(cm). 두께는 2D 책장처럼 부풀려 얇은 책도 보이고 눌리게 */
export function bookDims(b: Pick<Sized, "thicknessMm" | "lengthMm">): { t: number; h: number; d: number } {
  const h = clamp((b.lengthMm ?? 210) / 10, 15, 32);
  const t = Math.round(clamp(((b.thicknessMm ?? 15) / 10) * 1.7, 1.8, 6.5) * 10) / 10;
  const d = Math.round(h * 0.68 * 10) / 10;
  return { t, h, d };
}

export type Slot = {
  id: string;
  index: number; // 책장 순서
  unit: number;
  row: number; // 0 = 맨 위 줄
  x: number; // 책 가운데
  y: number; // 그 줄 바닥 (책 아래끝)
  z: number; // 책 가운데 (깊이)
  t: number;
  h: number;
  d: number;
  face?: boolean; // 앞표지가 앞으로 (넓은 책장) — 폭 = d, 두께 = t (깊이 쪽)
};

export type UnitLayout = {
  index: number;
  x: number; // 책장 가운데
  innerW: number; // 칸 안쪽 폭
  rows: number;
  width: number; // 바깥 폭
  height: number; // 바깥 높이
  rowFloors: number[]; // 줄마다 바닥 y (0 = 맨 위 줄)
  free: Array<{ row: number; x0: number; x1: number }>; // 줄 끝 빈 자리 (북엔드·소품)
};

export type LibraryLayout = {
  units: UnitLayout[];
  slots: Slot[];
  rowH: number;
  add: { unit: number; row: number; x: number; y: number; w: number; h: number } | null; // '+' 빈 자리
};

export function unitX(i: number, innerW: number = CASE.innerW): number {
  return i * (innerW + CASE.side * 2 + CASE.gap);
}

/** 책장 배치. addSlot 이면 마지막 줄 끝에 '+' 자리 (자리가 남을 때만 — 그 때문에 줄을 늘리지 않는다) */
export function layoutLibrary(books: Sized[], addSlot = true, opts: ShelfOpts = {}): LibraryLayout {
  const innerMax = opts.wide ? SHELF_WIDE_INNER : CASE.innerW;
  const maxRows = opts.tall ? SHELF_TALL_ROWS : CASE.maxRows;
  const usable = innerMax - CASE.pad * 2;
  const dims = books.map((b) => bookDims(b));
  // 넓은 책장은 앞표지가 앞으로 — 한 권이 차지하는 폭이 책 가로(d), 사이도 조금 넓게
  const face = Boolean(opts.wide);
  const wOf = (d: { t: number; d: number }) => (face ? d.d : d.t);
  const gap = face ? 1.4 : CASE.bookGap;
  const rowH = clamp(Math.max(0, ...dims.map((d) => d.h)) + 3.5, 24, 35.5);

  // 1) 줄 나누기 (책장 경계 없이 한 줄씩)
  const lines: number[][] = [[]];
  let used = 0;
  dims.forEach((d, i) => {
    const line = lines[lines.length - 1];
    const need = line.length ? gap + wOf(d) : wOf(d);
    if (line.length && used + need > usable) {
      lines.push([i]);
      used = wOf(d);
    } else {
      line.push(i);
      used += need;
    }
  });

  // 한 줄뿐이면 책장 폭을 책에 맞춘다 (책이 적을 때 책장이 작아져 책이 크게 보이게)
  const lineW = (line: number[]) => line.reduce((t, i, k) => t + wOf(dims[i]) + (k ? gap : 0), 0);
  const fitW =
    lines.length === 1 && !opts.wide // 넓은 책장은 책이 적어도 넓게 (산 게 바로 보이게 — 11-13 사용자)
      ? clamp(Math.ceil(lineW(lines[0]) + (addSlot ? ADD_W + CASE.bookGap : 0) + CASE.pad * 2 + CASE.endRoom), CASE.minInnerW, innerMax)
      : innerMax;

  // 2) 줄을 책장에 3줄씩 (높은 책장은 4줄)
  const unitCount = Math.max(1, Math.ceil(lines.length / maxRows));
  const units: UnitLayout[] = [];
  const slots: Slot[] = [];
  for (let u = 0; u < unitCount; u++) {
    const mine = lines.slice(u * maxRows, (u + 1) * maxRows);
    const rows = Math.max(u === 0 && opts.tall ? maxRows : 1, mine.length); // 높은 책장은 책이 적어도 4줄 (11-13 사용자: "쓰는 중인데 변경이 전혀 안 됨")
    const cx = unitX(u, innerMax);
    const bottomFloor = CASE.plinth + CASE.board;
    const rowFloors = Array.from({ length: rows }, (_, r) => bottomFloor + (rows - 1 - r) * (rowH + CASE.board));
    const height = rowFloors[0] + rowH + CASE.top;
    const innerW = u === 0 ? fitW : innerMax;
    const left = cx - innerW / 2 + CASE.pad;
    const free: UnitLayout["free"] = [];
    for (let r = 0; r < rows; r++) {
      let x = left;
      for (const i of mine[r] ?? []) {
        const d = dims[i];
        slots.push(
          face
            ? { id: books[i].id, index: i, unit: u, row: r, x: x + d.d / 2, y: rowFloors[r], z: -SPINE_INSET - 2 - d.t / 2, t: d.t, h: d.h, d: d.d, face: true }
            : { id: books[i].id, index: i, unit: u, row: r, x: x + d.t / 2, y: rowFloors[r], z: -SPINE_INSET - d.d / 2, t: d.t, h: d.h, d: d.d },
        );
        x += wOf(d) + gap;
      }
      free.push({ row: r, x0: x, x1: cx + innerW / 2 - CASE.pad });
    }
    units.push({ index: u, x: cx, innerW, rows, width: innerW + CASE.side * 2, height, rowFloors, free });
  }

  // 3) '+' 자리 — 마지막 책장 마지막 줄에 남는 자리가 있으면
  let add: LibraryLayout["add"] = null;
  if (addSlot) {
    const lu = units[units.length - 1];
    const lastRow = lu.rows - 1;
    const f = lu.free[lastRow];
    if (f && f.x1 - f.x0 >= ADD_W + 0.5) {
      const h = Math.min(21, rowH - 4);
      add = { unit: lu.index, row: lastRow, x: f.x0 + ADD_W / 2, y: lu.rowFloors[lastRow], w: ADD_W, h };
      f.x0 += ADD_W + CASE.bookGap;
    }
  }
  return { units, slots, rowH, add };
}
