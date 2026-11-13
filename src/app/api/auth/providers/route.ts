// GET /api/auth/providers — 로그인 화면이 켤 버튼. 베타는 구글만 (11-13 사용자) — 카카오는 출시 뒤에.
// 구글은 키(GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET)가 서버에 있을 때만, 시험 계정은 개발 중에만. 값은 보내지 않는다.

import { connection } from "next/server";
import { googleKeys } from "@/lib/server/auth";
import { devAllowed } from "@/lib/server/session";

export async function GET() {
  await connection(); // 키는 실행할 때 읽는다 (빌드 때 굳히지 않게)
  return Response.json({ google: googleKeys() != null, kakao: false, dev: devAllowed() });
}
