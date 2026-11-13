// 내 서재 — 책 추가·목록·수정·삭제, 메모. 책 정보는 YES24 에서 서버가 직접 가져온다(화면이 보낸 값을 믿지 않음).
// 저장은 기록용 최소 필드만 (YES24 약관: 체계적 DB 축적 금지) — 소개·가격·평점은 책 상세에서 실시간 조회.

import "server-only";
import { ObjectId, type WithId } from "mongodb";
import { estimateThicknessMm } from "@/lib/books/thickness";
import type { BookStatus, LibraryBook, Memo, ReadingSession } from "@/lib/books/types";
import { workKey } from "@/lib/books/workKey";
import { getBookByIsbn, getBookByItemId } from "@/lib/yes24/client";
import { getDb, type MemoDoc, type ReadingSessionDoc, type UserBookDoc, type UserDoc } from "./db";
import { awardFinish, awardReading, awardShelve } from "./deco";
import { NotFoundError } from "./errors";

const yes24Link = (itemId: number | null) => (itemId && itemId > 0 ? `https://m.yes24.com/goods/detail/${itemId}` : null);

export function toLibraryBook(d: WithId<UserBookDoc>): LibraryBook {
  return {
    id: d._id.toHexString(),
    isbn13: d.isbn13,
    workKey: d.workKey,
    title: d.title,
    author: d.author,
    publisher: d.publisher,
    pages: d.pages,
    currentPage: d.currentPage ?? null,
    thicknessMm: d.thicknessMm,
    thicknessSource: d.thicknessSource,
    lengthMm: d.lengthMm ?? null,
    coverUrl: d.coverUrl,
    sideCoverUrl: d.sideCoverUrl,
    category: d.category,
    status: d.status,
    rating: d.rating,
    oneLiner: d.oneLiner,
    startedAt: d.startedAt?.toISOString() ?? null,
    finishedAt: d.finishedAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
    readMinutes: d.readMinutes ?? 0,
    link: yes24Link(d.yes24ItemId),
  };
}

const toSession = (x: WithId<ReadingSessionDoc>): ReadingSession => ({
  id: x._id.toHexString(),
  bookId: x.userBookId.toHexString(),
  startedAt: x.startedAt?.toISOString() ?? null,
  endedAt: x.endedAt.toISOString(),
  minutes: x.minutes,
  fromPage: x.fromPage,
  toPage: x.toPage,
  pagesRead: x.pagesRead,
});

const toMemo = (m: WithId<MemoDoc>): Memo => ({ id: m._id.toHexString(), text: m.text, page: m.page, createdAt: m.createdAt.toISOString() });

async function cols() {
  const db = await getDb();
  return {
    books: db.collection<UserBookDoc>("userBooks"),
    memos: db.collection<MemoDoc>("memos"),
    sessions: db.collection<ReadingSessionDoc>("sessions"),
  };
}

function oid(id: string): ObjectId {
  if (!ObjectId.isValid(id)) throw new NotFoundError("책을 찾을 수 없어요");
  return new ObjectId(id);
}

/** 상태가 바뀔 때 날짜를 함께: 읽기 시작 → startedAt, 다 읽음 → finishedAt */
function statusDates(status: BookStatus, prev: Pick<UserBookDoc, "startedAt" | "finishedAt"> | null, now: Date) {
  return {
    startedAt: status === "reading" || status === "read" ? (prev?.startedAt ?? now) : (prev?.startedAt ?? null),
    finishedAt: status === "read" ? (prev?.finishedAt ?? now) : null,
  };
}

/** 책장 순서 — shelfOrder(없으면 맨 뒤) → 넣은 순서 */
function byShelf(a: UserBookDoc, b: UserBookDoc): number {
  const x = a.shelfOrder ?? Number.MAX_SAFE_INTEGER;
  const y = b.shelfOrder ?? Number.MAX_SAFE_INTEGER;
  return x - y || a.createdAt.getTime() - b.createdAt.getTime();
}

export async function listBookDocs(userId: ObjectId): Promise<WithId<UserBookDoc>[]> {
  const { books } = await cols();
  return (await books.find({ userId }).toArray()).sort(byShelf);
}

export async function listBooks(user: UserDoc): Promise<LibraryBook[]> {
  return (await listBookDocs(user._id)).map(toLibraryBook);
}

