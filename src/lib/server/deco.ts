// 포인트 · 상점 · 배달 상자 · 꾸미기 — 11-13 사용자: "책을 다 읽거나 할 때마다 포인트가 쌓이고, 장식품을 사서 내 집을 꾸민다"
// 포인트는 pointLog 에 하나하나 남기고(같은 이유·대상은 한 번만), 잔액은 users.points 에 $inc.
// 산 물건은 users.deco.boxes(배달 상자)에 들어가고, 방에서 상자를 누르면 열려서 owned 로 (규칙은 lib/deco/items).
// 옛 계정(11-12 선물 = opened 수)은 처음 읽을 때 한 번 옮기고, 다 읽은 책 포인트를 채운다(ensureEconomy).

import "server-only";
import { ObjectId } from "mongodb";
import { ITEM, POINTS, canBuy, kstDay, openBox, readDeco, readingPoints, type Deco, type DecoItem } from "@/lib/deco/items";
import { getDb, type PointLogDoc, type UserBookDoc, type UserDoc } from "./db";
import { BadRequestError } from "./errors";

async function cols() {
  const db = await getDb();
  return { users: db.collection<UserDoc>("users"), log: db.collection<PointLogDoc>("pointLog"), books: db.collection<UserBookDoc>("userBooks") };
}

/** 포인트 주기(빼기) — 같은 (reason, ref) 는 한 번만. 실제로 바뀐 만큼 돌려준다 (이미 받았으면 0) */
export async function award(userId: ObjectId, reason: PointLogDoc["reason"], ref: string, delta: number, note?: string): Promise<number> {
  if (!delta) return 0;
  const { users, log } = await cols();
  const now = new Date();
  try {
    await log.insertOne({ _id: new ObjectId(), userId, reason, ref, delta, day: kstDay(now), ...(note ? { note } : {}), createdAt: now });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return 0; // 이미 받음
    throw e;
  }
  await users.updateOne({ _id: userId }, { $inc: { points: delta } });
  return delta;
}

async function today(userId: ObjectId, reason: PointLogDoc["reason"]): Promise<{ n: number; sum: number }> {
  const { log } = await cols();
  const rows = await log.find({ userId, reason, day: kstDay(new Date()) }, { projection: { delta: 1 } }).toArray();
  return { n: rows.length, sum: rows.reduce((t, r) => t + r.delta, 0) };
}

/** 다 읽음 — 앱에서 10분 넘게 읽은 책만, 하루 3권까지 (책을 넣고 '다 읽음'만 눌러 모으는 걸 막는다) */
export async function awardFinish(userId: ObjectId, book: Pick<UserBookDoc, "_id" | "readMinutes" | "status">): Promise<number> {
  if (book.status !== "read" || (book.readMinutes ?? 0) < POINTS.finishMinMinutes) return 0;
  if ((await today(userId, "finish")).n >= POINTS.finishDailyMax) return 0;
  return award(userId, "finish", String(book._id), POINTS.finish);
}

/** 책 꽂기 — 하루 5권까지 */
export async function awardShelve(userId: ObjectId, bookId: ObjectId): Promise<number> {
  if ((await today(userId, "shelve")).n >= POINTS.shelveDailyMax) return 0;
  return award(userId, "shelve", String(bookId), POINTS.shelve);
}

/** 읽은 시간 — 10분마다, 하루 한도까지 */
export async function awardReading(userId: ObjectId, sessionId: ObjectId, minutes: number): Promise<number> {
  const pts = readingPoints(minutes, (await today(userId, "read")).sum);
  return pts > 0 ? award(userId, "read", String(sessionId), pts) : 0;
}

export async function awardWelcome(userId: ObjectId): Promise<number> {
  return award(userId, "welcome", "welcome", POINTS.welcome);
}

/** 옛 계정 한 번: 꾸미기 모양 옮기기(opened → owned·boxes) + 처음 가입·다 읽은 책 포인트 채우기 */
export async function ensureEconomy(user: UserDoc): Promise<UserDoc> {
  const raw = user.deco as unknown as Record<string, unknown> | undefined;
  const needDeco = !raw || !Array.isArray(raw.owned) || !Array.isArray(raw.boxes);
  if (!needDeco && user.pointsInit) return user;
  const { users, books } = await cols();
  if (needDeco) await users.updateOne({ _id: user._id }, { $set: { deco: readDeco(raw) } });
  if (!user.pointsInit) {
    const first = await users.updateOne({ _id: user._id, pointsInit: { $ne: true } }, { $set: { pointsInit: true } });
    if (first.modifiedCount) {
      if (user.onboarded !== false) await awardWelcome(user._id);
      const done = await books.find({ userId: user._id, status: "read", readMinutes: { $gte: POINTS.finishMinMinutes } }, { projection: { _id: 1 } }).toArray();
      for (const b of done) await award(user._id, "finish", String(b._id), POINTS.finish); // 채우기는 하루 한도 없이
    }
  }
  return (await users.findOne({ _id: user._id })) ?? user;
}

