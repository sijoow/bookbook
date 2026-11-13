// 오늘의 미션 — 진행 세기(오늘 읽은 쪽·메모·꽂은 책·놀러 간 집·발도장) · 받기(포인트 장부 reason "mission", 같은 날 같은 미션은 한 번)
// 규칙·모양은 lib/missions/missions (순수)

import "server-only";
import type { ObjectId } from "mongodb";
import { kstDay } from "@/lib/deco/items";
import { MISSIONS, STREAK_REWARD, dayNumber, missionRef, missionsView, todaysMissions, weekDays, kstStart, type ClaimId, type MissionId, type MissionsView } from "@/lib/missions/missions";
import { getDb, type ActiveDayDoc, type MemoDoc, type PointLogDoc, type ReadingSessionDoc, type StampDoc, type UserBookDoc, type UserDoc, type VisitDoc } from "./db";
import { award } from "./deco";
import { BadRequestError } from "./errors";
import { friendIds } from "./friends";

async function progress(userId: ObjectId, day: string): Promise<{ now: Record<MissionId, number>; readDays: Set<string> }> {
  const db = await getDb();
  const since = kstStart(day);
  const week = weekDays(day);
  const weekStart = kstStart(week[0]);
  const [sessions, memo, shelve, visit, stamp] = await Promise.all([
    db
      .collection<ReadingSessionDoc>("sessions")
      .find({ userId, endedAt: { $gte: weekStart } }, { projection: { endedAt: 1, pagesRead: 1, minutes: 1 } })
      .toArray(),
    db.collection<MemoDoc>("memos").countDocuments({ userId, createdAt: { $gte: since } }),
    db.collection<UserBookDoc>("userBooks").countDocuments({ userId, createdAt: { $gte: since } }),
    db.collection<VisitDoc>("visits").countDocuments({ visitorId: userId, createdAt: { $gte: since } }),
    db.collection<StampDoc>("stamps").countDocuments({ fromUserId: userId, createdAt: { $gte: since } }),
  ]);
  const readDays = new Set<string>();
  let pages = 0;
  for (const s of sessions) {
    if (s.minutes > 0 || s.pagesRead > 0) readDays.add(kstDay(s.endedAt));
    if (s.endedAt >= since) pages += Math.max(0, s.pagesRead);
  }
  return { now: { read20: pages, memo, shelve, visit, stamp }, readDays };
}

async function claimedSet(userId: ObjectId, day: string): Promise<Set<string>> {
  const db = await getDb();
  const refs = [...(Object.keys(MISSIONS) as MissionId[]).map((id) => missionRef(day, id)), missionRef(day, "all"), missionRef(day, "week"), missionRef(day, "attend")];
  const rows = await db.collection<PointLogDoc>("pointLog").find({ userId, reason: "mission", ref: { $in: refs } }, { projection: { ref: 1 } }).toArray();
  const got = new Set(rows.map((r) => r.ref));
  const out = new Set<string>();
  for (const id of Object.keys(MISSIONS) as MissionId[]) if (got.has(missionRef(day, id))) out.add(id);
  if (got.has(missionRef(day, "all"))) out.add("all");
  if (got.has(missionRef(day, "week"))) out.add("week");
  if (got.has(missionRef(day, "attend"))) out.add("attend");
  return out;
}

/** 들어온 날 — 지난 10주 (출석 이어진 날 세기) */
async function seenDays(userId: ObjectId, day: string): Promise<Set<string>> {
  const db = await getDb();
  const from = new Date((dayNumber(day) - 70) * 86_400_000).toISOString().slice(0, 10);
  const rows = await db.collection<ActiveDayDoc>("activeDays").find({ userId, day: { $gte: from } }, { projection: { day: 1 } }).toArray();
  return new Set(rows.map((r) => r.day));
}

export async function missionsFor(user: UserDoc, at = new Date()): Promise<MissionsView> {
  const day = kstDay(at);
  const ids = todaysMissions(day, (await friendIds(user)).length > 0);
  const [{ now, readDays }, claimed, seen] = await Promise.all([progress(user._id, day), claimedSet(user._id, day), seenDays(user._id, day)]);
  return missionsView(day, ids, now, claimed, readDays, seen);
}

/** 받기 — 다 한 미션(또는 이번 주 도장)만. 셋 다 받으면 보너스도 같이. 받은 만큼과 새 화면을 돌려준다 */
export async function claimMission(user: UserDoc, id: ClaimId): Promise<{ gained: number; bonus: number; view: MissionsView; points: number }> {
  const before = await missionsFor(user);
  const day = before.day;
  let gained = 0;
  let bonus = 0;
  if (id === "attend") {
    // 출석 도장 — 하루 한 번, 7일째마다 보너스
    gained = await award(user._id, "mission", missionRef(day, "attend"), before.attend.reward, "출석 체크");
    if (gained && before.attend.bonus) bonus = await award(user._id, "mission", missionRef(day, "streak"), STREAK_REWARD, `${before.attend.streak}일 이어서 출석`);
  } else if (id === "week") {
    if (!before.week.done) throw new BadRequestError(`이번 주 ${before.week.goal}일을 읽으면 받을 수 있어요`);
    gained = await award(user._id, "mission", missionRef(day, "week"), before.week.reward, "이번 주 읽은 날");
  } else {
    const m = before.missions.find((x) => x.id === id);
    if (!m) throw new BadRequestError("오늘의 미션이 아니에요");
    if (!m.done) throw new BadRequestError("아직 다 하지 않았어요");
    gained = await award(user._id, "mission", missionRef(day, id), m.reward, m.title);
    const after = before.missions.map((x) => (x.id === id ? { ...x, claimed: true } : x));
    if (after.every((x) => x.claimed) && !before.bonus.claimed) bonus = await award(user._id, "mission", missionRef(day, "all"), before.bonus.reward, "오늘의 미션 모두");
  }
  const db = await getDb();
  const u = await db.collection<UserDoc>("users").findOne({ _id: user._id }, { projection: { points: 1 } });
  return { gained, bonus, view: await missionsFor(user), points: u?.points ?? 0 };
}