/** 책장 순서 바꾸기 — 내 책 id 를 원하는 순서대로. 빠진 책은 뒤로 (순서는 그대로) */
export async function reorderBooks(user: UserDoc, ids: string[]): Promise<LibraryBook[]> {
  const { books } = await cols();
  const mine = await listBookDocs(user._id);
  const byId = new Map(mine.map((d) => [d._id.toHexString(), d]));
  const ordered = [...new Set(ids)].filter((id) => byId.has(id)).map((id) => byId.get(id)!);
  const rest = mine.filter((d) => !ordered.includes(d));
  const all = [...ordered, ...rest];
  if (all.length) {
    await books.bulkWrite(all.map((d, i) => ({ updateOne: { filter: { _id: d._id, userId: user._id }, update: { $set: { shelfOrder: i } } } })));
  }
  return all.map((d, i) => toLibraryBook({ ...d, shelfOrder: i }));
}

export async function getBook(user: UserDoc, id: string): Promise<{ book: LibraryBook; memos: Memo[] }> {
  const { books, memos } = await cols();
  const d = await books.findOne({ _id: oid(id), userId: user._id });
  if (!d) throw new NotFoundError("책을 찾을 수 없어요");
  const ms = await memos.find({ userBookId: d._id }).sort({ createdAt: -1 }).toArray();
  return { book: toLibraryBook(d), memos: ms.map(toMemo) };
}

export async function addFromYes24(
  user: UserDoc,
  input: { isbn13?: string; itemId?: number; status: BookStatus; from?: "search" | "barcode" | "friend"; friendId?: ObjectId },
): Promise<{ book: LibraryBook; duplicate: boolean }> {
  let item = input.isbn13 ? (await getBookByIsbn(input.isbn13)).item : null;
  if (!item && input.itemId) item = (await getBookByItemId(input.itemId)).item; // ISBN 이 상세에서 안 나오는 책
  if (!item) throw new NotFoundError("YES24 에서 책을 못 찾았어요");

  const { books } = await cols();
  const same = [
    ...(item.isbn13 ? [{ isbn13: item.isbn13 }] : []),
    ...(item.itemId && item.itemId > 0 ? [{ yes24ItemId: item.itemId }] : []),
  ];
  if (same.length) {
    const existing = await books.findOne({ userId: user._id, $or: same });
    if (existing) return { book: toLibraryBook(existing), duplicate: true };
  }

  const now = new Date();
  const doc: UserBookDoc = {
    _id: new ObjectId(),
    userId: user._id,
    isbn13: item.isbn13,
    workKey: item.workKey,
    yes24ItemId: item.itemId && item.itemId > 0 ? item.itemId : null,
    title: item.title,
    author: item.author,
    publisher: item.publisher,
    pages: item.pages,
    currentPage: input.status === "read" ? item.pages : null,
    thicknessMm: item.thicknessMm,
    thicknessSource: item.thicknessSource,
    lengthMm: item.dims.length,
    coverUrl: item.coverUrl,
    sideCoverUrl: item.sideCoverUrl,
    category: item.category,
    status: input.status,
    rating: null,
    oneLiner: null,
    ...statusDates(input.status, null, now),
    addedFrom: input.friendId ? { type: "friend", friendId: input.friendId } : { type: input.from === "barcode" ? "barcode" : "search" },
    shelfOrder: now.getTime(), // 맨 끝에 꽂힌다
    createdAt: now,
    updatedAt: now,
  };
  await books.insertOne(doc);
  await awardShelve(user._id, doc._id);
  return { book: toLibraryBook(doc), duplicate: false };
}

