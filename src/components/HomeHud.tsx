"use client";

// 홈 무대 위 버튼 — 11-13 사용자: "이 화면이 주가 돼야 (나의 아바타)" + "이런 것들은 아래쪽 퀵메뉴에 넣고, 사이드 눌렀을 때 옆에서 나오는 연출로"
// 퀵메뉴(아래 종이 막대): 책 꽂기 · 크게 보기 · 정리 · 꾸미기(안 연 선물 수) · 공유
// 옆 탭(왼쪽 가장자리 색인 탭) → 옆 서랍(나의 도서관: 숫자·읽는 중·놀러 온 친구·바로 가기)

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { SORTS, SORT_LABEL, type SortKind } from "@/lib/books/sort";
import { IconClose } from "./InkIcons";
import { MenuIcon } from "./MenuIcon";
import h from "./hud.module.css";

type QuickProps = {
  hidden?: boolean; // 읽는 동안 — 아래로 미끄러져 숨는다 (^ 로 읽기 줄을 꺼낸다)
  shelf: boolean; // 크게 보기 중
  empty: boolean; // 책이 하나도 없다 — '책 꽂기'를 반짝
  canSort: boolean;
  pending: number; // 안 연 선물
  sharing: boolean;
  onAdd: () => void;
  onZoom: () => void;
  onSort: () => void;
  onShare: () => void;
};

export function QuickMenu(p: QuickProps) {
  return (
    <nav className={`${h.quick} ${p.hidden ? h.quickHidden : ""}`} aria-label="빠른 메뉴" aria-hidden={p.hidden || undefined} inert={p.hidden || undefined}>
      <button type="button" className={`${h.qBtn} ${p.empty ? h.pulse : ""}`} onClick={p.onAdd}>
        <span className={h.qIcon}>
          <MenuIcon name="add-book" />
        </span>
        책 꽂기
      </button>
      <button type="button" className={`${h.qBtn} ${p.shelf ? h.qOn : ""}`} onClick={p.onZoom} aria-pressed={p.shelf} disabled={p.empty}>
        <span className={h.qIcon}>{p.shelf ? <MenuIcon name="house" /> : <MenuIcon name="zoom" />}</span>
        {p.shelf ? "방 보기" : "크게 보기"}
      </button>
      <button type="button" className={h.qBtn} onClick={p.onSort} disabled={!p.canSort}>
        <span className={h.qIcon}>
          <MenuIcon name="tidy" />
        </span>
        정리
      </button>
      <Link href="/decorate" className={h.qBtn}>
        <span className={h.qIcon}>
          <MenuIcon name="shop" />
        </span>
        상점
        {p.pending > 0 && (
          <i className={h.badge} aria-label={`안 연 배달 상자 ${p.pending}개`}>
            {p.pending}
          </i>
        )}
      </Link>
      <button type="button" className={h.qBtn} onClick={p.onShare} disabled={p.sharing}>
        <span className={h.qIcon}>
          <MenuIcon name="share" />
        </span>
        공유
      </button>
    </nav>
  );
}

/** 읽는 동안 아래 가운데 ^ — 누르면 읽기 줄(제목·책 덮기)이 올라온다 */
export function ReadHandle({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className={h.readHandle} onClick={onOpen} aria-label="읽기 메뉴 열기 (책 덮기)">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 15l6-6 6 6" />
      </svg>
    </button>
  );
}

export type TidyMode = "books" | "items";

type EditBarProps = {
  mode: TidyMode;
  canBooks: boolean; // 책이 둘 이상 — 책 순서
  canItems: boolean; // 옮길 수 있는 방 물건이 있다 — 물건 자리
  moved: boolean; // 옮긴 물건이 있다 ('처음 자리로')
  onMode: (m: TidyMode) => void;
  onSort: (k: SortKind) => void;
  onReset: () => void;
  onDone: () => void;
};

/**
 * 정리 중 (퀵메뉴 자리에) — '책 순서'(한 번에 정렬·책 끌기) / '물건 자리'(방 물건 끌어 옮기기) + 다 됐어요
 * 11-13 사용자: "아이템으로 받은 것들 위치도 옮기고"
 */
export function EditBar(p: EditBarProps) {
  return (
    <div className={h.editBar}>
      {p.canBooks && p.canItems && (
        <div className={h.editTabs} role="tablist" aria-label="정리할 것">
          <button type="button" role="tab" aria-selected={p.mode === "books"} className={`${h.editTab} ${p.mode === "books" ? h.editTabOn : ""}`} onClick={() => p.onMode("books")}>
            책 순서
          </button>
          <button type="button" role="tab" aria-selected={p.mode === "items"} className={`${h.editTab} ${p.mode === "items" ? h.editTabOn : ""}`} onClick={() => p.onMode("items")}>
            물건 자리
          </button>
        </div>
      )}
      {p.mode === "books" ? (
        <div className={h.editChips} role="group" aria-label="한 번에 정렬">
          {SORTS.map((k) => (
            <button key={k} type="button" className={h.editChip} onClick={() => p.onSort(k)}>
              {SORT_LABEL[k]}
            </button>
          ))}
        </div>
      ) : (
        <div className={h.editRow}>
          <span className={h.editHint}>물건을 끌어서 책장 위·바닥·벽에 놓아요</span>
          <button type="button" className={h.editChip} onClick={p.onReset} disabled={!p.moved}>
            처음 자리로
          </button>
        </div>
      )}
      <button type="button" className={h.doneBtn} onClick={p.onDone}>
        다 됐어요
      </button>
    </div>
  );
}

