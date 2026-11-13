// 친구 도서관에 놀러 가기 — 다녀간 기록(같은 친구는 3시간에 한 번만 셈)과 발도장(스티커 + 짧은 한마디).
// 11-12 사용자: "친구네 집 놀러 가서 방문하기 … 내 책장 공유하기 하면서". 집주인은 '놀러 온 친구'에서 본다 (14일).
// 친구끼리만 — friendShelf 와 같은 확인을 거친다.

import "server-only";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { readAvatar, type AvatarConfig } from "@/lib/avatar/config";
import { getDb, type StampDoc, type UserDoc, type VisitDoc } from "./db";
import { BadRequestError, NotFoundError } from "./errors";

export const STAMP_KINDS = ["star", "heart", "flower", "book"] as const;
export type StampKind = (typeof STAMP_KINDS)[number];
export const stampSchema = z.object({
  kind: z.enum(STAMP_KINDS),
  note: z.string().trim().max(40, "한마디는 40자까지예요").optional(),
});

const VISIT_GAP_MS = 3 * 3600_000;
const SHOW_DAYS = 14;

async function cols() {
  const db = await getDb();
  return {
    users: db.collection<UserDoc>("users"),
    visits: db.collection<VisitDoc>("visits"),
    stamps: db.collection<StampDoc>("stamps"),
    friendships: db.collection<{ _id: ObjectId; a: ObjectId; b: ObjectId }>("friendships"),
  };
}

/** 친구인 집주인 (아니면 404 — 남의 도서관은 친구끼리만) */
async function hostOf(viewer: UserDoc, handle: string): Promise<UserDoc> {
  const { users, friendships } = await cols();
  const host = await users.findOne({ handle });
  if (!host) throw new NotFoundError("그런 도서관이 없어요");
  if (host._id.equals(viewer._id)) throw new BadRequestError("내 도서관이에요");
  const [a, b] = viewer._id.toHexString() < host._id.toHexString() ? [viewer._id, host._id] : [host._id, viewer._id];
  if (!(await friendships.findOne({ a, b }))) throw new NotFoundError("책장 친구만 놀러 갈 수 있어요");
  return host;
}

/** 놀러 왔다 — 3시간 안에 또 오면 새로 세지 않는다 */
export async function recordVisit(viewer: UserDoc, handle: string): Promise<{ counted: boolean }> {
  const { visits } = await cols();
  const host = await hostOf(viewer, handle);
  const since = new Date(Date.now() - VISIT_GAP_MS);
  const recent = await visits.findOne({ visitorId: viewer._id, hostId: host._id, createdAt: { $gte: since } });
  if (recent) return { counted: false };
  await visits.insertOne({ _id: new ObjectId(), visitorId: viewer._id, hostId: host._id, viaWorkKey: null, createdAt: new Date() });
  return { counted: true };
}

/** 발도장 남기기 */
export async function leaveStamp(viewer: UserDoc, handle: string, input: z.infer<typeof stampSchema>): Promise<void> {
  const { stamps } = await cols();
  const host = await hostOf(viewer, handle);
  await stamps.insertOne({
    _id: new ObjectId(),
    fromUserId: viewer._id,
    toUserId: host._id,
    userBookId: null,
    kind: input.kind,
    note: input.note || null,
    createdAt: new Date(),
  });
}

export type GuestView = {
  handle: string;
  nickname: string;
  avatar: AvatarConfig;
  at: string; // 마지막으로 다녀간 때
  stamp: { kind: string; note: string | null; at: string } | null; // 가장 최근 발도장
};

/** 놀러 온 친구 (14일, 사람마다 하나 — 최근 순) */
export async function listGuests(host: UserDoc): Promise<GuestView[]> {
  const { users, visits, stamps } = await cols();
  const since = new Date(Date.now() - SHOW_DAYS * 86400_000);
  const vs = await visits.find({ hostId: host._id, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(200).toArray();
  const ss = await stamps.find({ toUserId: host._id, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(200).toArray();
  const last = new Map<string, Date>();
  for (const v of vs) if (!last.has(v.visitorId.toHexString())) last.set(v.visitorId.toHexString(), v.createdAt);
  const stampBy = new Map<string, StampDoc>();
  for (const st of ss) {
    const k = st.fromUserId.toHexString();
    if (!stampBy.has(k)) stampBy.set(k, st);
    const at = last.get(k);
    if (!at || st.createdAt > at) last.set(k, st.createdAt);
  }
  const ids = [...last.keys()].map((h) => new ObjectId(h));
  const people = await users.find({ _id: { $in: ids } }).toArray();
  return people
    .map((u) => {
      const st = stampBy.get(u._id.toHexString());
      return {
        handle: u.handle,
        nickname: u.nickname,
        avatar: readAvatar(u.avatar, u.handle),
        at: (last.get(u._id.toHexString()) ?? new Date(0)).toISOString(),
        stamp: st ? { kind: st.kind, note: st.noteHidden ? null : (st.note ?? null), at: st.createdAt.toISOString() } : null,
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 20);
}