export async function addManual(
  user: UserDoc,
  input: {
    title: string;
    author?: string | null;
    pages?: number | null;
    status: BookStatus;
    isbn13?: string | null; // 바코드는 찍었는데 YES24 에 없는 책
    coverUrl?: string | null; // 친구 책장에서 담아 올 때 (YES24 에 없는 책)
    friendId?: ObjectId;
  },
): Promise<LibraryBook> {
  const { books } = await cols();
  const now = new Date();
  const mm = estimateThicknessMm(input.pages ?? null);
  const doc: UserBookDoc = {
    _id: new ObjectId(),
    userId: user._id,
    isbn13: input.isbn13 ?? null,
    workKey: workKey(input.title, input.author ?? null),
    yes24ItemId: null,
    title: input.title,
    author: input.author || null,
    publisher: null,
    pages: input.pages ?? null,
    currentPage: input.status === "read" ? (input.pages ?? null) : null,
    thicknessMm: mm,
    thicknessSource: mm != null ? "estimate" : null,
    lengthMm: null,
    coverUrl: input.coverUrl ?? null,
    sideCoverUrl: null,
    category: null,
    status: input.status,
    rating: null,
    oneLiner: null,
    ...statusDates(input.status, null, now),
    addedFrom: input.friendId ? { type: "friend", friendId: input.friendId } : { type: "manual" },
    shelfOrder: now.getTime(), // 맨 끝에 꽂힌다
    createdAt: now,
    updatedAt: now,
  };
  await books.insertOne(doc);
  await awardShelve(user._id, doc._id);
  return toLibraryBook(doc);
}

export type BookPatch = {
  status?: BookStatus;
  rating?: number | null;
  oneLiner?: string | null;
  pages?: number | null;
  currentPage?: number | null;
};

export async function updateBook(user: UserDoc, id: string, patch: BookPatch): Promise<LibraryBook> {
  const { books } = await cols();
  const prev = await books.findOne({ _id: oid(id), userId: user._id });
  if (!prev) throw new NotFoundError("책을 찾을 수 없어요");
  const now = new Date();
  const set: Partial<UserBookDoc> = { updatedAt: now };

  if (patch.rating !== undefined) set.rating = patch.rating;
  if (patch.oneLiner !== undefined) set.oneLiner = patch.oneLiner?.trim() || null;
  if (patch.pages !== undefined) {
    set.pages = patch.pages;
    // 책등 이미지로 잰 두께는 그대로, 아니면 쪽수로 다시 추정 (YES24 반올림 값보다 정확 — 11-12 실측)
    if (prev.thicknessSource !== "spine") {
      const mm = estimateThicknessMm(patch.pages);
      set.thicknessMm = mm;
      set.thicknessSource = mm != null ? "estimate" : null;
    }
  }
  if (patch.currentPage !== undefined) set.currentPage = patch.currentPage;
  if (patch.status && patch.status !== prev.status) {
    set.status = patch.status;
    Object.assign(set, statusDates(patch.status, prev, now));
    // '읽은'으로 바꿔도 읽은 쪽은 그대로 둔다 — 다시 '읽는 중'으로 돌리면 진행이 살아 있어야 한다
    // (11-12: 읽은→읽는 중을 오가다 쪽이 끝쪽으로 덮여, 다음에 160쪽을 적었는데 '다 읽음'이 된 일)
  }

  const next = await books.findOneAndUpdate({ _id: prev._id }, { $set: set }, { returnDocument: "after" });
  if (!next) throw new NotFoundError("책을 찾을 수 없어요");
  if (prev.status !== "read" && next.status === "read") await awardFinish(user._id, next);
  return toLibraryBook(next);
}

export async function deleteBook(user: UserDoc, id: string): Promise<void> {
  const { books, memos, sessions } = await cols();
  const res = await books.deleteOne({ _id: oid(id), userId: user._id });
  if (!res.deletedCount) throw new NotFoundError("책을 찾을 수 없어요");
  await memos.deleteMany({ userBookId: new ObjectId(id), userId: user._id });
  await sessions.deleteMany({ userBookId: new ObjectId(id), userId: user._id });
}

/**
 * 책을 덮을 때 — 이번에 읽은 시간과 '몇 쪽까지'를 남긴다.
 * 시간은 타이머(startedAt~endedAt) 또는 직접 적은 minutes. 쪽은 사용자가 적은 값을 그대로 믿는다
 * (전에 적은 쪽보다 작아도 — 잘못 적었던 걸 고치는 것일 수 있다). 읽은 쪽 수는 늘어난 만큼만.
 * 마지막 쪽까지 읽었거나 finished 면 '읽은' 책이 되고, 아니면 '읽는 중'.
 */
