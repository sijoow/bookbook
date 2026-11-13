import type { MetadataRoute } from "next";

/** 앱 정보 (홈 화면 추가 · 안드로이드 앱 TWA 가 읽는다) — 상태 표시줄은 보이게(standalone), 세로. 아이콘 = scripts/make-icons.mjs */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "bookbook — 나만의 도서관",
    short_name: "bookbook",
    description: "책을 꺼내 읽으면 포인트가 쌓이고, 내 집을 꾸미고, 친구 도서관에 놀러 가는 독서 기록",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f7f1e3",
    theme_color: "#f7f1e3",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
