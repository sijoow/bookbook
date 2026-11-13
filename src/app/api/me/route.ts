// GET /api/me — 지금 계정 (이름·아이디·한 줄 소개·로그인 방법·가입 마쳤나·아바타·집·포인트·꾸미기·다 읽은 책 수·안 연 배달 상자 수)
// PATCH /api/me { avatar?, deco?, house?, profile?: { nickname?, bio? }, onboard?: { terms, privacy, age14 } } — 바꿀 것만
// DELETE /api/me — 회원 탈퇴 (내 데이터 모두 지우고 로그아웃)

import { cookies } from "next/headers";
import { connection } from "next/server";
import { z } from "zod";
import { avatarPatchSchema, readAvatar } from "@/lib/avatar/config";
import { decoPatchSchema } from "@/lib/deco/items";
import { houseSchema, readHouse } from "@/lib/house/houses";
import { deleteAccount, finishOnboarding, onboardSchema, profileSchema, saveProfile } from "@/lib/server/account";
import { getDb, type UserDoc } from "@/lib/server/db";
import { awardWelcome, decoState, saveDeco } from "@/lib/server/deco";
import { errorResponse } from "@/lib/server/http";
import { isAdmin } from "@/lib/server/admin";
import { SESSION_COOKIE } from "@/lib/server/auth";
import { DEV_COOKIE, OUT_COOKIE, betaUser, currentUser, currentUserVia, devAllowed } from "@/lib/server/session";

export async function GET() {
  await connection(); // 빌드 때 미리 만들지 않게 (try 밖에)
  try {
    const { user: u, via } = await currentUserVia();
    return Response.json({
      handle: u.handle,
      nickname: u.nickname,
      bio: u.bio ?? "",
      universeName: u.universeName,
      login: [...new Set(u.auth.map((a) => a.provider))], // dev(시험 계정) · google (베타)
      email: u.email ?? null, // 본인에게만
      onboarded: u.onboarded !== false,
      avatar: readAvatar(u.avatar, u.handle),
      house: readHouse(u.house),
      ...(await decoState(u)),
      dev: devAllowed(),
      beta: Boolean(betaUser()), // 베타 모드 — 가입 없이 개발자 계정으로
      admin: isAdmin(u) && via !== "beta", // 마이페이지에 '관리자' 줄
      adminLogin: isAdmin(u) && via === "beta", // 베타로 들어온 관리자 — 비밀번호로 로그인하면 열린다
    });
  } catch (e) {
    return errorResponse(e);
  }
}

const patchBody = z
  .object({
    avatar: avatarPatchSchema.optional(),
    deco: decoPatchSchema.optional(),
    house: houseSchema.optional(),
    profile: profileSchema.optional(),
    onboard: onboardSchema.optional(),
  })
  .refine((b) => b.avatar || b.deco || b.house || b.profile || b.onboard, { message: "바꿀 것이 없어요" });

export async function PATCH(req: Request) {
  try {
    const u = await currentUser();
    const body = patchBody.parse(await req.json());
    const out: Record<string, unknown> = {};
    if (body.avatar) {
      const avatar = { ...readAvatar(u.avatar, u.handle), ...body.avatar };
      await (await getDb()).collection<UserDoc>("users").updateOne({ _id: u._id }, { $set: { avatar } });
      out.avatar = avatar;
    }
    if (body.deco) out.deco = await saveDeco(u, body.deco);
    if (body.house) {
      await (await getDb()).collection<UserDoc>("users").updateOne({ _id: u._id }, { $set: { house: body.house } });
      out.house = body.house;
    }
    if (body.profile) Object.assign(out, await saveProfile(u, body.profile));
    if (body.onboard) {
      await finishOnboarding(u);
      out.onboarded = true;
      out.welcome = await awardWelcome(u._id); // 처음 가입 포인트 (한 번만)
    }
    return Response.json(out);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE() {
  try {
    const u = await currentUser();
    const removed = await deleteAccount(u);
    const jar = await cookies();
    jar.delete(DEV_COOKIE);
    jar.delete(SESSION_COOKIE);
    jar.set(OUT_COOKIE, "1", { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 30 });
    return Response.json({ ok: true, removed });
  } catch (e) {
    return errorResponse(e);
  }
}