export async function addSession(
  user: UserDoc,
  bookId: string,
  input: { startedAt?: string | null; endedAt?: string | null; minutes?: number | null; toPage?: number | null; finished?: boolean },
): Promise<{ book: LibraryBook; session: ReadingSession; points: { read: number; finish: number; balance: number } }> {
  const { books, sessions } = await cols();
  const book = await books.findOne({ _id: oid(bookId), userId: user._id });
  if (!book) throw new NotFoundError("책을 찾을 수 없어요");

  const now = new Date();
  const endedAt = input.endedAt ? new Date(input.endedAt) : now;
  const startedAt = input.startedAt ? new Date(input.startedAt) : null;
  const timed = startedAt ? Math.round((endedAt.getTime() - startedAt.getTime()) / 60000) : 0;
  const minutes = Math.max(0, Math.min(12 * 60, Math.round(input.minutes ?? timed)));

  const fromPage = book.currentPage ?? 0;
  let toPage = Math.max(0, input.toPage ?? fromPage);
  if (book.pages) toPage = Math.min(toPage, book.pages);
  const finished = Boolean(input.finished) || (book.pages != null && toPage >= book.pages);
  if (finished && book.pages) toPage = book.pages;

  const doc: ReadingSessionDoc = {
    _id: new ObjectId(),
    userId: user._id,
    userBookId: book._id,
    startedAt,
    endedAt,
    minutes,
    fromPage,
    toPage,
    pagesRead: Math.max(0, toPage - fromPage),
  };
  await sessions.insertOne(doc);

  const status: BookStatus = finished ? "read" : book.status === "read" ? "read" : "reading";
  const next = await books.findOneAndUpdate(
    { _id: book._id },
    {
      $set: { currentPage: toPage, status, ...statusDates(status, book, now), updatedAt: now },
      $inc: { readMinutes: minutes },
    },
    { returnDocument: "after" },
  );
  if (!next) throw new NotFoundError("책을 찾을 수 없어요");
  const read = await awardReading(user._id, doc._id, minutes);
  const finish = book.status !== "read" && next.status === "read" ? await awardFinish(user._id, next) : 0;
  const me = await (await getDb()).collection<UserDoc>("users").findOne({ _id: user._id }, { projection: { points: 1 } });
  return { book: toLibraryBook(next), session: toSession(doc), points: { read, finish, balance: me?.points ?? 0 } };
}

/** 잘못 남긴 기록 지우기 — 그 책의 읽은 시간에서 빼고, 읽은 쪽·상태는 건드리지 않는다 */
export async function deleteSession(user: UserDoc, sessionId: string): Promise<void> {
  const { books, sessions } = await cols();
  const doc = await sessions.findOneAndDelete({ _id: oid(sessionId), userId: user._id });
  if (!doc) throw new NotFoundError("기록을 찾을 수 없어요");
  await books.updateOne({ _id: doc.userBookId, userId: user._id }, [
    { $set: { readMinutes: { $max: [0, { $subtract: [{ $ifNull: ["$readMinutes", 0] }, doc.minutes] }] } } },
  ]);
}

export async function listSessions(user: UserDoc, days = 120): Promise<ReadingSession[]> {
  const { sessions } = await cols();
  const since = new Date(Date.now() - days * 86400_000);
  const docs = await sessions.find({ userId: user._id, endedAt: { $gte: since } }).sort({ endedAt: -1 }).limit(1000).toArray();
  return docs.map(toSession);
}

export async function addMemo(user: UserDoc, bookId: string, input: { text: string; page?: number | null }): Promise<Memo> {
  const { books, memos } = await cols();
  const book = await books.findOne({ _id: oid(bookId), userId: user._id }, { projection: { _id: 1 } });
  if (!book) throw new NotFoundError("책을 찾을 수 없어요");
  const doc: MemoDoc = {
    _id: new ObjectId(),
    userId: user._id,
    userBookId: book._id,
    text: input.text.trim(),
    page: input.page ?? null,
    isPublic: false,
    createdAt: new Date(),
  };
  await memos.insertOne(doc);
  return toMemo(doc);
}

export async function deleteMemo(user: UserDoc, memoId: string): Promise<void> {
  const { memos } = await cols();
  const res = await memos.deleteOne({ _id: oid(memoId), userId: user._id });
  if (!res.deletedCount) throw new NotFoundError("메모를 찾을 수 없어요");
}
