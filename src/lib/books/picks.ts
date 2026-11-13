// 맞춤 추천 · 독서 취향 · 이어지는 책 — 11-13 사용자: "내가 주로 읽는 책들 위주로 추천 + 연관 책들까지 분석해서"
// 내 책장 · 친구 책장 · YES24 검색(24시간 캐시) 만으로 그때그때 계산한다 — 책 목록을 따로 쌓아 두지 않는다 (YES24 약관)
// 순수 계산만 (서버·화면 둘 다 쓰고, 시험이 바로 부른다)

import { josa } from "@/lib/ko";
import { shortAuthor, type BookStatus } from "./types";
import { normalizeFirstAuthor, workKey as keyOf } from "./workKey";

export type TasteBook = {
  title: string;
  author: string | null;
  category: string | null;
  status: BookStatus;
  rating: number | null;
  workKey: string;
  at?: number; // 마지막으로 만진 때 (다 읽은 날·고친 날 ms) — 같은 무게면 최근 책 먼저
};

/** 책 한 권이 취향에 얼마나 실리나 — 다 읽음 3 · 읽는 중 2 · 읽고 싶은 1 · 그만둠 0, 별 4개 넘으면 +1 */
export function tasteWeight(b: Pick<TasteBook, "status" | "rating">): number {
  const base = b.status === "read" ? 3 : b.status === "reading" ? 2 : b.status === "want" ? 1 : 0;
  return base === 0 ? 0 : base + (b.rating != null && b.rating >= 4 ? 1 : 0);
}

/** '국내도서-소설/시/희곡' → '소설/시/희곡' */
export function genreOf(category: string | null | undefined): string | null {
  if (!category) return null;
  const g = category.replace(/^[^-]*도서-/, "").trim();
  return g || null;
}

/** 화면에 짧게 — '소설/시/희곡' → '소설', '경제 경영' → '경제 경영' */
export function genreShort(g: string): string {
  return g.split("/")[0].trim() || g;
}

export type TasteAuthor = { key: string; name: string; count: number; score: number };
export type Taste = {
  books: number; // 취향에 든 책 (그만둔 책 빼고)
  genres: { name: string; count: number; share: number }[]; // 많이 읽은 분야 (무게 기준 비율, 최대 3)
  authors: TasteAuthor[]; // 많이 읽은 작가 순 (권수 → 무게 → 최근), 읽은·읽는 책이 있는 작가만
  line: string | null; // 한 줄 분석
};

export function readingTaste(books: TasteBook[]): Taste {
  const live = books.filter((b) => tasteWeight(b) > 0);
  const genre = new Map<string, { count: number; w: number }>();
  let gw = 0;
  for (const b of live) {
    const g = genreOf(b.category);
    if (!g) continue;
    const e = genre.get(g) ?? { count: 0, w: 0 };
    e.count++;
    e.w += tasteWeight(b);
    gw += tasteWeight(b);
    genre.set(g, e);
  }
  const genres = [...genre.entries()]
    .map(([name, e]) => ({ name, count: e.count, share: gw ? e.w / gw : 0 }))
    .sort((a, b) => b.share - a.share || b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 3);

  const byAuthor = new Map<string, TasteAuthor & { at: number; strong: boolean }>();
  for (const b of live) {
    const key = normalizeFirstAuthor(b.author);
    if (!key) continue;
    const e = byAuthor.get(key) ?? { key, name: shortAuthor(b.author), count: 0, score: 0, at: 0, strong: false };
    e.count++;
    e.score += tasteWeight(b);
    e.at = Math.max(e.at, b.at ?? 0);
    if (b.status === "read" || b.status === "reading") e.strong = true;
    byAuthor.set(key, e);
  }
  const authors = [...byAuthor.values()]
    .filter((a) => a.strong)
    .sort((a, b) => b.count - a.count || b.score - a.score || b.at - a.at || a.name.localeCompare(b.name))
    .map(({ key, name, count, score }) => ({ key, name, count, score }));

  const parts: string[] = [];
  if (genres[0]) parts.push(`${genreShort(genres[0].name)}${josa(genreShort(genres[0].name), "을", "를")} 가장 많이 읽어요`);
  const fav = authors.find((a) => a.count >= 2);
  if (fav) parts.push(`${fav.name} 작가 책이 ${fav.count}권`);
  return { books: live.length, genres, authors, line: parts.length ? parts.join(" · ") : null };
}

export type PickBook = { title: string; author: string | null; coverUrl: string | null; isbn13: string | null; itemId: number | null; workKey: string };

// 제목 앞에 붙은 판본 이름 ('초판본 데미안') — 같은 책인지 볼 때만 뗀다 (화면엔 YES24 제목 그대로)
const LEAD_EDITION = /^(?:\s*(?:초판본|초판|리커버|개정판|개정증보판|특별판|한정판|기념판|양장본?|큰\s*글자(?:책|도서)?|미니북|소장판|완역본?|완전판|합본)\s+)+/;
const pickKey = (title: string, author: string | null) => keyOf(title.normalize("NFKC").replace(LEAD_EDITION, ""), author);
type Candidate = { title: string; author: string | null; coverUrl: string | null; isbn13: string | null; itemId: number | null };

