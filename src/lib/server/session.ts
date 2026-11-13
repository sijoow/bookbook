// 지금 쓰는 사람 — 1) 진짜 로그인(세션 쿠키 bb_session, lib/server/auth) 2) 베타 모드(BETA_USER)면 그 계정 3) 개발 중이면 시험 계정.
// 베타 모드 (11-13 사용자: "가입자를 받는 게 아니라 내가 베타로 쓸 거라 개발자 계정으로 무조건 로그인되게") — 로그인 없이 BETA_USER(fe)로.
//   개발 중엔 시험 계정 넷(나·지민·현우·엄마)만 쿠키로 바꿔 볼 수 있고('새로 가입해 보기'는 꺼짐), 로그아웃해도 다시 그 계정.
//   관리자 화면은 베타로 들어온 것만으론 안 열린다 — fe 비밀번호로 로그인해야 (admin.requireAdmin).
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

/** 베타 모드 계정 (BETA_USER, 예: fe) — 없으면 null */
export const betaUser = (): string | null => (process.env.BETA_USER ?? "").trim().toLowerCase() || null;

/** 어떻게 들어왔나 — session: 진짜 로그인 · beta: 베타 모드로 저절로 · dev: 개발 중 시험 계정 */
export type Via = "session" | "beta" | "dev";

/** 베타 계정 — 없으면 만든다 (처음 가입 단계는 건너뜀). 관리자 계정(ADMIN_ID)과 같은 아이디면 같은 계정 */
async function ensureBeta(handle: string): Promise<UserDoc> {
  const users = (await getDb()).collection<UserDoc>("users");
  const u = await users.findOneAndUpdate(
    { handle },
    {
      $setOnInsert: {
        nickname: "운영자",
        handle,
        universeName: "운영자의 도서관",
        goalCm: 100,
        visibility: "friends",
        auth: [{ provider: "password", providerId: handle }],
        onboarded: true,
        createdAt: new Date(),
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  if (!u) throw new AuthError("베타 계정을 못 만들었어요");
  return u;
}

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
  return (await currentUserVia()).user;
}

export async function currentUserVia(): Promise<{ user: UserDoc; via: Via }> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const u = await userFromToken(token);
    if (u) return { user: await ready(u), via: "session" };
  }
  const handle = jar.get(DEV_COOKIE)?.value;
  const beta = betaUser();
  if (beta) {
    const acc = devAllowed() ? DEV_ACCOUNTS.find((a) => a.handle === handle) : undefined;
    if (acc) return { user: await ready(await ensureUser(acc.handle, acc.nickname)), via: "dev" };
    return { user: await ready(await ensureBeta(beta)), via: "beta" };
  }
  if (!devAllowed()) throw new AuthError();
  if (jar.get(OUT_COOKIE)?.value) throw new AuthError("로그아웃했어요 — 다시 로그인해 주세요");
  if (handle && NEW_HANDLE.test(handle)) return { user: await ready(await ensureUser(handle, "새 친구", { onboarded: false })), via: "dev" };
  const acc = DEV_ACCOUNTS.find((a) => a.handle === handle) ?? DEV_ACCOUNTS[0];
  return { user: await ready(await ensureUser(acc.handle, acc.nickname)), via: "dev" };
}

/** 정지된 계정은 막고, 마지막 접속을 남긴다 (관리자 통계) */
async function ready(u: UserDoc): Promise<UserDoc> {
  if (u.suspendedAt) throw new AuthError("이용이 정지된 계정이에요 — 문의해 주세요");
  await touchSeen(u).catch(() => {});
  return u;
}
