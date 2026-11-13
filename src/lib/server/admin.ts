// 관리자 — 11-13 사용자: 어드민 페이지에 회원 관리 · 통계 대시보드 · 글 관리 · 운영 상태·공지
// 관리자 = ADMIN_EMAILS(구글 이메일, 쉼표) 또는 ADMIN_HANDLES(아이디, 쉼표). 개발 중이고 둘 다 비었으면 시험 계정 '나'(dev).
// 관리자가 아니면 /api/admin/* 는 404 (있는지도 모르게). 메모는 본인만 보는 글이라 관리자도 보지 않는다.

import "server-only";
import { randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import { kstDay } from "@/lib/deco/items";
import { readHouse } from "@/lib/house/houses";
import { deleteAccount } from "./account";
import { endAllLogins } from "./auth";
import { resetPassword } from "./members";
import { award } from "./deco";
import { getDb, type ActiveDayDoc, type PointLogDoc, type ReadingSessionDoc, type StampDoc, type UserBookDoc, type UserDoc } from "./db";
import { BadRequestError, NotFoundError } from "./errors";
import { currentUser, devAllowed } from "./session";

const list = (v: string | undefined) => (v ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);

export function isAdmin(u: UserDoc): boolean {
  const emails = list(process.env.ADMIN_EMAILS);
  const handles = list(process.env.ADMIN_HANDLES);
  const adminId = (process.env.ADMIN_ID ?? "").trim().toLowerCase(); // 관리자(개발자) 계정 fe — 비밀번호는 ADMIN_PASSWORD (members.adminAccount)
  if (adminId && u.handle.toLowerCase() === adminId && (process.env.ADMIN_PASSWORD ?? "").length >= 8) return true;
  if (!emails.length && !handles.length) return devAllowed() && u.handle === "dev";
  return (Boolean(u.email) && emails.includes(u.email!.toLowerCase())) || handles.includes(u.handle.toLowerCase());
}

/** 관리자만 — 아니면 404 */
export async function requireAdmin(): Promise<UserDoc> {
  const u = await currentUser();
  if (!isAdmin(u)) throw new NotFoundError();
  return u;
}

async function cols() {
  const db = await getDb();
  return {
    db,
    users: db.collection<UserDoc>("users"),
    books: db.collection<UserBookDoc>("userBooks"),
    sessions: db.collection<ReadingSessionDoc>("sessions"),
    stamps: db.collection<StampDoc>("stamps"),
    log: db.collection<PointLogDoc>("pointLog"),
    active: db.collection<ActiveDayDoc>("activeDays"),
    notices: db.collection<NoticeDoc>("notices"),
  };
}

// ── 통계 ──
const DAYS = 14;
function lastDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(kstDay(new Date(Date.now() - i * 86_400_000)));
  return out;
}
const KST = "+09:00";

export async function stats() {
  const c = await cols();
  const days = lastDays(DAYS);
  const since = new Date(Date.now() - DAYS * 86_400_000 - 86_400_000);
  const byDay = async <T extends object>(coll: { aggregate: (p: object[]) => { toArray(): Promise<T[]> } }, field: string, match: object, sum: unknown = 1) =>
    new Map(
      (await coll.aggregate([{ $match: { ...match, [field]: { $gte: since } } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: `$${field}`, timezone: KST } }, n: { $sum: sum } } }]).toArray()).map(
        (r) => [(r as unknown as { _id: string })._id, (r as unknown as { n: number }).n],
      ),
    );
  const [users, onboarded, today, week, booksTotal, readTotal, signups, minutes, finished, activeRows, top, bought, issued, spent] = await Promise.all([
    c.users.countDocuments(),
    c.users.countDocuments({ onboarded: { $ne: false } }),
    c.active.countDocuments({ day: kstDay(new Date()) }),
    c.active.distinct("userId", { day: { $gte: days[DAYS - 7] } }).then((x) => x.length),
    c.books.countDocuments(),
    c.books.countDocuments({ status: "read" }),
    byDay(c.users as never, "createdAt", {}),
    byDay(c.sessions as never, "endedAt", {}, "$minutes"),
    byDay(c.books as never, "finishedAt", { status: "read" }),
    c.active.aggregate<{ _id: string; n: number }>([{ $match: { day: { $gte: days[0] } } }, { $group: { _id: "$day", n: { $sum: 1 } } }]).toArray(),
    c.books
      .aggregate<{ _id: string; title: string; author: string | null; n: number }>([
        { $group: { _id: "$workKey", title: { $first: "$title" }, author: { $first: "$author" }, users: { $addToSet: "$userId" } } },
        { $project: { title: 1, author: 1, n: { $size: "$users" } } },
        { $sort: { n: -1, title: 1 } },
        { $limit: 10 },
      ])
      .toArray(),
    c.log
      .aggregate<{ _id: string; n: number }>([{ $match: { reason: "buy" } }, { $group: { _id: { $arrayElemAt: [{ $split: ["$ref", ":"] }, 0] }, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 6 }])
      .toArray(),
    c.log.aggregate<{ n: number }>([{ $match: { delta: { $gt: 0 } } }, { $group: { _id: null, n: { $sum: "$delta" } } }]).toArray(),
    c.log.aggregate<{ n: number }>([{ $match: { delta: { $lt: 0 } } }, { $group: { _id: null, n: { $sum: "$delta" } } }]).toArray(),
  ]);
  const active = new Map(activeRows.map((r) => [r._id, r.n]));
  return {
    totals: { users, onboarded, today, week, booksTotal, readTotal, pointsIssued: issued[0]?.n ?? 0, pointsSpent: -(spent[0]?.n ?? 0) },
    days: days.map((d) => ({ day: d, signups: signups.get(d) ?? 0, active: active.get(d) ?? 0, minutes: Math.round(minutes.get(d) ?? 0), finished: finished.get(d) ?? 0 })),
    topBooks: top.map((t) => ({ title: t.title, author: t.author, readers: t.n })),
    topItems: bought.map((b) => ({ id: b._id, n: b.n })),
  };
}

