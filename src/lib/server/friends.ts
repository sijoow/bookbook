// 친구 책장 (멀티버스) — 초대 링크로 친구가 되고, 같은 책이 꽂힌 책장끼리 통로가 생긴다.
// 친구 책장은 친구끼리만 본다. 메모는 공개하지 않는다(isPublic 기본 false라 아예 안 내보냄).
// 친구 책을 담아 올 때 YES24 책은 친구 저장값을 복사하지 않고 YES24 에서 다시 불러온다 (약관: 축적·재배포 금지).

import "server-only";
import { randomBytes } from "node:crypto";
import { ObjectId, type WithId } from "mongodb";
import { readAvatar } from "@/lib/avatar/config";
import { readDeco, type Deco } from "@/lib/deco/items";
import { readHouse, type HouseId } from "@/lib/house/houses";
import { portalCounts, portalsBetween } from "@/lib/books/portals";
import type { BookStatus, LibraryBook } from "@/lib/books/types";
import { getDb, type FriendshipDoc, type InviteDoc, type UserBookDoc, type UserDoc } from "./db";
import { BadRequestError, NotFoundError } from "./errors";
import { addFromYes24, addManual, listBookDocs, toLibraryBook } from "./library";

const INVITE_DAYS = 7;
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // 헷갈리는 i l o 0 1 뺌

const pair = (x: ObjectId, y: ObjectId) => (x.toHexString() < y.toHexString() ? { a: x, b: y } : { a: y, b: x });

