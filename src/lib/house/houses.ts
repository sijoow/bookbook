// 내가 살 집 — 11-13 사용자: "회원가입 → 나의 모습 선택 → 내가 살 집 선택" + "방도 여러 개 구도가 있었으면"
// 집마다 벽·바닥·창이 다르고, 보는 구도(카메라)가 다르다. 처음 고를 때는 모두 무료, 나중에 꾸미기에서 바꿀 수 있다.
// 3D 모양은 components/library3d/house3d.ts, 여기는 서버·화면이 같이 쓰는 이름표.

import { z } from "zod";

export const HOUSES = ["grid", "attic", "sunny", "cabin"] as const;
export type HouseId = (typeof HOUSES)[number];
export const houseSchema = z.enum(HOUSES);
export const DEFAULT_HOUSE: HouseId = "grid"; // 옛 계정 = 처음 만든 모눈종이 방

export const HOUSE: Record<HouseId, { label: string; blurb: string; view: string }> = {
  grid: { label: "모눈 방", blurb: "다이어리 속 모눈종이 방", view: "정면으로 반듯하게" },
  attic: { label: "다락방", blurb: "기울어진 나무 천장, 동그란 창", view: "비스듬히 내려다보기" },
  sunny: { label: "창가 원룸", blurb: "큰 창으로 햇살이 드는 방", view: "위에서 내려다보기" },
  cabin: { label: "숲속 오두막", blurb: "통나무 벽, 창밖은 초록 숲", view: "낮고 아늑하게" },
};

/** DB 값 → 집 (없거나 틀리면 모눈 방) */
export function readHouse(v: unknown): HouseId {
  const r = houseSchema.safeParse(v);
  return r.success ? r.data : DEFAULT_HOUSE;
}