// ── 회원 ──
export async function listUsers(q: string, page: number) {
  const c = await cols();
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter = q ? { $or: [{ nickname: { $regex: esc, $options: "i" } }, { handle: { $regex: esc, $options: "i" } }, { email: { $regex: esc, $options: "i" } }] } : {};
  const per = 30;
  const [total, rows] = await Promise.all([c.users.countDocuments(filter), c.users.find(filter).sort({ createdAt: -1 }).skip(page * per).limit(per).toArray()]);
  const ids = rows.map((r) => r._id);
  const counts = new Map(
    (
      await c.books
        .aggregate<{ _id: ObjectId; all: number; read: number }>([
          { $match: { userId: { $in: ids } } },
          { $group: { _id: "$userId", all: { $sum: 1 }, read: { $sum: { $cond: [{ $eq: ["$status", "read"] }, 1, 0] } } } },
        ])
        .toArray()
    ).map((r) => [String(r._id), r]),
  );
  return {
    total,
    page,
    per,
    users: rows.map((u) => ({
      handle: u.handle,
      nickname: u.nickname,
      email: u.email ?? null,
      login: [...new Set(u.auth.map((a) => a.provider))],
      createdAt: u.createdAt.toISOString(),
      lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
      books: counts.get(String(u._id))?.all ?? 0,
      read: counts.get(String(u._id))?.read ?? 0,
      points: u.points ?? 0,
      house: readHouse(u.house),
      onboarded: u.onboarded !== false,
      suspended: u.suspendedAt ? { at: u.suspendedAt.toISOString(), reason: u.suspendReason ?? "" } : null,
    })),
  };
}

async function userByHandle(handle: string): Promise<UserDoc> {
  const u = await (await cols()).users.findOne({ handle });
  if (!u) throw new NotFoundError("그 회원이 없어요");
  return u;
}

/** 정지·해제 · 포인트 주기/빼기 · 닉네임 초기화 */
export async function changeUser(
  admin: UserDoc,
  handle: string,
  op: { suspend?: { reason: string } | null; points?: { delta: number; note: string }; resetNickname?: boolean; resetPassword?: boolean },
) {
  const c = await cols();
  const u = await userByHandle(handle);
  if (String(u._id) === String(admin._id) && op.suspend) throw new BadRequestError("나 자신은 정지할 수 없어요");
  if (op.suspend !== undefined) {
    if (op.suspend) {
      await c.users.updateOne({ _id: u._id }, { $set: { suspendedAt: new Date(), suspendReason: op.suspend.reason } });
      await endAllLogins(u._id); // 바로 나가게
    } else {
      await c.users.updateOne({ _id: u._id }, { $set: { suspendedAt: null }, $unset: { suspendReason: "" } });
    }
  }
  if (op.points) await award(u._id, "admin", `${admin.handle}:${Date.now()}:${randomBytes(3).toString("hex")}`, op.points.delta, op.points.note);
  if (op.resetNickname) await c.users.updateOne({ _id: u._id }, { $set: { nickname: "책 친구", universeName: "책 친구의 도서관" } });
  const temp = op.resetPassword ? await resetPassword(handle) : undefined; // 화면에 한 번만 보여 준다 (저장은 바꾼 값만)
  const after = await c.users.findOne({ _id: u._id });
  return { points: after?.points ?? 0, nickname: after?.nickname ?? u.nickname, suspended: Boolean(after?.suspendedAt), ...(temp ? { tempPassword: temp } : {}) };
}

export async function removeUser(admin: UserDoc, handle: string) {
  const u = await userByHandle(handle);
  if (String(u._id) === String(admin._id)) throw new BadRequestError("나 자신은 여기서 탈퇴시킬 수 없어요 — 마이페이지에서");
  return deleteAccount(u);
}

