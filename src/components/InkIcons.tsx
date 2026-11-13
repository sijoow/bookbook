// 갈색 펜으로 그린 작은 아이콘 — 퀵메뉴·옆 서랍용 (A · 다꾸: 이모지·광택 없이 선만, 끝은 둥글게)
// 색은 currentColor (부모 글자색 = 갈색 펜)

import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Ink({ size = 26, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  );
}

/** 책 꽂기 — 책등 하나 + 더하기 */
export const IconAddBook = (p: P) => (
  <Ink {...p}>
    <rect x="3.5" y="3.5" width="8.5" height="17" rx="1.6" />
    <path d="M3.5 7.2h8.5M3.5 16.8h8.5" />
    <path d="M18 8.5v8M14 12.5h8" />
  </Ink>
);

/** 크게 보기 — 돋보기 */
export const IconZoom = (p: P) => (
  <Ink {...p}>
    <circle cx="10.5" cy="10.5" r="6.2" />
    <path d="M15.2 15.2 20.5 20.5" />
    <path d="M10.5 7.8v5.4M7.8 10.5h5.4" />
  </Ink>
);

/** 방 보기 — 작은 집 */
export const IconRoom = (p: P) => (
  <Ink {...p}>
    <path d="M3.5 11.2 12 4.5l8.5 6.7" />
    <path d="M6 9.6V20h12V9.6" />
    <path d="M10.2 20v-5.2h3.6V20" />
  </Ink>
);

/** 책장 정리 — 키가 다른 책 셋 */
export const IconSort = (p: P) => (
  <Ink {...p}>
    <rect x="3.5" y="9" width="4.6" height="11.5" rx="1" />
    <rect x="9.7" y="4" width="4.6" height="16.5" rx="1" />
    <rect x="15.9" y="11.5" width="4.6" height="9" rx="1" transform="rotate(-8 18.2 16)" />
  </Ink>
);

/** 꾸미기 — 리본 묶은 선물 상자 */
export const IconGift = (p: P) => (
  <Ink {...p}>
    <rect x="4" y="10.5" width="16" height="10" rx="1.6" />
    <rect x="3" y="7.5" width="18" height="3.4" rx="1" />
    <path d="M12 7.5v13" />
    <path d="M12 7.4C10.6 3.6 6.4 4.2 7.6 6.6 8.2 7.5 10 7.5 12 7.4ZM12 7.4c1.4-3.8 5.6-3.2 4.4-.8-.6.9-2.4.9-4.4.8Z" />
  </Ink>
);

/** 공유 — 상자 밖으로 화살표 */
export const IconShare = (p: P) => (
  <Ink {...p}>
    <path d="M8.5 10.5H6.2v9.8h11.6v-9.8h-2.3" />
    <path d="M12 3.6v11.2M8.4 7.2 12 3.6l3.6 3.6" />
  </Ink>
);

/** 닫기 */
export const IconClose = (p: P) => (
  <Ink {...p}>
    <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
  </Ink>
);

/** 관리자 — 대시보드 (막대) */
export const IconChart = (p: P) => (
  <Ink {...p}>
    <path d="M4 20.5h16.5" />
    <rect x="5.5" y="11" width="3.4" height="7.5" rx="1" />
    <rect x="10.6" y="6" width="3.4" height="12.5" rx="1" />
    <rect x="15.7" y="13.5" width="3.4" height="5" rx="1" />
  </Ink>
);

/** 관리자 — 회원 (두 사람) */
export const IconPeople = (p: P) => (
  <Ink {...p}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 19.5c.6-3.3 2.8-5.2 5.5-5.2s4.9 1.9 5.5 5.2" />
    <circle cx="16.6" cy="9.4" r="2.5" />
    <path d="M15.6 14.4c2.5-.4 4.6 1.4 5.1 4.6" />
  </Ink>
);

/** 관리자 — 글 (말풍선) */
export const IconNote = (p: P) => (
  <Ink {...p}>
    <path d="M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H11l-4.5 3.5V17h-2A1.5 1.5 0 0 1 3 15.5V7a1.5 1.5 0 0 1 1.5-1.5Z" />
    <path d="M7.5 9.8h9M7.5 13.2h6" />
  </Ink>
);

/** 관리자 — 운영·공지 (확성기) */
export const IconMegaphone = (p: P) => (
  <Ink {...p}>
    <path d="M4 10v4.5h3.2L15 19V5.5L7.2 10Z" />
    <path d="M18 9.2c1.2.8 1.2 4.8 0 5.6" />
    <path d="M7.6 14.6 9 19.5" />
  </Ink>
);

/** 발도장 — 발바닥 */
export const IconPaw = (p: P) => (
  <Ink {...p}>
    <ellipse cx="12" cy="15.6" rx="4.6" ry="3.9" />
    <ellipse cx="6.2" cy="10.4" rx="1.7" ry="2.2" />
    <ellipse cx="9.6" cy="6.6" rx="1.7" ry="2.3" />
    <ellipse cx="14.4" cy="6.6" rx="1.7" ry="2.3" />
    <ellipse cx="17.8" cy="10.4" rx="1.7" ry="2.2" />
  </Ink>
);

/** 통하는 책 — 이어진 두 고리 (통로) */
export const IconPortal = (p: P) => (
  <Ink {...p}>
    <circle cx="8.6" cy="12" r="5" />
    <circle cx="15.4" cy="12" r="5" />
  </Ink>
);

/** 뒤로 */
export const IconBack = (p: P) => (
  <Ink {...p}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </Ink>
);

/** 관리자 — 비용 (동전) */
export const IconCoin = (p: P) => (
  <Ink {...p}>
    <ellipse cx="12" cy="7" rx="7.5" ry="3" />
    <path d="M4.5 7v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V7" />
    <path d="M4.5 12v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-5" />
  </Ink>
);
