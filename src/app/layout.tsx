import type { Metadata, Viewport } from "next";
import { Gaegu } from "next/font/google";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

// 손글씨 제목 — 한글 글자는 구글 글꼴이 조각(unicode-range)으로 필요할 때 받는다
const hand = Gaegu({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-hand", display: "swap" });

export const metadata: Metadata = {
  title: "bookbook",
  description: "나만의 책장에서 책을 꺼내 읽고 다시 꽂는 독서 기록. 같은 책이 꽂힌 친구 책장과 통로로 이어진다",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f1e3",
  viewportFit: "cover", // 전체 화면 앱에서 노치 자리까지 그린다 (안 하면 검은 띠 — 11-13). 위쪽 요소는 env(safe-area-inset-top) 만큼 내린다
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={hand.variable}>
      <body>{children}</body>
    </html>
  );
}
