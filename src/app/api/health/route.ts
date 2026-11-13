// GET /api/health — DB 연결(인덱스 준비 포함)과 YES24 모드 확인. 비밀값은 내보내지 않는다.

import { connection } from "next/server";
import { getDb, hasDb } from "@/lib/server/db";

export async function GET() {
  await connection(); // 빌드 때 미리 만들지 말고 부를 때마다 확인
  const yes24 = process.env.YES24_API_KEY?.trim() ? "key" : process.env.NODE_ENV === "production" ? "no-key" : "mock";
  let db: "ok" | "none" | "error" = "none";
  if (hasDb()) {
    try {
      await (await getDb()).command({ ping: 1 });
      db = "ok";
    } catch (e) {
      console.error("[health] DB:", e instanceof Error ? e.message.split("\n")[0] : e);
      db = "error";
    }
  }
  const ok = db !== "error" && yes24 !== "no-key";
  return Response.json({ ok, db, yes24 }, { status: ok ? 200 : 503 });
}
