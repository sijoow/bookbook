// 회원 — 프로필(닉네임·한 줄 소개)·처음 가입(약관·14세 확인)·회원 탈퇴(내 데이터 모두 지우기).
// 11-12 사용자: 마이페이지(회원 페이지)를 따로 + 로그인 화면. 진짜 카카오·구글 로그인은 키를 받으면 붙인다 (지금은 시험 계정).

import "server-only";
import { z } from "zod";
import { getDb, type UserDoc } from "./db";

export const nicknameSchema = z
  .string()
  .trim()
  .min(1, "닉네임을 적어 주세요")
  .max(12, "닉네임은 12자까지예요")
  .refine((v) => !/[\n\r\t<>]/.test(v), "닉네임에 쓸 수 없는 글자가 있어요");

export const profileSchema = z.object({
  nickname: nicknameSchema.optional(),
  bio: z.string().trim().max(60, "한 줄 소개는 60자까지예요").optional(),
});

/** 처음 가입 — 필수 동의 셋 다 */
export const onboardSchema = z.object({ terms: z.literal(true), privacy: z.literal(true), age14: z.literal(true) });

export async function saveProfile(user: UserDoc, p: z.infer<typeof profileSchema>): Promise<{ nickname: string; bio: string }> {
  const set: Partial<UserDoc> = {};
  if (p.nickname !== undefined) {
    set.nickname = p.nickname;
    set.universeName = `${p.nickname}의 도서관`;
  }
  if (p.bio !== undefined) set.bio = p.bio;
  if (Object.keys(set).length) await (await getDb()).collection<UserDoc>("users").updateOne({ _id: user._id }, { $set: set });
  return { nickname: set.nickname ?? user.nickname, bio: set.bio ?? user.bio ?? "" };
}

export async function finishOnboarding(user: UserDoc): Promise<void> {
  await (await getDb()).collection<UserDoc>("users").updateOne({ _id: user._id }, { $set: { onboarded: true, agreedAt: new Date() } });
}

/** 회원 탈퇴 — 내 책·메모·읽은 기록·친구·초대·방문·도장·알림·계정을 모두 지운다 (되돌릴 수 없다) */
export async function deleteAccount(user: UserDoc): Promise<Record<string, number>> {
  const db = await getDb();
  const id = user._id;
  const out: Record<string, number> = {};
  const del = async (name: string, filter: object) => {
    out[name] = (await db.collection(name).deleteMany(filter)).deletedCount;
  };
  await del("memos", { userId: id });
  await del("sessions", { userId: id });
  await del("userBooks", { userId: id });
  await del("friendships", { $or: [{ a: id }, { b: id }] });
  await del("invites", { inviterId: id });
  await del("visits", { $or: [{ visitorId: id }, { hostId: id }] });
  await del("stamps", { $or: [{ fromUserId: id }, { toUserId: id }] });
  await del("notifications", { userId: id });
  await del("pointLog", { userId: id });
  await del("logins", { userId: id });
  await del("activeDays", { userId: id });
  await del("users", { _id: id });
  return out;
}
