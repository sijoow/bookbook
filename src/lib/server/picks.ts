// 맞춤 추천(책 추가 화면) · 이어지는 책(책 상세) — 계산은 lib/books/picks (순수), 여기선 내 책장·친구 책장·YES24 검색을 모은다
// YES24 약관: 결과를 저장하지 않는다 (검색 원본만 24시간 캐시 — lib/yes24/client)

import "server-only";
import type { WithId } from "mongodb";
import { alsoLiked, authorPicks, friendPicks, readingTaste, type FriendShelfLite, type PickBook, type PicksView, type RelatedView, type TasteBook } from "@/lib/books/picks";
import { shortAuthor } from "@/lib/books/types";
import { normalizeFirstAuthor } from "@/lib/books/workKey";
import { searchBooks } from "@/lib/yes24/client";
import { getDb, type UserBookDoc, type UserDoc } from "./db";
import { friendIds } from "./friends";
import { getBook, listBookDocs } from "./library";

const taste = (d: WithId<UserBookDoc>): TasteBook => ({
  title: d.title,
  author: d.author,
  category: d.category,
  status: d.status,
  rating: d.rating,
  workKey: d.workKey,
  at: (d.finishedAt ?? d.updatedAt ?? d.createdAt).getTime(),
});

async function friendShelves(user: UserDoc): Promise<FriendShelfLite[]> {
  const ids = await friendIds(user);
  if (!ids.length) return [];
  const db = await getDb();
  const people = await db.collection<UserDoc>("users").find({ _id: { $in: ids } }).toArray();
  return Promise.all(
    people.map(async (f) => ({
      handle: f.handle,
      nickname: f.nickname,
      books: (await listBookDocs(f._id)).map((d) => ({
        ...taste(d),
        coverUrl: d.coverUrl,
        isbn13: d.isbn13,
        itemId: d.yes24ItemId,
        oneLiner: d.oneLinerHidden ? null : d.oneLiner, // 관리자가 숨긴 한줄평은 친구에게 안 보인다
      })),
    })),
  );
}

/** 그 작가의 다른 책 (YES24 검색 — 작가 이름으로, 첫 저자가 같은 책만). 실패하면 빈 칸 (추천은 없어도 그만) */
async function byAuthor(name: string, key: string, mine: Set<string>, limit: number): Promise<PickBook[]> {
  if (!name || !key) return [];
  try {
    const r = await searchBooks(name, 1, 40, "DEFAULT"); // 인기순 — 대표작이 먼저
    return authorPicks(r.items, key, mine, limit);
  } catch {
    return [];
  }
}

export async function picksFor(user: UserDoc): Promise<PicksView> {
  const docs = await listBookDocs(user._id);
  const mine = new Set(docs.map((d) => d.workKey));
  const t = readingTaste(docs.map(taste));
  const [authors, shelves] = await Promise.all([
    Promise.all(t.authors.slice(0, 2).map(async (a) => ({ name: a.name, items: await byAuthor(a.name, a.key, mine, 6) }))),
    friendShelves(user),
  ]);
  const friends = friendPicks(shelves, mine, 8);
  const fromFriends = new Set(friends.map((f) => f.book.workKey)); // 친구 책장에도 있는 책은 친구 칸에만 (친구 한줄평이 붙으니)
  return {
    taste: t,
    authors: authors.map((a) => ({ ...a, items: a.items.filter((b) => !fromFriends.has(b.workKey)) })).filter((a) => a.items.length > 0),
    friends,
  };
}

export async function relatedFor(user: UserDoc, bookId: string): Promise<RelatedView> {
  const { book } = await getBook(user, bookId);
  const docs = await listBookDocs(user._id);
  const mine = new Set(docs.map((d) => d.workKey));
  const key = normalizeFirstAuthor(book.author);
  const name = shortAuthor(book.author);
  const [items, shelves] = await Promise.all([byAuthor(name, key, mine, 6), friendShelves(user)]);
  const readers = shelves.flatMap((f) => {
    const b = f.books.find((x) => x.workKey === book.workKey && x.status !== "stopped");
    return b ? [{ handle: f.handle, nickname: f.nickname, status: b.status, rating: b.rating, oneLiner: b.oneLiner }] : [];
  });
  return {
    author: key && name ? { name, items } : null,
    mineByAuthor: key
      ? docs
          .filter((d) => d.workKey !== book.workKey && normalizeFirstAuthor(d.author) === key)
          .map((d) => ({ id: d._id.toHexString(), title: d.title, coverUrl: d.coverUrl }))
      : [],
    readers,
    alsoLiked: alsoLiked(shelves, book.workKey, mine, 6),
  };
}