// 세트·전집·굿즈는 추천에서 뺀다 (한 권이 아니라서)
const NOT_ONE = /세트|전집|합본|묶음|굿즈|다이어리|캘린더|달력|엽서|필사|컬러링/;

/** 같은 작가의 다른 책 — YES24 검색 결과에서 그 작가(첫 저자)만, 내 책장·판본 겹침 빼고.
 *  제목에 작가 이름이 든 책('헤르만 헤세의 ○○' 같은 엮은 책)은 뒤로 — 대표작이 먼저 */
export function authorPicks(items: Candidate[], authorKey: string, mine: Set<string>, limit = 6): PickBook[] {
  if (!authorKey) return [];
  const seen = new Set(mine);
  const out: PickBook[] = [];
  const named = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "").includes(authorKey);
  const ordered = [...items.filter((it) => !named(it.title)), ...items.filter((it) => named(it.title))];
  for (const it of ordered) {
    if (normalizeFirstAuthor(it.author) !== authorKey) continue;
    if (NOT_ONE.test(it.title)) continue;
    const wk = pickKey(it.title, it.author);
    if (seen.has(wk)) continue;
    seen.add(wk);
    out.push({ title: it.title, author: it.author, coverUrl: it.coverUrl, isbn13: it.isbn13, itemId: it.itemId, workKey: wk });
    if (out.length >= limit) break;
  }
  return out;
}

export type FriendBook = TasteBook & { coverUrl: string | null; isbn13: string | null; itemId: number | null; oneLiner: string | null };
export type FriendShelfLite = { handle: string; nickname: string; books: FriendBook[] };
export type FriendPick = {
  book: PickBook;
  who: { handle: string; nickname: string; status: BookStatus; rating: number | null }[];
  say: { nickname: string; text: string } | null; // 가장 높은 별을 준 친구의 한줄평
  score: number;
};

/** 친구 책장에서 — 내 책장에 없는 책을 친구 여럿·높은 별 순으로 (꽂으면 통로가 열린다). only = 이 책들만 (이어지는 책) */
export function friendPicks(friends: FriendShelfLite[], mine: Set<string>, limit = 6, opts: { only?: (b: FriendBook) => boolean; min?: number } = {}): FriendPick[] {
  const min = opts.min ?? 2;
  const by = new Map<string, FriendPick & { best: number; top: number }>();
  for (const f of friends) {
    const seen = new Set<string>(); // 한 친구가 같은 책을 두 판본으로 가졌어도 한 번
    for (const b of f.books) {
      if (mine.has(b.workKey) || seen.has(b.workKey) || NOT_ONE.test(b.title)) continue;
      if (opts.only && !opts.only(b)) continue;
      const w = tasteWeight(b);
      if (w === 0) continue;
      seen.add(b.workKey);
      const e =
        by.get(b.workKey) ??
        ({ book: { title: b.title, author: b.author, coverUrl: b.coverUrl, isbn13: b.isbn13, itemId: b.itemId, workKey: b.workKey }, who: [], say: null, score: 0, best: -1, top: 0 } as FriendPick & { best: number; top: number });
      e.score += w;
      e.who.push({ handle: f.handle, nickname: f.nickname, status: b.status, rating: b.rating });
      if (!e.book.coverUrl && b.coverUrl) e.book.coverUrl = b.coverUrl;
      const r = b.rating ?? 0;
      e.top = Math.max(e.top, r);
      if (b.oneLiner && r > e.best) {
        e.best = r;
        e.say = { nickname: f.nickname, text: b.oneLiner };
      }
      by.set(b.workKey, e);
    }
  }
  return [...by.values()]
    .filter((e) => e.score >= min)
    .sort((a, b) => b.who.length - a.who.length || b.score - a.score || b.top - a.top || a.book.title.localeCompare(b.book.title))
    .slice(0, limit)
    .map(({ book, who, say, score }) => ({ book, who, say, score }));
}

/** 이 책을 읽은 친구가 좋아한 다른 책 — 같은 책을 읽은(읽는) 친구들만 골라 그 친구들이 별 4개 넘게 준 책 */
export function alsoLiked(friends: FriendShelfLite[], workKey: string, mine: Set<string>, limit = 6): FriendPick[] {
  const readers = friends.filter((f) => f.books.some((b) => b.workKey === workKey && (b.status === "read" || b.status === "reading")));
  return friendPicks(readers, new Set([...mine, workKey]), limit, { only: (b) => b.status === "read" && (b.rating ?? 0) >= 4, min: 1 });
}

/** GET /api/books/picks — 책 추가 화면 */
export type PicksView = {
  taste: Taste;
  authors: { name: string; items: PickBook[] }[]; // 많이 읽은 작가(최대 2)의 다른 책
  friends: FriendPick[]; // 친구 책장에서 — 꽂으면 통로가 열린다
};

/** GET /api/library/{id}/related — 책 상세 '이어지는 책' */
export type RelatedView = {
  author: { name: string; items: PickBook[] } | null; // 같은 작가의 다른 책
  mineByAuthor: { id: string; title: string; coverUrl: string | null }[]; // 내 책장의 같은 작가 책
  readers: { handle: string; nickname: string; status: BookStatus; rating: number | null; oneLiner: string | null }[]; // 이 책이 꽂힌 친구 책장 (통로)
  alsoLiked: FriendPick[]; // 이 책을 읽은 친구가 좋아한 다른 책
};
