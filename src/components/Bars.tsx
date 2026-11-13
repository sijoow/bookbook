"use client";

// 상단바 · 하단 탭

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MenuIcon, type MenuIconName } from "./MenuIcon";
import s from "./ui.module.css";

export function TopBar({ back, title, right }: { back?: string; title?: string; right?: ReactNode }) {
  return (
    <header className={s.topbar}>
      <div className={s.topSide}>
        {back && (
          <Link href={back} className={s.back} aria-label="뒤로">
            ‹
          </Link>
        )}
      </div>
      <span className={s.logo}>{title ?? "bookbook"}</span>
      <div className={`${s.topSide} ${s.topRight}`}>{right}</div>
    </header>
  );
}

// 책장 = 내 우주 (11-12 사용자: 높이 쌓기가 아니라 나만의 책장에서 꺼내 읽고 다시 꽂는다)
const TABS: Array<{ href: string; label: string; icon: MenuIconName; match: (p: string) => boolean }> = [
  { href: "/", label: "책장", icon: "shelf", match: (p: string) => p === "/" || p.startsWith("/library") || p.startsWith("/book") || p.startsWith("/add") },
  { href: "/log", label: "기록", icon: "log", match: (p: string) => p.startsWith("/log") },
  { href: "/multiverse", label: "멀티버스", icon: "planet", match: (p: string) => p.startsWith("/multiverse") || p.startsWith("/u/") || p.startsWith("/i/") },
  { href: "/me", label: "마이", icon: "me", match: (p: string) => p.startsWith("/me") || p.startsWith("/decorate") },
];

/** 탭 모양만 — path 가 없으면(미리 그릴 때) 아무 탭도 켜지 않는다 */
export function TabNav({ path }: { path: string | null }) {
  return (
    <nav className={s.tabbar} aria-label="메뉴">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={`${s.tab} ${path && t.match(path) ? s.tabOn : ""}`} aria-current={path && t.match(path) ? "page" : undefined}>
          <span className={s.tabIcon}>
            <MenuIcon name={t.icon} size={30} />
          </span>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** 지금 주소로 켜진 탭. cacheComponents 에서 /book/[id] 처럼 주소를 미리 모르는 화면은 Suspense 안에서만 (레이아웃이 감싼다) */
export function TabBar() {
  return <TabNav path={usePathname()} />;
}
