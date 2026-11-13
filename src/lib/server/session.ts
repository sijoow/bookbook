// 지금 쓰는 사람 — 1) 진짜 로그인(구글 → 세션 쿠키 bb_session, lib/server/auth) 2) 개발 중이면 시험 계정.
// 시험 계정은 개발(npm run dev·dev:mem)에서만 — 운영에서 로그인 없이 부르면 401. 정지된 계정은 401.
// 시험 계정은 쿠키(bb_dev)로 바꾼다: 나(dev)·지민·현우·엄마 — 친구 책장(멀티버스)을 혼자서 시험하려고.

import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, touchSeen, userFromToken } from "./auth";
import { getDb, type UserDoc } from "./db";
import { AuthError } from "./errors";

export const DEV_COOKIE = "bb_dev";
export const OUT_COOKIE = "bb_out"; // 로그아웃했다 — 개발 중 '나' 계정으로 저절로 들어가지 않게
export const NEW_HANDLE = /^new-[a-z0-9]{4,10}$/; // '새로 가입해 보기' 시험 계정

export const DEV_ACCOUNTS = [
  { handle: "dev", nickname: "나" },
  { handle: "jimin", nickname: "지민" },
  { handle: "hyunwoo", nickname: "현우" },
  { handle: "mom", nickname: "엄마" },
] as const;

export const devAllowed = () => process.env.NODE_ENV !== "production" || process.env.DEV_LOGIN === "1";

export async function ensureUser(handle: string, nickname: string, opts: { onboarded?: boolean } = {}): Promise<UserDoc> {
  const users = (await getDb()).collection<UserDoc>("users");
  const user = await users.findOneAndUpdate(
    { handle },
    {
      $setOnInsert: {
        nickname,
        handle,
        universeName: `${nickname === "나" ? "나" : nickname}의 책장`,
        goalCm: 100,
        visibility: "friends",
        auth: [{ provider: "dev", providerId: handle }],
        ...(opts.onboarded === false ? { onboarded: false } : {}),
        createdAt: new Date(),
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  if (!user) throw new AuthError("시험 계정을 못 만들었어요");
  return user;
}

export async function currentUser(): Promise<UserDoc> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const u = await userFromToken(token);
    if (u) return ready(u);
  }
  if (!devAllowed()) throw new AuthError();
  if (jar.get(OUT_COOKIE)?.value) throw new AuthError("로그아웃했어요 — 다시 로그인해 주세요");
  const handle = jar.get(DEV_COOKIE)?.value;
  if (handle && NEW_HANDLE.test(handle)) return ready(await ensureUser(handle, "새 친구", { onboarded: false }));
  const acc = DEV_ACCOUNTS.find((a) => a.handle === handle) ?? DEV_ACCOUNTS[0];
  return ready(await ensureUser(acc.handle, acc.nickname));
}

/** 정지된 계정은 막고, 마지막 접속을 남긴다 (관리자 통계) */
async function ready(u: UserDoc): Promise<UserDoc> {
  if (u.suspendedAt) throw new AuthError("이용이 정지된 계정이에요 — 문의해 주세요");
  await touchSeen(u).catch(() => {});
  return u;
}