/** 왼쪽 가장자리 색인 탭 — 누르면 옆 서랍이 나온다 */
export function SideTab({ open, onOpen, label = "나만의 공간", badge = 0 }: { open: boolean; onOpen: () => void; label?: string; badge?: number }) {
  return (
    <button
      type="button"
      className={h.sideTab}
      onClick={onOpen}
      aria-expanded={open}
      aria-controls="home-drawer"
      aria-label={badge ? `${label} — 받을 미션 ${badge}개` : undefined}
    >
      {badge > 0 && <b className={h.sideBadge}>{badge}</b>}
      <span className={h.sideTabText}>{label}</span>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        <path d="M4 2.5 7.8 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** 무대 위 오른쪽 위 — 내 포인트 (누르면 상점) */
export function HudPoints({ points }: { points: number }) {
  return (
    <Link href="/decorate" className={h.points} aria-label={`내 포인트 ${points} — 상점으로`}>
      <i className={h.coin} aria-hidden />
      {points.toLocaleString()}
    </Link>
  );
}

/** 공지 띠 — 관리자가 띄운 것 하나. ✕ 로 닫으면 이 기기에서는 다시 안 보인다 */
export function HudNotice({ notice, onClose }: { notice: { id: string; text: string; level: "info" | "event" | "warn" }; onClose: () => void }) {
  const tag = notice.level === "event" ? "이벤트" : notice.level === "warn" ? "점검" : "알림";
  return (
    <div className={`${h.notice} ${notice.level === "warn" ? h.noticeWarn : ""}`} role="status">
      <b className={h.noticeTag}>{tag}</b>
      <span className={h.noticeText}>{notice.text}</span>
      <button type="button" className={h.noticeClose} onClick={onClose} aria-label="공지 닫기">
        <IconClose size={16} />
      </button>
    </div>
  );
}

/** 무대 위 작은 안내 (빈 책장일 때) */
export function HudHint({ children }: { children: ReactNode }) {
  return <p className={h.hint}>{children}</p>;
}

/** 무대 귀퉁이 출처 (YES24 그림이 보이는 화면) */
export function HudCredit() {
  return (
    <a className={h.credit} href="https://www.yes24.com" target="_blank" rel="noreferrer">
      도서 정보·이미지 제공: YES24
    </a>
  );
}

/** 옆 서랍 — 왼쪽에서 미끄러져 나온다. 바깥을 누르거나 왼쪽으로 밀거나 Esc 로 닫는다 */
export function SideDrawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={h.drawerRoot} data-open={open ? "1" : "0"} inert={!open}>
      <div className={h.backdrop} onClick={onClose} aria-hidden />
      <aside
        id="home-drawer"
        className={h.drawer}
        role={open ? "dialog" : undefined} // 닫혀 있을 땐 대화창이 아니다 (inert 로 숨김)
        aria-modal={open ? true : undefined}
        aria-label={title}
        onPointerDown={(e) => {
          swipe.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const s0 = swipe.current;
          swipe.current = null;
          if (s0 && e.clientX - s0.x < -60 && Math.abs(e.clientY - s0.y) < 60) onClose(); // 왼쪽으로 밀면 닫기
        }}
      >
        <div className={h.drawerHead}>
          <h2 className={h.drawerTitle}>{title}</h2>
          <button ref={closeBtn} type="button" className={h.close} onClick={onClose} aria-label="닫기">
            <IconClose size={20} />
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

/** 서랍 속 숫자 칸 */
export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className={h.stat}>
      <b className={h.statNum}>{value}</b>
      <span className={h.statLabel}>{label}</span>
    </div>
  );
}

export const hud = h;

/** 무대 왼쪽 위 — 뒤로 (친구 집에서) */
export function HudBack({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={h.back} aria-label={label}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14.5 5.5 8 12l6.5 6.5" />
      </svg>
    </Link>
  );
}

/** 무대 아래 메뉴 칸 하나 (친구 집 메뉴 등) */
export function HudButton({ icon, label, onClick, href, badge, on, disabled }: { icon: ReactNode; label: string; onClick?: () => void; href?: string; badge?: number; on?: boolean; disabled?: boolean }) {
  const body = (
    <>
      <span className={h.qIcon}>{icon}</span>
      {label}
      {badge ? <i className={h.badge}>{badge}</i> : null}
    </>
  );
  return href ? (
    <Link href={href} className={h.qBtn}>
      {body}
    </Link>
  ) : (
    <button type="button" className={`${h.qBtn} ${on ? h.qOn : ""}`} onClick={onClick} aria-pressed={on} disabled={disabled}>
      {body}
    </button>
  );
}

/** 무대 아래 메뉴 막대 — 칸 수는 children 만큼 */
export function HudBar({ children, hidden, cols }: { children: ReactNode; hidden?: boolean; cols: number }) {
  return (
    <nav className={`${h.quick} ${hidden ? h.quickHidden : ""}`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} aria-label="빠른 메뉴" aria-hidden={hidden || undefined} inert={hidden || undefined}>
      {children}
    </nav>
  );
}
