// GET /api/missions — 오늘의 미션 셋 · 이번 주 읽은 날 / POST {id} — 다 한 미션 포인트 받기 (lib/server/missions)

import type { NextRequest } from "next/server";
import { connection } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/server/http";
import { claimMission, missionsFor } from "@/lib/server/missions";
import { currentUser } from "@/lib/server/session";

export async function GET() {
  await connection(); // 빌드 때 미리 만들지 않게 (try 밖에)
  try {
    return Response.json(await missionsFor(await currentUser()));
  } catch (e) {
    return errorResponse(e);
  }
}

const Claim = z.object({ id: z.enum(["read20", "memo", "shelve", "visit", "stamp", "week"]) });

export async function POST(req: NextRequest) {
  try {
    const { id } = Claim.parse(await req.json());
    return Response.json(await claimMission(await currentUser(), id));
  } catch (e) {
    return errorResponse(e);
  }
}