function newCode(len = 8): string {
  return [...randomBytes(len)].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

function oid(id: string): ObjectId {
  if (!ObjectId.isValid(id)) throw new NotFoundError("책을 찾을 수 없어요");
  return new ObjectId(id);
}

async function cols() {
  const db = await getDb();
  return {
    users: db.collection<UserDoc>("users"),
    friendships: db.collection<FriendshipDoc>("friendships"),
    invites: db.collection<InviteDoc>("invites"),
    books: db.collection<UserBookDoc>("userBooks"),
  };
}

const lite = (d: WithId<UserBookDoc>) => ({ id: d._id.toHexString(), workKey: d.workKey, status: d.status });

// ── 초대 ──

export async function createInvite(user: UserDoc): Promise<{ code: string; expiresAt: string }> {
  const { invites } = await cols();
  const now = new Date();
  const doc: InviteDoc = { _id: new ObjectId(), code: newCode(), inviterId: user._id, createdAt: now, expiresAt: new Date(now.getTime() + INVITE_DAYS * 86400_000) };
  await invites.insertOne(doc);
  return { code: doc.code, expiresAt: doc.expiresAt.toISOString() };
}

async function findInvite(code: string) {
  const { invites, users } = await cols();
  const inv = await invites.findOne({ code });
  if (!inv || inv.expiresAt.getTime() < Date.now()) throw new NotFoundError("초대 링크가 없거나 기한(7일)이 지났어요");
  const inviter = await users.findOne({ _id: inv.inviterId });
  if (!inviter) throw new NotFoundError("초대한 사람을 찾을 수 없어요");
  return { inv, inviter };
}

export type InviteView = {
  code: string;
  inviter: { handle: string; nickname: string; avatar: ReturnType<typeof readAvatar>; deco: { worn: string[]; placed: string[]; pos: Deco["pos"]; paint: Deco["paint"] }; house: HouseId };
  books: LibraryBook[]; // 초대한 사람 책장 미리보기
  isSelf: boolean;
  alreadyFriend: boolean;
};

export async function viewInvite(viewer: UserDoc, code: string): Promise<InviteView> {
  const { friendships } = await cols();
  const { inviter } = await findInvite(code);
  const isSelf = inviter._id.equals(viewer._id);
  const alreadyFriend = !isSelf && Boolean(await friendships.findOne(pair(viewer._id, inviter._id)));
  const books = (await listBookDocs(inviter._id)).slice(0, 30).map((d) => (d.oneLinerHidden ? { ...toLibraryBook(d), oneLiner: null } : toLibraryBook(d)));
  const d = readDeco(inviter.deco);
  return {
    code,
    inviter: { handle: inviter.handle, nickname: inviter.nickname, avatar: readAvatar(inviter.avatar, inviter.handle), deco: { worn: d.worn, placed: d.placed, pos: d.pos, paint: d.paint }, house: readHouse(inviter.house) },
    books,
    isSelf,
    alreadyFriend,
  };
}

export async function acceptInvite(viewer: UserDoc, code: string): Promise<{ handle: string; nickname: string }> {
  const { friendships } = await cols();
  const { inviter } = await findInvite(code);
  if (inviter._id.equals(viewer._id)) throw new BadRequestError("내가 만든 초대 링크예요. 친구에게 보내 주세요");
  // a<b 한 쌍 = 문서 하나 (이미 친구면 그대로)
  await friendships.updateOne(pair(viewer._id, inviter._id), { $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  return { handle: inviter.handle, nickname: inviter.nickname };
}

// ── 친구 ──

export async function friendIds(user: UserDoc): Promise<ObjectId[]> {
  const { friendships } = await cols();
  const fs = await friendships.find({ $or: [{ a: user._id }, { b: user._id }] }).toArray();
  return fs.map((f) => (f.a.equals(user._id) ? f.b : f.a));
}

export type FriendSummary = { handle: string; nickname: string; bookCount: number; open: number; faint: number };

export async function listFriends(user: UserDoc): Promise<{ me: { handle: string; nickname: string; bookCount: number }; friends: FriendSummary[] }> {
  const { users } = await cols();
  const ids = await friendIds(user);
  const mine = (await listBookDocs(user._id)).map(lite);
  const people = ids.length ? await users.find({ _id: { $in: ids } }).toArray() : [];
  const friends = await Promise.all(
    people.map(async (f) => {
      const theirs = (await listBookDocs(f._id)).map(lite);
      return { handle: f.handle, nickname: f.nickname, bookCount: theirs.length, ...portalCounts(portalsBetween(mine, theirs)) };
    }),
  );
  friends.sort((x, y) => y.open - x.open || y.faint - x.faint || x.nickname.localeCompare(y.nickname));
  return { me: { handle: user.handle, nickname: user.nickname, bookCount: mine.length }, friends };
}

async function friendByHandle(viewer: UserDoc, handle: string): Promise<WithId<UserDoc>> {
  const { users, friendships } = await cols();
  const u = await users.findOne({ handle });
  if (!u) throw new NotFoundError("그런 책장이 없어요");
  if (!u._id.equals(viewer._id) && !(await friendships.findOne(pair(viewer._id, u._id)))) throw new NotFoundError("친구 책장만 볼 수 있어요");
  return u;
}

type Side = { id: string; status: BookStatus; readMinutes: number; rating: number | null; oneLiner: string | null };
export type PortalView = { workKey: string; open: boolean; title: string; coverUrl: string | null; mine: Side; theirs: Side };

const side = (b: LibraryBook): Side => ({ id: b.id, status: b.status, readMinutes: b.readMinutes, rating: b.rating, oneLiner: b.oneLiner });

export async function friendShelf(viewer: UserDoc, handle: string) {
  const u = await friendByHandle(viewer, handle);
  const theirs = (await listBookDocs(u._id)).map((d) => (d.oneLinerHidden ? { ...toLibraryBook(d), oneLiner: null } : toLibraryBook(d)));
  const mine = (await listBookDocs(viewer._id)).map(toLibraryBook);
  const portals: PortalView[] = portalsBetween(mine, theirs).map((p) => ({
    workKey: p.workKey,
    open: p.open,
    title: p.theirs.title,
    coverUrl: p.theirs.coverUrl ?? p.mine.coverUrl,
    mine: side(p.mine),
    theirs: side(p.theirs),
  }));
  return {
    user: { handle: u.handle, nickname: u.nickname, avatar: readAvatar(u.avatar, u.handle), deco: readDeco(u.deco), house: readHouse(u.house) },
    books: theirs,
    portals,
    myWorkKeys: [...new Set(mine.map((b) => b.workKey))], // 이미 내 책장에 있는 책 (담기 버튼 대신 '내 책장에 있어요')
  };
}

/** 친구 책을 내 책장 '읽고 싶은'으로 담기 */
export async function takeFromFriend(viewer: UserDoc, handle: string, bookId: string): Promise<{ book: LibraryBook; duplicate: boolean }> {
  const { books } = await cols();
  const u = await friendByHandle(viewer, handle);
  if (u._id.equals(viewer._id)) throw new BadRequestError("내 책장의 책이에요");
  const d = await books.findOne({ _id: oid(bookId), userId: u._id });
  if (!d) throw new NotFoundError("책을 찾을 수 없어요");
  const already = (await listBookDocs(viewer._id)).find((x) => x.workKey === d.workKey);
  if (already) return { book: toLibraryBook(already), duplicate: true };
  if (d.isbn13 || d.yes24ItemId) {
    return addFromYes24(viewer, { isbn13: d.isbn13 ?? undefined, itemId: d.yes24ItemId ?? undefined, status: "want", from: "friend", friendId: u._id });
  }
  const book = await addManual(viewer, { title: d.title, author: d.author, pages: d.pages, status: "want", friendId: u._id });
  return { book, duplicate: false };
}

export async function unfriend(viewer: UserDoc, handle: string): Promise<void> {
  const { users, friendships } = await cols();
  const u = await users.findOne({ handle });
  if (!u) throw new NotFoundError("그런 책장이 없어요");
  await friendships.deleteOne(pair(viewer._id, u._id));
}
