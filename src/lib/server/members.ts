// 일반 회원 (아이디·비밀번호) — 11-13 사용자: "오늘은 일반 회원으로 (구글은 추후에)"
// 가입하면 바로 로그인(세션 쿠키 bb_session, lib/server/auth) → 처음 가입 3단계(/welcome). 5번 틀리면 15분 잠금.
// 비밀번호를 잊으면 관리자가 임시 비밀번호를 준다 → 마이페이지에서 바꾼다.

import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { ObjectId } from "mongodb";
import { LOCK, hashPassword, lockState, tempPassword, verifyPassword } from "@/lib/auth/password";
import { createLogin } from "./auth";
import { getDb, type UserDoc } from "./db";
import { AuthError, BadRequestError, NotFoundError } from "./errors";

const users = async () => (await getDb()).collection<UserDoc>("users");

/**
 * 관리자(개발자) 계정 — 11-13 사용자: "어드민 아이디 fe 로 잡고 비밀번호는 내가 정해서 env 에"
 * ADMIN_ID(아이디, 예: fe) + ADMIN_PASSWORD(8자 이상) 가 둘 다 있을 때만. 비밀번호는 env 가 원본이라 DB 에 저장하지 않는다.
 * 'fe' 는 2글자라 일반 가입(4자 이상)으로는 아무도 못 만든다. 5번 틀리면 15분 잠금은 똑같이.
 */
export function adminAccount(): { id: string; password: string } | null {
  const id = (process.env.ADMIN_ID ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  return id && password.length >= 8 ? { id, password } : null;
}

const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

export async function signUpWithPassword(handle: string, password: string, ua: string | null): Promise<{ user: UserDoc; token: string }> {
  if ((process.env.ADMIN_ID ?? "").trim().toLowerCase() === handle) throw new BadRequestError("쓸 수 없는 아이디예요 — 다른 아이디를 골라 주세요");
  const col = await users();
  const doc: UserDoc = {
    _id: new ObjectId(),
    nickname: "새 친구",
    handle,
    universeName: "새 친구의 도서관",
    goalCm: 100,
    visibility: "friends",
    auth: [{ provider: "password", providerId: handle }],
    passwordHash: hashPassword(password),
    onboarded: false,
    createdAt: new Date(),
  };
  try {
    await col.insertOne(doc);
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw new BadRequestError("이미 있는 아이디예요 — 다른 아이디를 골라 주세요");
    throw e;
  }
  return { user: doc, token: await createLogin(doc._id, ua) };
}

/** 로그인 — 아이디가 없거나 비밀번호가 틀리면 같은 말 (어느 쪽이 틀렸는지 알려 주지 않는다) */
export async function logInWithPassword(handle: string, password: string, ua: string | null): Promise<{ user: UserDoc; token: string }> {
  const col = await users();
  const admin = adminAccount();
  let u = await col.findOne({ handle });
  const wrong = new AuthError("아이디나 비밀번호가 맞지 않아요");
  if (admin && handle === admin.id && !u) {
    // 관리자 계정이 아직 없으면 처음 로그인할 때 만든다 (처음 가입 3단계는 건너뜀 — 운영자)
    const doc: UserDoc = {
      _id: new ObjectId(),
      nickname: "운영자",
      handle,
      universeName: "운영자의 도서관",
      goalCm: 100,
      visibility: "friends",
      auth: [{ provider: "password", providerId: handle }],
      onboarded: true,
      createdAt: new Date(),
    };
    await col.insertOne(doc).catch(() => {});
    u = await col.findOne({ handle });
  }
  const isAdminLogin = Boolean(admin && handle === admin.id);
  if (!u || (!u.passwordHash && !isAdminLogin)) throw wrong;
  const now = Date.now();
  const lock = lockState(u.loginLock, now);
  if (lock.locked) throw new AuthError(`비밀번호를 여러 번 틀려서 잠겼어요 — ${lock.minutesLeft}분 뒤에 다시 해 주세요`);
  const ok = isAdminLogin ? same(password, admin!.password) : verifyPassword(password, u.passwordHash!);
  if (!ok) {
    const fails = (u.loginLock?.until && new Date(u.loginLock.until).getTime() <= now ? 0 : (u.loginLock?.fails ?? 0)) + 1;
    const until = fails >= LOCK.fails ? new Date(now + LOCK.minutes * 60_000) : null;
    await col.updateOne({ _id: u._id }, { $set: { loginLock: { fails: until ? 0 : fails, until } } });
    if (until) throw new AuthError(`비밀번호를 ${LOCK.fails}번 틀려서 ${LOCK.minutes}분 동안 잠겼어요`);
    throw wrong;
  }
  if (u.suspendedAt) throw new AuthError("이용이 정지된 계정이에요 — 문의해 주세요");
  if (u.loginLock) await col.updateOne({ _id: u._id }, { $unset: { loginLock: "" } });
  return { user: u, token: await createLogin(u._id, ua) };
}

export async function changePassword(user: UserDoc, current: string, next: string): Promise<void> {
  const col = await users();
  const fresh = await col.findOne({ _id: user._id });
  if (!fresh?.passwordHash) throw new BadRequestError("아이디·비밀번호로 가입한 계정이 아니에요");
  if (!verifyPassword(current, fresh.passwordHash)) throw new BadRequestError("지금 비밀번호가 맞지 않아요");
  await col.updateOne({ _id: user._id }, { $set: { passwordHash: hashPassword(next) }, $unset: { loginLock: "" } });
}

/** 관리자 — 임시 비밀번호로 바꾸고 잠금도 푼다 (회원에게 전해 주면 마이페이지에서 바꾼다) */
export async function resetPassword(handle: string): Promise<string> {
  const col = await users();
  const u = await col.findOne({ handle });
  if (!u) throw new NotFoundError("그 회원이 없어요");
  if (!u.passwordHash) throw new BadRequestError("아이디·비밀번호로 가입한 회원이 아니에요");
  const temp = tempPassword();
  await col.updateOne({ _id: u._id }, { $set: { passwordHash: hashPassword(temp) }, $unset: { loginLock: "" } });
  return temp;
}