// ── 글 (남에게 보이는 글: 발도장 한마디 · 한줄평) ──
export type PostKind = "stamp" | "review";
export async function listPosts(kind: "all" | PostKind) {
  const c = await cols();
  const out: Array<{ kind: PostKind; id: string; text: string; by: string; byHandle: string; where: string; at: string; hidden: boolean }> = [];
  const names = new Map<string, { nickname: string; handle: string }>();
  const nameOf = async (id: ObjectId) => {
    const k = String(id);
    if (!names.has(k)) {
      const u = await c.users.findOne({ _id: id }, { projection: { nickname: 1, handle: 1 } });
      names.set(k, { nickname: u?.nickname ?? "(탈퇴)", handle: u?.handle ?? "" });
    }
    return names.get(k)!;
  };
  if (kind !== "review") {
    for (const s of await c.stamps.find({ note: { $nin: [null, ""] } }).sort({ createdAt: -1 }).limit(60).toArray()) {
      const from = await nameOf(s.fromUserId);
      const to = await nameOf(s.toUserId);
      out.push({ kind: "stamp", id: String(s._id), text: s.note ?? "", by: from.nickname, byHandle: from.handle, where: `${to.nickname}의 도서관 발도장`, at: s.createdAt.toISOString(), hidden: Boolean((s as StampDoc & { noteHidden?: boolean }).noteHidden) });
    }
  }
  if (kind !== "stamp") {
    for (const b of await c.books.find({ oneLiner: { $nin: [null, ""] } }).sort({ updatedAt: -1 }).limit(60).toArray()) {
      const by = await nameOf(b.userId);
      out.push({ kind: "review", id: String(b._id), text: b.oneLiner ?? "", by: by.nickname, byHandle: by.handle, where: `『${b.title}』 한줄평`, at: b.updatedAt.toISOString(), hidden: Boolean(b.oneLinerHidden) });
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 80);
}

export async function hidePost(kind: PostKind, id: string, hide: boolean) {
  const c = await cols();
  if (!ObjectId.isValid(id)) throw new BadRequestError("글 번호가 이상해요");
  const _id = new ObjectId(id);
  const r = kind === "stamp" ? await c.stamps.updateOne({ _id }, { $set: { noteHidden: hide } }) : await c.books.updateOne({ _id }, { $set: { oneLinerHidden: hide } });
  if (!r.matchedCount) throw new NotFoundError("글이 없어요");
  return { hidden: hide };
}

// ── 운영 상태 · 공지 ──
export type NoticeDoc = { _id: ObjectId; text: string; level: "info" | "event" | "warn"; active: boolean; createdAt: Date; by: string };

export async function opsStatus() {
  const c = await cols();
  const t0 = Date.now();
  await c.db.command({ ping: 1 });
  const ping = Date.now() - t0;
  const counts = Object.fromEntries(
    await Promise.all(["users", "userBooks", "sessions", "memos", "friendships", "visits", "stamps", "pointLog", "logins", "apiCache"].map(async (n) => [n, await c.db.collection(n).estimatedDocumentCount()] as const)),
  );
  const quota = await c.db.collection<{ _id: string; limit: number | null; remaining: number | null; at: Date }>("meta").findOne({ _id: "yes24Quota" });
  return {
    db: { ok: true, pingMs: ping, name: c.db.databaseName },
    yes24: { key: Boolean(process.env.YES24_API_KEY?.trim()), quota: quota ? { limit: quota.limit, remaining: quota.remaining, at: quota.at.toISOString() } : null },
    google: Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()),
    appUrl: process.env.APP_URL?.trim() || null,
    adminConfigured: Boolean(process.env.ADMIN_EMAILS?.trim() || process.env.ADMIN_HANDLES?.trim()),
    node: process.version,
    uptimeMin: Math.round(process.uptime() / 60),
    counts,
  };
}

export async function listNotices() {
  const rows = await (await cols()).notices.find().sort({ createdAt: -1 }).limit(30).toArray();
  return rows.map((n) => ({ id: String(n._id), text: n.text, level: n.level, active: n.active, at: n.createdAt.toISOString(), by: n.by }));
}

export async function addNotice(admin: UserDoc, text: string, level: NoticeDoc["level"]) {
  const c = await cols();
  await c.notices.updateMany({ active: true }, { $set: { active: false } }); // 한 번에 하나만 띄운다
  const doc: NoticeDoc = { _id: new ObjectId(), text, level, active: true, createdAt: new Date(), by: admin.handle };
  await c.notices.insertOne(doc);
  return { id: String(doc._id) };
}

export async function setNotice(id: string, active: boolean) {
  const c = await cols();
  if (!ObjectId.isValid(id)) throw new BadRequestError("공지 번호가 이상해요");
  if (active) await c.notices.updateMany({ active: true }, { $set: { active: false } });
  const r = await c.notices.updateOne({ _id: new ObjectId(id) }, { $set: { active } });
  if (!r.matchedCount) throw new NotFoundError("공지가 없어요");
}

export async function deleteNotice(id: string) {
  if (!ObjectId.isValid(id)) throw new BadRequestError("공지 번호가 이상해요");
  await (await cols()).notices.deleteOne({ _id: new ObjectId(id) });
}

/** 앱에 띄울 공지 (지금 켜진 것 하나) — 로그인 없이도 */
export async function currentNotice() {
  const n = await (await cols()).notices.findOne({ active: true }, { sort: { createdAt: -1 } });
  return n ? { id: String(n._id), text: n.text, level: n.level } : null;
}
