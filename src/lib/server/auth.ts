// 진짜 로그인 — 세션 쿠키(bb_session) · 구글 계정 찾기/만들기 · 마지막 접속(관리자 통계).
// 쿠키에는 무작위 토큰, DB(logins)에는 그 해시만 둔다. 60일, 쓰면 하루에 한 번 늘어난다. 로그아웃·탈퇴·정지 때 지운다.

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import type { NextRequest } from "next/server";
import type { GoogleProfile } from "@/lib/auth/google";
import { kstDay } from "@/lib/deco/items";
import { getDb, type ActiveDayDoc, type LoginDoc, type UserDoc } from "./db";

export const SESSION_COOKIE = "bb_session";
export const OAUTH_COOKIE = "bb_oauth"; // 구글로 보내는 동안 state·verifier (10분)
const DAYS = 60;
const DAY_MS = 86_400_000;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const secure = () => process.env.NODE_ENV === "production";

/** 서버에 구글 키가 있나 (값은 밖으로 보내지 않는다) */
export function googleKeys(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** 우리 앱 주소 — 운영은 APP_URL(구글 콘솔에 넣은 주소와 같아야 한다), 없으면 들어온 주소 */
export function appOrigin(req: NextRequest): string {
  return process.env.APP_URL?.trim().replace(/\/$/, "") || req.nextUrl.origin;
}

export function sessionCookie(token: string) {
  return { name: SESSION_COOKIE, value: token, httpOnly: true, sameSite: "lax" as const, secure: secure(), path: "/", maxAge: DAYS * 86_400 };
}
export function oauthCookie(value: string) {
  return { name: OAUTH_COOKIE, value, httpOnly: true, sameSite: "lax" as const, secure: secure(), path: "/api/auth/google", maxAge: 600 };
}

export async function createLogin(userId: ObjectId, ua: string | null): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await (await getDb()).collection<LoginDoc>("logins").insertOne({
    _id: new ObjectId(),
    tokenHash: hash(token),
    userId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + DAYS * DAY_MS),
    ua: ua ? ua.slice(0, 160) : null,
  });
  return token;
}

/** 쿠키 토큰 → 사용자 (없거나 지났으면 null). 쓰면 하루에 한 번 60일을 다시 센다 */
export async function userFromToken(token: string): Promise<UserDoc | null> {
  const db = await getDb();
  const logins = db.collection<LoginDoc>("logins");
  const login = await logins.findOne({ tokenHash: hash(token) });
  if (!login || login.expiresAt.getTime() < Date.now()) return null;
  const user = await db.collection<UserDoc>("users").findOne({ _id: login.userId });
  if (!user) return null;
  const now = Date.now();
  if (now - login.lastSeenAt.getTime() > DAY_MS) {
    await logins.updateOne({ _id: login._id }, { $set: { lastSeenAt: new Date(now), expiresAt: new Date(now + DAYS * DAY_MS) } });
  }
  return user;
}

export async function endLogin(token: string): Promise<void> {
  await (await getDb()).collection<LoginDoc>("logins").deleteOne({ tokenHash: hash(token) });
}

/** 그 사람의 로그인 모두 끊기 (탈퇴·정지) */
export async function endAllLogins(userId: ObjectId): Promise<number> {
  return (await (await getDb()).collection<LoginDoc>("logins").deleteMany({ userId })).deletedCount;
}

/** 마지막 접속 + 오늘 들어온 사람 (한 시간에 한 번만 쓴다) */
export async function touchSeen(user: UserDoc): Promise<void> {
  const now = new Date();
  if (user.lastSeenAt && now.getTime() - user.lastSeenAt.getTime() < 3_600_000) return;
  const db = await getDb();
  await db.collection<UserDoc>("users").updateOne({ _id: user._id }, { $set: { lastSeenAt: now } });
  const day = kstDay(now);
  await db
    .collection<ActiveDayDoc>("activeDays")
    .updateOne({ userId: user._id, day }, { $setOnInsert: { _id: new ObjectId(), userId: user._id, day, at: now } }, { upsert: true })
    .catch(() => {}); // 동시에 두 번이면 하나는 겹침 오류 — 괜찮다
}

/** 구글 계정 → 우리 사용자 (처음이면 만든다: 닉네임 '새 친구', 가입 화면부터). 아이디는 무작위 (이메일을 친구에게 보이지 않게) */
export async function googleUser(p: GoogleProfile): Promise<UserDoc> {
  const users = (await getDb()).collection<UserDoc>("users");
  const found = await users.findOne({ googleSub: p.sub });
  if (found) {
    if (p.email && p.email !== found.email) await users.updateOne({ _id: found._id }, { $set: { email: p.email } });
    return found;
  }
  for (let i = 0; i < 5; i++) {
    const doc: UserDoc = {
      _id: new ObjectId(),
      nickname: "새 친구",
      handle: `b${randomBytes(4).toString("hex").slice(0, 7)}`,
      universeName: "새 친구의 도서관",
      goalCm: 100,
      visibility: "friends",
      auth: [{ provider: "google", providerId: p.sub }],
      googleSub: p.sub,
      ...(p.email ? { email: p.email } : {}),
      onboarded: false,
      createdAt: new Date(),
    };
    try {
      await users.insertOne(doc);
      return doc;
    } catch (e) {
      if ((e as { code?: number }).code !== 11000) throw e;
      const again = await users.findOne({ googleSub: p.sub }); // 동시에 두 번 눌렀다
      if (again) return again;
      // 아이디가 겹쳤다 — 다시
    }
  }
  throw new Error("계정을 만들지 못했어요");
}