export async function readCountOf(user: UserDoc): Promise<number> {
  return (await cols()).books.countDocuments({ userId: user._id, status: "read" });
}

/** 마이·홈이 쓰는 상태 — 포인트·꾸미기·다 읽은 책 수·안 연 배달 상자 수 */
export async function decoState(user: UserDoc): Promise<{ points: number; deco: Deco; readCount: number; pending: number }> {
  const u = await ensureEconomy(user);
  const deco = readDeco(u.deco);
  return { points: u.points ?? 0, deco, readCount: await readCountOf(u), pending: deco.boxes.length };
}

/** 하고 있는 것·놓은 것·옮긴 자리 고치기 (가진 물건 안에서만). 배달 상자와 엇갈리지 않게 보낸 칸만 바꾼다 */
export async function saveDeco(user: UserDoc, patch: { worn?: string[]; placed?: string[]; pos?: Record<string, unknown>; paint?: string }): Promise<Deco> {
  const u = await ensureEconomy(user);
  const cur = readDeco(u.deco);
  const next = readDeco({ ...cur, worn: patch.worn ?? cur.worn, placed: patch.placed ?? cur.placed, pos: patch.pos ?? cur.pos, paint: patch.paint ?? cur.paint });
  const set: Record<string, unknown> = { "deco.worn": next.worn, "deco.placed": next.placed };
  if (patch.pos) set["deco.pos"] = next.pos;
  if (patch.paint) set["deco.paint"] = next.paint;
  await (await cols()).users.updateOne({ _id: u._id }, { $set: set });
  return next;
}

const NO_BUY: Record<Exclude<ReturnType<typeof canBuy>, "ok">, string> = {
  owned: "이미 가지고 있어요",
  coming: "배달 중이에요 — 방에 온 상자를 열어 보세요",
  short: "포인트가 모자라요",
  unknown: "없는 물건이에요",
};

/** 상점에서 사기 — 포인트를 빼고 배달 상자에 넣는다 (모자라거나 이미 있으면 안 바뀐다) */
export async function buyItem(user: UserDoc, id: string): Promise<{ item: DecoItem; points: number; deco: Deco }> {
  const u = await ensureEconomy(user);
  const why = canBuy(readDeco(u.deco), u.points ?? 0, id);
  if (why !== "ok") throw new BadRequestError(NO_BUY[why]);
  const item = ITEM[id];
  const { users, log } = await cols();
  // 산 물건은 배달 상자 없이 바로 — 옷·소품은 입고, 방 물건·책장 꾸미기는 놓는다 (배달 상자는 선물일 때만 — 11-13 사용자)
  const cur = readDeco(u.deco);
  const opened = openBox({ ...cur, boxes: [id] });
  if (!opened) throw new BadRequestError("모르는 물건이에요");
  const next = { ...opened.deco, boxes: cur.boxes };
  const res = await users.updateOne(
    { _id: u._id, points: { $gte: item.price }, "deco.owned": { $ne: id }, "deco.boxes": { $ne: id } },
    { $inc: { points: -item.price }, $set: { deco: next } },
  );
  if (!res.modifiedCount) throw new BadRequestError("포인트가 모자라거나 이미 샀어요");
  const now = new Date();
  await log.insertOne({ _id: new ObjectId(), userId: u._id, reason: "buy", ref: `${id}:${now.getTime()}`, delta: -item.price, day: kstDay(now), createdAt: now });
  const after = await users.findOne({ _id: u._id });
  return { item, points: after?.points ?? 0, deco: readDeco(after?.deco) };
}

/** 배달 상자 하나 열기 — 열 게 없으면 null. 두 번 눌러도 한 개만 열리게 상자 목록이 그대로일 때만 바꾼다 */
export async function openOneGift(user: UserDoc) {
  const u = await ensureEconomy(user);
  const deco = readDeco(u.deco);
  const r = openBox(deco);
  if (!r) return null;
  const res = await (await cols()).users.updateOne({ _id: u._id, "deco.boxes": deco.boxes }, { $set: { deco: r.deco } });
  if (!res.modifiedCount) return null;
  return { item: r.item, deco: r.deco, points: u.points ?? 0, pending: r.deco.boxes.length };
}

/** 포인트 내역 (최근) — 마이·상점에서 */
export async function pointHistory(user: UserDoc, limit = 30) {
  const rows = await (await cols()).log.find({ userId: user._id }).sort({ createdAt: -1 }).limit(limit).toArray();
  return rows.map((r) => ({ reason: r.reason, delta: r.delta, ref: r.reason === "buy" ? r.ref.split(":")[0] : r.ref, at: r.createdAt.toISOString(), note: r.note ?? null }));
}
