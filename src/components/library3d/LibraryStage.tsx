"use client";

// 나의 도서관 무대 — three.js 장면(world.ts)을 감싸는 화면 부품. 이름표·말풍선은 HTML (손글씨 글꼴, 산사처럼 머리 위 이름표).
// 페이지는 onReady 로 받은 api 로 꺼내기·꽂기를 부른다 (next/dynamic 을 지나도 끊기지 않게 ref 대신).
// three.js 가 무거워 페이지는 이 파일을 next/dynamic(ssr:false) 으로 따로 불러온다.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { AvatarConfig } from "@/lib/avatar/config";
import { formatClock } from "@/lib/books/reading";
import { speak } from "@/lib/client/voice";
import type { LibraryBook } from "@/lib/books/types";
import type { HouseId } from "@/lib/house/houses";
import type { ItemPos } from "@/lib/deco/items";
import s from "./stage.module.css";
import { LibraryWorld, type DecoView, type StageFocus, type StageMode } from "./world";

export type StageApi = {
  fetch(id: string): Promise<void>;
  seat(id: string): void;
  putBack(id: string, finished?: boolean, updated?: LibraryBook): Promise<void>;
  present(id: string): Promise<void>;
  stow(): Promise<void>;
  greet(line?: string): Promise<void>;
  openGift(itemId: string, deco: DecoView, left: number): Promise<void>;
  guestCheer(line?: string): void;
  setShelfView(on: boolean): void; // 크게 보기 ↔ 방 보기 (immersive 면 페이지의 퀵메뉴가 부른다)
};

const NO_DECO: DecoView = { worn: [], placed: [] };

export type StageProps = {
  books: LibraryBook[];
  avatar: AvatarConfig;
  name: string;
  me?: boolean;
  mode: StageMode;
  marks?: Set<string>; // 반짝이를 붙일 책 (친구와 같은 책)
  reading?: boolean; // 읽는 동안 전체 화면
  focus?: StageFocus; // 미리보기 카메라 (얼굴 꾸미기 땐 그 부위로 다가감 · 동물 고를 땐 동물까지)
  stand?: boolean; // 미리보기에서 서 있기 (꾸미기 창)
  editing?: boolean; // 순서 바꾸기 — 책장이 크게 보이고 책을 끌어 옮긴다
  onReorder?: (ids: string[]) => void;
  onAvatar?: () => void; // 아바타를 눌렀다 (마이페이지 — 꾸미기 창 열기)
  arranging?: boolean; // 물건 자리 — 방이 넓게 보이고 방 물건을 끌어 옮긴다 (홈만)
  onArrange?: (id: string, pos: ItemPos) => void;
  guest?: { avatar: AvatarConfig; name: string; worn: string[] } | null; // 친구 도서관에 놀러 간 '나'
  deco?: DecoView; // 아바타 소품·방 물건
  gifts?: number; // 안 연 선물 (러그 위 상자)
  onGift?: () => void; // 선물 상자를 눌렀다
  title?: string;
  hint?: string;
  className?: string;
  onPick?: (book: LibraryBook) => void;
  onAdd?: () => void;
  onReady?: (api: StageApi) => void;
  onFail?: () => void; // 입체 화면을 못 열면 (2D 책장으로)
  immersive?: boolean; // 홈 — 무대가 화면 가득(테두리 없음), 버튼은 페이지가 hud 로
  insets?: { top: number; bottom: number; left?: number }; // 버튼이 덮는 가장자리 px (카메라가 피한다)
  hud?: ReactNode; // 무대 위에 올릴 버튼들 (읽는 동안엔 숨김)
  onView?: (shelf: boolean) => void; // 크게 보기(책장만)인지
  house?: HouseId; // 내가 살 집 (벽·바닥·창·구도)
  timerFrom?: number | null; // 읽는 동안 머리 위 타이머 (시작 시각 ms) — 11-13 사용자: "책을 펴서 같이 읽고 위에 타이머"
  readingSheet?: boolean; // '몇 쪽까지' 창이 열렸다 — 아바타가 책을 덮고 카메라가 위로
  inPlace?: boolean; // 제자리 읽기 (홈) — 읽어도 화면 그대로: 전체 화면·카메라 이동 없음, 버튼·이름판 그대로 (11-13 사용자)
};

