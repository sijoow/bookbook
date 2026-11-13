/* eslint-disable @next/next/no-img-element -- 우리 아이콘 그림 (작은 webp) */
// 메뉴 그림 아이콘 — GPT 로 그린 손그림 아이콘 12장 (docs/design/prompts/assets/menu-icons.md → scripts/cut-stickers.mjs --all → public/img/icons)
// 11-13 사용자가 보여 준 레퍼런스(색 있는 손그림 메뉴 아이콘)를 따랐다. 갈색 펜 테두리 + 파스텔, 이모지·광택 없음

export type MenuIconName = "add-book" | "zoom" | "tidy" | "shop" | "share" | "paw" | "portal" | "house" | "shelf" | "log" | "planet" | "me";

export function MenuIcon({ name, size = 36 }: { name: MenuIconName; size?: number }) {
  return <img src={`/img/icons/${name}.webp`} alt="" aria-hidden width={size} height={size} draggable={false} style={{ objectFit: "contain", display: "block" }} />;
}
