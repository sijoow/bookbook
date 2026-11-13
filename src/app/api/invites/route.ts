// POST /api/invites — 책장 친구 초대 링크 만들기 (7일 유효) → { code, expiresAt }

import { errorResponse } from "@/lib/server/http";
import { createInvite } from "@/lib/server/friends";
import { currentUser } from "@/lib/server/session";

export async function POST() {
  try {
    return Response.json(await createInvite(await currentUser()), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