/** 캔버스 이름 (화면 읽기 도구용) */
function labelOf(p: Pick<StageProps, "mode" | "name" | "title">): string {
  return p.mode === "preview" ? `${p.name} 아바타` : `${p.title ?? "도서관"} — 책을 누르면 아바타가 꺼내 와요`;
}

export default function LibraryStage(p: StageProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null); // 캔버스는 입체 화면을 만들 때마다 새로 (아래 start)
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const tag = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const giftTag = useRef<HTMLDivElement>(null);
  const timerTag = useRef<HTMLDivElement>(null);
  const guestTag = useRef<HTMLDivElement>(null);
  const guestBubble = useRef<HTMLDivElement>(null);
  const world = useRef<LibraryWorld | null>(null);
  const props = useRef(p);
  const [units, setUnits] = useState({ count: 1, current: 0 });
  const [shelf, setShelf] = useState(false); // 책장 크게 보기 중

  useLayoutEffect(() => {
    props.current = p;
  });

  useEffect(() => {
    const w = wrap.current;
    const hostEl = host.current;
    if (!w || !hostEl) return;
    let alive = true;
    let seen = true;
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;
    let sayTimer = 0;
    let guestTimer = 0;
    let retryTimer = 0;
    let tries = 0;
    let cv: HTMLCanvasElement | null = null;
    const font = getComputedStyle(document.documentElement).getPropertyValue("--font-hand").trim() || "sans-serif";

    /** 입체 화면과 그 캔버스를 걷어 낸다 (끊긴 연결은 다시 쓰지 않는다) */
    const teardown = () => {
      ro?.disconnect();
      io?.disconnect();
      ro = null;
      io = null;
      cv?.removeEventListener("webglcontextlost", onLost);
      world.current?.dispose();
      world.current = null;
      cv?.remove();
      cv = null;
      canvasEl.current = null;
    };
    /** 그리기 연결이 끊기면(폰 GPU 초기화·개발 중 코드 바꿔 끼우기) 새 캔버스로 다시 */
    const onLost = (e: Event) => {
      e.preventDefault();
      teardown();
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(start, 400);
    };

    const start = () => {
      if (!alive) return;
      if (++tries > 4) {
        props.current.onFail?.(); // 몇 번 해도 안 되면 2D 책장으로
        return;
      }
      cv = document.createElement("canvas");
      cv.className = `${s.canvas} ${props.current.editing || props.current.arranging ? s.canvasEditing : ""}`;
      cv.setAttribute("role", "img");
      cv.setAttribute("aria-label", labelOf(props.current));
      hostEl.appendChild(cv);
      canvasEl.current = cv;
      let lw: LibraryWorld;
      try {
        lw = new LibraryWorld(
          cv,
          props.current.mode,
          {
            pick: (id) => {
              const b = props.current.books.find((x) => x.id === id);
              if (b) props.current.onPick?.(b);
            },
            add: () => props.current.onAdd?.(),
            gift: () => props.current.onGift?.(),
            frame: ({ x, y, visible }, gift, guest) => {
              if (guestTag.current) {
                guestTag.current.style.opacity = guest?.visible ? "1" : "0";
                if (guest) guestTag.current.style.transform = `translate(${guest.x}px, ${guest.y}px) translate(-50%, -100%)`;
              }
              if (guestBubble.current && guest) guestBubble.current.style.transform = `translate(${guest.x}px, ${guest.y - 30}px) translate(-50%, -100%)`;
              if (giftTag.current) {
                giftTag.current.style.opacity = gift ? "1" : "0";
                if (gift) giftTag.current.style.transform = `translate(${gift.x}px, ${gift.y}px) translate(-50%, -100%)`;
              }
              const timing = props.current.timerFrom != null;
              if (tag.current) {
                tag.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
                tag.current.style.opacity = visible && !timing ? "1" : "0"; // 읽는 동안엔 이름표 대신 타이머
              }
              if (timerTag.current) {
                timerTag.current.style.transform = `translate(${x}px, ${y - 2}px) translate(-50%, -100%)`;
                timerTag.current.style.opacity = visible && timing ? "1" : "0";
              }
              if (bubble.current) bubble.current.style.transform = `translate(${x}px, ${y - 30}px) translate(-50%, -100%)`;
            },
            say: (text) => {
              speak(text, props.current.avatar.gender); // 캐릭터 목소리 (구운 말만)
              const bb = bubble.current;
              if (!bb) return;
              bb.textContent = text;
              bb.dataset.on = "1";
              window.clearTimeout(sayTimer);
              sayTimer = window.setTimeout(() => {
                if (bubble.current) bubble.current.dataset.on = "0";
              }, 1900);
            },
            sayGuest: (text) => {
              if (props.current.guest) speak(text, props.current.guest.avatar.gender);
              const bb = guestBubble.current;
              if (!bb) return;
              bb.textContent = text;
              bb.dataset.on = "1";
              window.clearTimeout(guestTimer);
              guestTimer = window.setTimeout(() => {
                if (guestBubble.current) guestBubble.current.dataset.on = "0";
              }, 1900);
            },
            units: (count, current) => setUnits({ count, current }),
            view: (on) => {
              setShelf(on);
              props.current.onView?.(on);
            },
            reorder: (ids) => props.current.onReorder?.(ids),
            avatarTap: () => props.current.onAvatar?.(),
            arrange: (id, pos) => props.current.onArrange?.(id, pos),
          },
          font,
        );
      } catch {
        teardown();
        window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(start, 300);
        return;
      }
      cv.addEventListener("webglcontextlost", onLost);
      world.current = lw;
      // 개발 중 시험 스크립트가 책 자리를 묻는다 (scripts/shot-3d.mjs)
      if (process.env.NODE_ENV !== "production") (window as unknown as { __library3d?: LibraryWorld }).__library3d = lw;
      lw.setDeco(props.current.deco ?? NO_DECO);
      lw.setAvatar(props.current.avatar);
      lw.setBooks(props.current.books, props.current.marks);
      lw.setReadingView(props.current.inPlace ? Boolean(props.current.readingSheet) : Boolean(props.current.reading));
      lw.setFocus(props.current.focus ?? "body");
      lw.setStanding(Boolean(props.current.stand));
      lw.setEditing(Boolean(props.current.editing));
      lw.setGifts(props.current.gifts ?? 0);
      if (props.current.house) lw.setHouse(props.current.house);
      lw.setArranging(Boolean(props.current.arranging));
      const ins = props.current.insets;
      if (ins) lw.setInsets(ins.top, ins.bottom, ins.left ?? 0);
      const gu = props.current.guest;
      if (gu) lw.setGuest(gu.avatar, gu.worn);
      const r = w.getBoundingClientRect();
      lw.resize(r.width, r.height);
      ro = new ResizeObserver(([e]) => lw.resize(e.contentRect.width, e.contentRect.height));
      ro.observe(w);
      io = new IntersectionObserver(([e]) => {
        seen = e.isIntersecting;
        lw.setActive(seen && !document.hidden);
      });
      io.observe(w);
      lw.setActive(!document.hidden);
      props.current.onReady?.({
        fetch: (id) => lw.fetch(id),
        seat: (id) => lw.seat(id),
        putBack: (id, finished, updated) => lw.putBack(id, finished, updated),
        present: (id) => lw.present(id),
        stow: () => lw.stow(),
        greet: (line) => lw.greet(line),
        openGift: (itemId, deco, left) => lw.openGift(itemId, deco, left),
        guestCheer: (line) => lw.guestCheer(line),
        setShelfView: (on) => lw.setShelfView(on),
      });
    };
    // 손글씨 글꼴이 준비된 뒤 (책등 그림이 없는 책에 제목을 쓴다) — 늦으면 그냥 시작
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]).then(start);
    const onVis = () => world.current?.setActive(seen && !document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      ro?.disconnect();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.clearTimeout(sayTimer);
      window.clearTimeout(guestTimer);
      window.clearTimeout(retryTimer);
      teardown();
    };
  }, []);

  useEffect(() => {
    canvasEl.current?.classList.toggle(s.canvasEditing, Boolean(p.editing || p.arranging));
  }, [p.editing, p.arranging]);

  const label = labelOf(p);
  useEffect(() => {
    canvasEl.current?.setAttribute("aria-label", label);
  }, [label]);

  useEffect(() => {
    world.current?.setBooks(p.books, p.marks);
  }, [p.books, p.marks]);

  useEffect(() => {
    world.current?.setAvatar(p.avatar);
  }, [p.avatar]);

  useEffect(() => {
    if (p.inPlace) world.current?.setReadingView(Boolean(p.readingSheet), true); // 몇 쪽까지 창이 열릴 때만 부드럽게
    else world.current?.setReadingView(Boolean(p.reading));
  }, [p.reading, p.readingSheet, p.inPlace]);

  useEffect(() => {
    world.current?.setDeco(p.deco ?? NO_DECO);
  }, [p.deco]);

  useEffect(() => {
    world.current?.setFocus(p.focus ?? "body");
  }, [p.focus]);

  useEffect(() => {
    world.current?.setStanding(Boolean(p.stand));
  }, [p.stand]);

  useEffect(() => {
    world.current?.setEditing(Boolean(p.editing));
  }, [p.editing]);

  useEffect(() => {
    world.current?.setArranging(Boolean(p.arranging));
  }, [p.arranging]);

  useEffect(() => {
    world.current?.setGifts(p.gifts ?? 0);
  }, [p.gifts]);

  useEffect(() => {
    if (p.house) world.current?.setHouse(p.house);
  }, [p.house]);

  useEffect(() => {
    world.current?.setReadingSheet(Boolean(p.readingSheet));
  }, [p.readingSheet]);

  // 머리 위 타이머 — 1초마다
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (p.timerFrom == null) return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [p.timerFrom]);

  const [it, ib, il] = [p.insets?.top ?? 0, p.insets?.bottom ?? 0, p.insets?.left ?? 0];
  useEffect(() => {
    world.current?.setInsets(it, ib, il);
  }, [it, ib, il]);

  // 바깥 slot 이 자리를 잡고, 읽는 동안 안쪽 stage 만 전체 화면으로 (아래 내용이 튀어 오르지 않게)
  return (
    <div className={`${s.slot} ${p.mode === "preview" ? s.previewSlot : ""} ${p.immersive ? s.immersiveSlot : ""} ${p.className ?? ""}`}>
      <div ref={wrap} className={`${s.stage} ${p.immersive ? s.immersiveStage : ""} ${p.reading && !p.inPlace ? s.full : ""}`}>
        <div ref={host} className={s.canvasHost} />
      {p.title && (!p.reading || p.inPlace) && <span className={s.plaque}>{p.title}</span>}
      <div ref={tag} className={s.tag} aria-hidden>
        {p.me && <b className={s.me}>나</b>}
        {!(p.me && p.name === "나") && p.name}
      </div>
      <div ref={bubble} className={s.bubble} data-on="0" role="status" />
      {p.timerFrom != null && (
        <div ref={timerTag} className={s.timerTag} aria-label="읽은 시간">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.6 1.8M9.5 3h5" />
          </svg>
          {formatClock(Math.max(0, (now || p.timerFrom) - p.timerFrom))}
        </div>
      )}
        {p.guest && (
          <>
            <div ref={guestTag} className={s.tag} aria-hidden>
              <b className={s.me}>나</b>
              {p.guest.name !== "나" && p.guest.name}
            </div>
            <div ref={guestBubble} className={s.bubble} data-on="0" role="status" />
          </>
        )}
        {p.mode === "home" && (!p.reading || p.inPlace) && (
          <div ref={giftTag} className={s.giftTag} aria-hidden>
            상자 {p.gifts ?? 0}
          </div>
        )}
      {units.count > 1 && !p.reading && (
        <div className={`${s.dots} ${p.immersive ? s.dotsHigh : ""}`} style={p.immersive ? { bottom: ib + 6 } : undefined} aria-label={`책장 ${units.current + 1} / ${units.count} — 옆으로 밀어 넘겨요`}>
          {Array.from({ length: units.count }, (_, i) => (
            <i key={i} className={`${s.dot} ${i === units.current ? s.dotOn : ""}`} />
          ))}
        </div>
      )}
        {p.hint && !p.reading && units.count <= 1 && <p className={s.hint}>{p.hint}</p>}
        {p.hud && (!p.reading || p.inPlace) && p.hud}
        {p.mode !== "preview" && !p.immersive && !p.reading && !p.editing && (
          <button type="button" className={s.zoomBtn} onClick={() => world.current?.setShelfView(!shelf)} aria-pressed={shelf}>
            {shelf ? "방 보기" : "크게 보기"}
          </button>
        )}
      </div>
    </div>
  );
}
