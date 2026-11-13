// 책마을 — 둘만의 이야기(채팅) · 책 추천 · '지금 읽는 중' (11-13 사용자: "친구가 책을 읽고 있는지 보이고, 그 집에 놀러 가서 둘만 대화" + "친구한테 책 추천")
// 친구끼리만. 메모처럼 남이 볼 수 없는 글이라 관리자 화면에도 안 보인다. 탈퇴·친구 끊기 땐 지운다.

import "server-only";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb, type ChatDoc, type UserBookDoc, type UserDoc } from "./db";
import { BadRequestError, NotFoundError } from "./errors";
import { friendByHandle, friendIds } from "./friends";

export const READING_FRESH_MS = 3 * 3_600_000; // 3시간 넘게 안 덮으면 '읽는 중'을 끈다

export const pairOf = (a: ObjectId, b: ObjectId) => [a.toHexString(), b.toHexString()].sort().join("|");

const chats = async () => (await getDb()).collection<ChatDoc>("chats");

export type ChatBook = { title: string; author: string | null; coverUrl: string | null; isbn13: string | null; itemId: number | null };
export type ChatMsg = { id: string; mine: boolean; text: string; book: ChatBook | null; gift: string | null; at: string };

const toMsg = (d: ChatDoc, me: ObjectId): ChatMsg => ({ id: d._id.toHexString(), mine: d.from.equals(me), text: d.text, book: d.book ?? null, gift: d.gift ?? null, at: d.createdAt.toISOString() });

/** 그 친구와의 이야기 (최근 80개, after 가 있으면 그 뒤만) — 내게 온 건 읽음으로 */
export async function chatWith(viewer: UserDoc, handle: string, after?: Date): Promise<{ friend: { handle: string; nickname: string; reading: ReadingView | null }; messages: ChatMsg[] }> {
  const f = await friendByHandle(viewer, handle);
  if (f._id.equals(viewer._id)) throw new BadRequestError("나와는 이야기할 수 없어요");
  const c = await chats();
  const pair = pairOf(viewer._id, f._id);
  const q = after ? { pair, createdAt: { $gt: after } } : { pair };
  const rows = (await c.find(q).sort({ createdAt: -1 }).limit(80).toArray()).reverse();
  await c.updateMany({ pair, to: viewer._id, readAt: null }, { $set: { readAt: new Date() } });
  return { friend: { handle: f.handle, nickname: f.nickname, reading: readingOf(f) }, messages: rows.map((d) => toMsg(d, viewer._id)) };
}

export const chatInput = z
  .object({
    text: z.string().trim().max(200, "200자까지 쓸 수 있어요").optional(),
    book: z.object({ title: z.string().min(1).max(200), author: z.string().max(200).nullable(), coverUrl: z.string().url().max(500).nullable(), isbn13: z.string().max(20).nullable(), itemId: z.number().int().nullable() }).optional(),
  })
  .refine((v) => Boolean(v.text) || Boolean(v.book), { message: "보낼 말을 적어 주세요" });

/** 보내기 — 말 또는 책 추천(+ 한마디). 1초에 한 번 */
export async function sendChat(viewer: UserDoc, handle: string, input: z.infer<typeof chatInput>, gift: string | null = null): Promise<ChatMsg> {
  const f = await friendByHandle(viewer, handle);
  if (f._id.equals(viewer._id)) throw new BadRequestError("나에게는 보낼 수 없어요");
  const c = await chats();
  const pair = pairOf(viewer._id, f._id);
  const last = await c.findOne({ pair, from: viewer._id }, { sort: { createdAt: -1 } });
  if (last && Date.now() - last.createdAt.getTime() < 1000) throw new BadRequestError("조금 천천히 보내 주세요");
  const doc: ChatDoc = { _id: new ObjectId(), pair, from: viewer._id, to: f._id, text: input.text ?? "", book: input.book ?? null, gift, createdAt: new Date(), readAt: null };
  await c.insertOne(doc);
  return toMsg(doc, viewer._id);
}

/** 홈 서랍 — 친구마다 안 읽은 이야기 수와 마지막 말 */
export async function unreadChats(viewer: UserDoc): Promise<{ handle: string; nickname: string; count: number; last: string; at: string }[]> {
  const c = await chats();
  const rows = await c
    .aggregate<{ _id: ObjectId; count: number; last: ChatDoc }>([
      { $match: { to: viewer._id, readAt: null } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$from", count: { $sum: 1 }, last: { $first: "$$ROOT" } } },
      { $limit: 20 },
    ])
    .toArray();
  if (!rows.length) return [];
  const people = await (await getDb()).collection<UserDoc>("users").find({ _id: { $in: rows.map((r) => r._id) } }, { projection: { handle: 1, nickname: 1 } }).toArray();
  const by = new Map(people.map((p) => [p._id.toHexString(), p]));
  return rows
    .map((r) => {
      const p = by.get(r._id.toHexString());
      const l = r.last;
      return p ? { handle: p.handle, nickname: p.nickname, count: r.count, last: l.gift ? "선물을 보냈어요" : l.book ? `『${l.book.title}』 추천` : l.text, at: l.createdAt.toISOString() } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

// ── 지금 읽는 중 ──

export type ReadingView = { title: string; coverUrl: string | null; since: string };

export function readingOf(u: Pick<UserDoc, "readingNow">): ReadingView | null {
  const r = u.readingNow;
  if (!r || Date.now() - r.since.getTime() > READING_FRESH_MS) return null;
  return { title: r.title, coverUrl: r.coverUrl, since: r.since.toISOString() };
}

/** 책을 꺼내 읽기 시작하면 켜고, 덮으면 끈다 (친구 목록·친구 집에 '읽는 중') */
export async function setReadingNow(user: UserDoc, bookId: string | null): Promise<void> {
  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  if (!bookId) {
    await users.updateOne({ _id: user._id }, { $unset: { readingNow: "" } });
    return;
  }
  if (!ObjectId.isValid(bookId)) throw new BadRequestError("책을 찾을 수 없어요");
  const b = await db.collection<UserBookDoc>("userBooks").findOne({ _id: new ObjectId(bookId), userId: user._id }, { projection: { title: 1, coverUrl: 1 } });
  if (!b) throw new NotFoundError("책을 찾을 수 없어요");
  await users.updateOne({ _id: user._id }, { $set: { readingNow: { bookId, title: b.title, coverUrl: b.coverUrl, since: new Date() } } });
}

/** 지금 읽는 친구 (홈·멀티버스) */
export async function readingFriends(user: UserDoc): Promise<{ handle: string; nickname: string; reading: ReadingView }[]> {
  const ids = await friendIds(user);
  if (!ids.length) return [];
  const people = await (await getDb())
    .collection<UserDoc>("users")
    .find({ _id: { $in: ids }, "readingNow.since": { $gt: new Date(Date.now() - READING_FRESH_MS) } }, { projection: { handle: 1, nickname: 1, readingNow: 1 } })
    .toArray();
  return people.flatMap((p) => {
    const r = readingOf(p);
    return r ? [{ handle: p.handle, nickname: p.nickname, reading: r }] : [];
  });
}
