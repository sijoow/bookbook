"use client";

// 나의 도서관 (홈) — 11-12 사용자: "높이를 쌓아 캐릭터를 받는 게 아니라, 나만의 책장에서 책을 꺼내 읽고
// 오늘 얼마까지 읽었는지 남기고 다시 꽂는다. 사람마다 한 권 읽는 데 걸리는 시간을 계산한다."
// + 11-12 "유니티 정도로 간단하게 게임 애니메이션 느낌 — 애기가 앉아 있다가 나만의 아바타가 직접 꺼낸다"
//   "염주 돌리는 앱(산사)처럼 — 나만의 도서관"
// 입체 도서관: 책을 누르면 → 아바타가 걸어가 꺼내 와 방석에서 읽는다(타이머) → 덮을 때 '몇 쪽까지' → 다시 꽂고 앉는다
// 입체 화면을 못 여는 기기(WebGL2 없음)는 2D 책장 + 날아가는 책 연출 그대로.
// 11-13 사용자: "이 화면이 주가 돼야 — 나의 아바타" + "이런 것들(제목·숫자·+)은 아래쪽 퀵메뉴에, 사이드 누르면 옆에서 나오게"
//   → 입체 홈은 무대가 화면 가득(탭 막대 위까지). 아래 퀵메뉴(책 꽂기·크게 보기·정리·꾸미기·공유),
//     왼쪽 색인 탭 '나의 도서관' → 옆 서랍(숫자·읽는 중·놀러 온 친구·바로 가기). 화면은 내려가지 않는다.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TopBar } from "@/components/Bars";
import { CoverSticker, Progress } from "@/components/Bits";
import { Bookshelf } from "@/components/Bookshelf";
import { Sparkle, StarDoodle, Tape, Yes24Credit } from "@/components/Deco";
import { EditBar, HudCredit, HudHint, HudNotice, HudPoints, QuickMenu, ReadHandle, SideDrawer, SideTab, Stat, hud } from "@/components/HomeHud";
import { MissionPanel } from "@/components/Missions";
import { ShareLibrary, useShareLibrary } from "@/components/ShareLibrary";
import { StampIcon } from "@/components/Stamp";
import type { StageApi } from "@/components/library3d/LibraryStage";
import stage from "@/components/library3d/stage.module.css";
import { ReadingOverlay, ReadingPanel, reducedMotion, type FinishInput, type Flow } from "@/components/ReadingOverlay";
import ui from "@/components/ui.module.css";
import { defaultAvatar, type AvatarConfig } from "@/lib/avatar/config";
import { api } from "@/lib/client/api";
import type { MissionId, MissionsView } from "@/lib/missions/missions";
import { makeSaver } from "@/lib/client/saver";
import { hasVoices, setSound, soundOn } from "@/lib/client/voice";
import { musicOn, setMusic } from "@/lib/client/bgm";
import { hasWebGL } from "@/lib/client/webgl";
import { formatMinutes, lastWeek, minutesLeft, minutesPerBook, readingSpeed } from "@/lib/books/reading";
import { SORTS, SORT_LABEL, sortBooks } from "@/lib/books/sort";
import { EMPTY_DECO, POINT_NAME, ROOM_SURFACES, type Deco, type DecoItem, type ItemPos } from "@/lib/deco/items";
import { DEFAULT_HOUSE, type HouseId } from "@/lib/house/houses";
import { shortAuthor, type LibraryBook, type ReadingSession } from "@/lib/books/types";
import s from "./screens.module.css";

// three.js 는 무거워서 따로 (서버에서 미리 그리지 않는다)
const LibraryStage = dynamic(() => import("@/components/library3d/LibraryStage"), {
  ssr: false,
  loading: () => <div className={stage.slot} />,
});
// 홈(화면 가득)용 — 불러오는 동안 자리도 화면 가득
const ImmersiveStage = dynamic(() => import("@/components/library3d/LibraryStage"), {
  ssr: false,
  loading: () => <div className={`${stage.slot} ${stage.immersiveSlot}`} />,
});
// 무대 가장자리에서 버튼이 덮는 자리(px) — 카메라가 방을 그 안쪽에 맞춘다 (위: 이름판, 아래: 퀵메뉴)
const HUD_INSETS = { top: 50, bottom: 96, left: 0 };
const TIDY_INSETS = { top: 50, bottom: 140, left: 0 }; // 정리 막대에 탭('책 순서'/'물건 자리')이 붙으면 조금 높다

// 읽는 중인 책과 시작 시각 — 앱을 나갔다 와도 이어서 (이 기기에서만)
const KEY = "bookbook.reading";
function loadReading(): { bookId: string; startedAt: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v && typeof v.bookId === "string" && typeof v.startedAt === "number" ? v : null;
  } catch {
    return null;
  }
}
function saveReading(v: { bookId: string; startedAt: number }) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // 저장이 막힌 브라우저면 이어 읽기만 안 될 뿐
  }
}
function clearReading() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 위와 같음
  }
}


const CLOSE_LINES = ["오늘은 여기까지?", "잘 읽었다!", "몇 쪽까지 읽었어?"];
const LIFT = [{ transform: "translateY(0) rotate(0deg)" }, { transform: "translateY(-26px) rotate(-2deg)" }];

type Me = { handle: string; nickname: string; avatar: AvatarConfig; deco: Deco; readCount: number; pending: number; points: number; house: HouseId; onboarded?: boolean };
type Guest = { handle: string; nickname: string; at: string; stamp: { kind: string; note: string | null; at: string } | null };

/** "방금" · "3시간 전" · "2일 전" (기준 시각 now 를 받는다 — 렌더 중 Date.now() 를 부르지 않게) */
function ago(iso: string, now: number): string {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (m < 2) return "방금";
  if (m < 60) return `${m}분 전`;
  if (m < 60 * 24) return `${Math.round(m / 60)}시간 전`;
  return `${Math.round(m / 1440)}일 전`;
}

export default function MyLibrary() {
  const router = useRouter();
  const [books, setBooks] = useState<LibraryBook[] | null>(null);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [flow, setFlowState] = useState<Flow | null>(null);
  const [busy, setBusy] = useState(false);
  const [flowErr, setFlowErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastSticker, setToastSticker] = useState<string | null>(null);
  const [editing, setEditing] = useState(false); // 책장 순서 바꾸기
  const [arranging, setArranging] = useState(false); // 방 물건 자리 옮기기 (11-13)
  const [drawer, setDrawer] = useState(false); // 옆 서랍 (나의 도서관)
  const [missions, setMissions] = useState<MissionsView | null>(null); // 오늘의 미션 (서랍 맨 위, 받을 게 있으면 색인 탭에 점)
  const [shelf, setShelf] = useState(false); // 크게 보기 중
  const [closingSheet, setClosingSheet] = useState(false);
  const [readBarOpen, setReadBarOpen] = useState(false);
  const [music, setMusicState] = useState(true); // 배경 음악 (이 기기에만 기억 — 불러온 뒤 읽는다)
  const [sound, setSoundState] = useState(true); // 캐릭터 목소리 (이 기기에만 기억 — 불러온 뒤 읽는다) // 읽는 동안 ^ 를 눌러 꺼낸 읽기 줄 (11-13 사용자: "퀵메뉴가 아래로 떨어지고 ^ 버튼이 생긴다 정도로만")
  const [notice, setNotice] = useState<{ id: string; text: string; level: "info" | "event" | "warn" } | null>(null); // 관리자 공지 (닫으면 이 기기에선 안 보임) // 읽다가 '책 덮기' → '몇 쪽까지' 창 (11-13: 읽는 동안엔 작은 줄 + 머리 위 타이머)
  // 입체 도서관 (못 열면 2D 책장). 서버와 첫 화면은 둘 다 '입체'로 같게 그리고(하이드레이션이 어긋나지 않게), 불러온 뒤 실제로 잰다
  const [gl, setGl] = useState(true);
  // '이번 주'를 셀 기준 시각 — 렌더 중에 new Date() 를 부르면 cacheComponents 미리 그리기에서 오류라, 불러온 뒤 콜백에서 정한다
  const [asOf, setAsOf] = useState<number | null>(null);

  const flowRef = useRef<Flow | null>(null);
  const stageApi = useRef<StageApi | null>(null);
  const spines = useRef(new Map<string, HTMLElement>());
  const lifts = useRef(new Map<string, Animation>());
  const booksRef = useRef<LibraryBook[]>([]);
  const pendingRead = useRef<string | null>(null);
  const opening = useRef(false);
  const [saveOrder] = useState(() => makeSaver((ids: string[]) => api("/api/library/order", { method: "PUT", json: { ids } }), (e) => setErr(e.message)));
  // 옮긴 물건 자리 — 늘 전체 값을 보낸다 (빠르게 여러 번 옮겨도 마지막 값이 이기게)
  const [savePos] = useState(() => makeSaver((pos: Record<string, ItemPos>) => api("/api/me", { method: "PATCH", json: { deco: { pos } } }), (e) => setErr(e.message)));
  const posRef = useRef<Record<string, ItemPos>>({});

  const setFlow = useCallback((f: Flow | null) => {
    flowRef.current = f;
    setFlowState(f);
  }, []);

  /** 입체: 아바타가 꺼내 와 방석에 앉으면 읽기 시작 */
  const read3d = useCallback(
    async (book: LibraryBook) => {
      const stg = stageApi.current;
      if (flowRef.current || !stg) return;
      const startedAt = Date.now();
      setFlow({ book, phase: "out", startedAt, from: null });
      saveReading({ bookId: book.id, startedAt });
      window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
      await stg.fetch(book.id);
      const f = flowRef.current as Flow | null; // 기다리는 동안 바뀌었을 수 있다
      if (!f || f.book.id !== book.id) return;
      document.body.style.overflow = "hidden";
      setClosingSheet(false);
      setReadBarOpen(false);
      setFlow({ ...f, phase: "reading" });
    },
    [setFlow],
  );

  /** 2D: 책장에서 꺼내기 — 책등이 위로 쏙 → 화면 가운데로 */
  const takeOut = useCallback(
    async (book: LibraryBook) => {
      if (flowRef.current) return;
      const el = spines.current.get(book.id) ?? null;
      flowRef.current = { book, phase: "out", startedAt: Date.now(), from: null }; // 두 번 누름 막기
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.top < 60 || r.bottom > window.innerHeight - 90) el.scrollIntoView({ block: "center" });
        if (!reducedMotion()) {
          const a = el.animate(LIFT, { duration: 240, easing: "cubic-bezier(.3,.7,.4,1)", fill: "forwards" });
          lifts.current.set(book.id, a);
          await a.finished.catch(() => {});
        }
      }
      const startedAt = Date.now();
      saveReading({ bookId: book.id, startedAt });
      document.body.style.overflow = "hidden";
      setFlow({ book, phase: "out", startedAt, from: el?.getBoundingClientRect() ?? null });
    },
    [setFlow],
  );

  const startRead = useCallback((book: LibraryBook) => (gl ? read3d(book) : takeOut(book)), [gl, read3d, takeOut]);

  /** 2D 책장이 책등을 그릴 때마다 — 상세에서 '꺼내 읽기'로 왔으면 그 책이 그려지는 순간 꺼낸다 */
  const register = useCallback(
    (id: string, el: HTMLElement | null) => {
      if (!el) {
        spines.current.delete(id);
        return;
      }
      spines.current.set(id, el);
      if (!gl && pendingRead.current === id) {
        pendingRead.current = null;
        setTimeout(() => {
          const b = booksRef.current.find((x) => x.id === id);
          if (b) takeOut(b);
        }, 300);
      }
    },
    [gl, takeOut],
  );

  /** 입체 무대가 준비되면 — 이어 읽기면 방석에 앉혀 두고, 상세에서 '꺼내 읽기'로 왔으면 꺼내러 간다 */
  const onStageReady = useCallback(
    (stg: StageApi) => {
      stageApi.current = stg;
      const f = flowRef.current;
      if (f?.phase === "reading") stg.seat(f.book.id);
      const want = pendingRead.current;
      if (want && !f) {
        pendingRead.current = null;
        const b = booksRef.current.find((x) => x.id === want);
        if (b) setTimeout(() => read3d(b), 450);
      }
    },
    [read3d],
  );

  useEffect(() => {
    let alive = true;
    pendingRead.current = new URLSearchParams(window.location.search).get("read");
    Promise.all([
      api<{ books: LibraryBook[] }>("/api/library"),
      api<{ sessions: ReadingSession[] }>("/api/sessions"),
      api<Me>("/api/me").catch(() => null),
    ])
      .then(([lib, ses, who]) => {
        if (!alive) return;
        setGl(hasWebGL());
        setSoundState(soundOn());
        setMusicState(musicOn());
        // 처음 가입을 안 마쳤으면 (닉네임·약관·아바타) 가입 화면으로
        if (who && who.onboarded === false) {
          router.replace("/welcome");
          return;
        }
        booksRef.current = lib.books;
        setBooks(lib.books);
        api<{ guests: Guest[] }>("/api/visits")
          .then((g) => alive && setGuests(g.guests))
          .catch(() => {});
        api<MissionsView>("/api/missions")
          .then((x) => alive && setMissions(x))
          .catch(() => {});
        api<{ notice: { id: string; text: string; level: "info" | "event" | "warn" } | null }>("/api/notice")
          .then((n) => {
            let closed: string | null = null;
            try {
              closed = localStorage.getItem("bookbook.noticeClosed");
            } catch {
              // 저장이 막혀도 공지는 보인다
            }
            if (alive && n.notice && n.notice.id !== closed) setNotice(n.notice);
          })
          .catch(() => {});
        setSessions(ses.sessions);
        setMe(who ?? { handle: "me", nickname: "나", avatar: defaultAvatar("me"), deco: EMPTY_DECO, readCount: 0, pending: 0, points: 0, house: DEFAULT_HOUSE });
        posRef.current = { ...(who?.deco.pos ?? {}) };
        setAsOf(Date.now());
        // 꾸미기에서 '방에서 자리 옮기기'로 왔으면 (?arrange=1) 바로 물건 자리
        if (new URLSearchParams(window.location.search).get("arrange")) {
          if (hasWebGL() && who?.deco.placed.some((id) => ROOM_SURFACES[id]) && !loadReading()) setArranging(true);
          router.replace("/");
        }
        // 처음 가입을 마치고 왔으면 (?welcome=100) 가입 축하 포인트 알림
        const w = Number(new URLSearchParams(window.location.search).get("welcome"));
        if (w > 0) {
          setToast(`가입 축하 +${w} ${POINT_NAME} — 상점에서 첫 물건을 골라 보세요`);
          setTimeout(() => setToast(null), 4200);
          router.replace("/");
        }
        // 읽다가 나갔던 책이 있으면 바로 이어서 (연출 없이)
        const r = loadReading();
        const b = r && lib.books.find((x) => x.id === r.bookId);
        if (r && b) {
          pendingRead.current = null;
          document.body.style.overflow = "hidden";
          setFlow({ book: b, phase: "reading", startedAt: r.startedAt, from: null });
          stageApi.current?.seat(b.id);
        } else if (r) clearReading();
      })
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
      document.body.style.overflow = "";
    };
  }, [setFlow, router]);

  /** 2D: 날아서 제자리로 */
  function putBack2d(updated?: LibraryBook) {
    const f = flowRef.current;
    if (!f) return;
    const el = spines.current.get(f.book.id);
    setFlow({ ...f, book: updated ?? f.book, phase: "back", from: el?.getBoundingClientRect() ?? null });
  }

  /** 입체: 읽기 화면을 닫고 아바타가 제자리에 꽂는다 (다 읽었으면 만세부터) */
  async function back3d(updated?: LibraryBook, done = false) {
    const f = flowRef.current;
    if (!f) return;
    const book = updated ?? f.book;
    setFlow({ ...f, book, phase: "back" });
    document.body.style.overflow = "";
    clearReading();
    if (updated) {
      const next = (booksRef.current = booksRef.current.map((b) => (b.id === book.id ? book : b)));
      setBooks(next);
    }
    await stageApi.current?.putBack(f.book.id, done, book);
    if (done) setMe((m) => (m ? { ...m, readCount: m.readCount + 1 } : m));
    setFlow(null);
    setClosingSheet(false);
    setReadBarOpen(false);
    setTimeout(() => setToast(null), 3200);
  }

  async function finish(input: FinishInput) {
    const f = flowRef.current;
    if (!f) return;
    setBusy(true);
    setFlowErr(null);
    try {
      const r = await api<{ book: LibraryBook; session: ReadingSession; points?: { read: number; finish: number; balance: number } }>(`/api/library/${f.book.id}/sessions`, {
        json: {
          startedAt: new Date(f.startedAt).toISOString(),
          endedAt: new Date().toISOString(),
          minutes: input.minutes,
          toPage: input.toPage,
          finished: input.finished,
        },
      });
      setSessions((xs) => [r.session, ...xs]);
      setAsOf(Date.now());
      const done = f.book.status !== "read" && r.book.status === "read";
      const got = (r.points?.read ?? 0) + (r.points?.finish ?? 0);
      if (r.points) setMe((m) => (m ? { ...m, points: r.points!.balance } : m));
      api<MissionsView>("/api/missions") // 읽은 쪽이 미션을 채웠을 수도
        .then(setMissions)
        .catch(() => {});
      const plus = got > 0 ? ` · +${got} ${POINT_NAME}` : "";
      setToast(done ? `『${r.book.title}』 다 읽었어요! 책등에 별을 붙였어요${plus}` : `${formatMinutes(r.session.minutes)} 읽고 ${r.book.currentPage ?? 0}쪽까지 · 책장에 꽂았어요${plus}`);
      if (gl) void back3d(r.book, done);
      else putBack2d(r.book);
    } catch (e) {
      setFlowErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** 선물 상자 열기 — 아바타가 열고, 나온 물건은 바로 놓인다 */
  async function openGift() {
    if (opening.current || flowRef.current || !me || me.pending <= 0) return;
    opening.current = true;
    try {
      const r = await api<{ item: DecoItem; deco: Deco; pending: number }>("/api/me/gift", { method: "POST" });
      if (stageApi.current) await stageApi.current.openGift(r.item.id, r.deco, r.pending);
      setMe((m) => (m ? { ...m, deco: r.deco, pending: r.pending } : m));
      setToast(`선물: ${r.item.label} — 꾸미기에서 켜고 끌 수 있어요`);
      setToastSticker(r.item.id);
      setTimeout(() => {
        setToast(null);
        setToastSticker(null);
      }, 2800);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      opening.current = false;
    }
  }

  /** 책장 순서 바꾸기 — 화면 먼저 바꾸고, 저장은 줄 세워서 (빠르게 여러 번 옮기거나 정렬해도 마지막 순서가 남는다) */
  function reorder(ids: string[]) {
    const byId = new Map(booksRef.current.map((b) => [b.id, b]));
    const next = ids.map((id) => byId.get(id)).filter((b): b is LibraryBook => Boolean(b));
    booksRef.current = next;
    setBooks(next);
    saveOrder(ids);
  }

  /** 방 물건을 옮겨 놓았다 — 화면 값 먼저 고치고, 전체 자리를 줄 세워 저장 */
  function arranged(id: string, p: ItemPos) {
    const pos = (posRef.current = { ...posRef.current, [id]: p });
    setMe((m) => (m ? { ...m, deco: { ...m.deco, pos } } : m));
    savePos(pos);
  }

  /** 물건 자리 '처음 자리로' — 옮긴 자리를 모두 지운다 */
  function resetPos() {
    posRef.current = {};
    setMe((m) => (m ? { ...m, deco: { ...m.deco, pos: {} } } : m));
    savePos({});
  }

  /** 2D: 제자리로 날아간 뒤 — 책장을 고치고, 책등이 쏙 내려앉는다 */
  function backDone() {
    const f = flowRef.current;
    if (!f) return;
    const next = (booksRef.current = booksRef.current.map((b) => (b.id === f.book.id ? f.book : b)));
    setBooks(next);
    setFlow(null);
    clearReading();
    document.body.style.overflow = "";
    const el = spines.current.get(f.book.id);
    lifts.current.get(f.book.id)?.cancel();
    lifts.current.delete(f.book.id);
    if (el && !reducedMotion()) el.animate([...LIFT].reverse(), { duration: 320, easing: "cubic-bezier(.5,0,.3,1.4)" });
    setTimeout(() => setToast(null), 3200);
  }

  const lite = sessions.map((x) => ({ bookId: x.bookId, minutes: x.minutes, pagesRead: x.pagesRead, endedAt: x.endedAt }));
  const speed = readingSpeed(lite);
  const week = asOf ? lastWeek(lite, new Date(asOf)).reduce((t, d) => t + d.minutes, 0) : 0;
  const all = books ?? [];
  const perBook = minutesPerBook(all);
  const reading = all.filter((b) => b.status === "reading");
  const show3d = gl && me != null;
  const myDeco = me?.deco;
  const decoView = useMemo(() => (myDeco ? { worn: myDeco.worn, placed: myDeco.placed, pos: myDeco.pos, paint: myDeco.paint } : undefined), [myDeco]);
  // 정리 — 책 순서(책 둘 이상) / 물건 자리(옮길 수 있는 방 물건이 있으면, 입체에서만)
  const tidy = editing || arranging;
  const canBooks = all.length > 1 && !flow;
  const canItems = gl && !flow && (myDeco?.placed ?? []).some((id) => ROOM_SURFACES[id]);
  const stageInsets = tidy && canBooks && canItems ? TIDY_INSETS : HUD_INSETS;
  const closeDrawer = useCallback(() => setDrawer(false), []);

  // 오늘의 미션 다시 세기 — 서랍을 열 때 (책을 덮은 뒤엔 finish 에서)
  useEffect(() => {
    if (!drawer) return;
    let alive = true;
    api<MissionsView>("/api/missions")
      .then((x) => alive && setMissions(x))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [drawer]);

  /** 미션 받기 — 받은 포인트(보너스 포함)를 돌려준다 */
  const claimMission = useCallback(async (id: MissionId | "week") => {
    try {
      const r = await api<{ gained: number; bonus: number; view: MissionsView; points: number }>("/api/missions", { json: { id } });
      setMissions(r.view);
      setMe((m) => (m ? { ...m, points: r.points } : m));
      if (r.bonus) setToast(`오늘의 미션을 모두 했어요! 보너스 +${r.bonus} ${POINT_NAME}`);
      return r.gained + r.bonus;
    } catch (e) {
      setToast((e as Error).message);
      return 0;
    }
  }, []);
  const say = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  }, []);
  const { share, busy: sharing } = useShareLibrary(me && me.nickname !== "나" ? me.nickname : "내", say);
  const showCredit = all.some((b) => b.coverUrl || b.sideCoverUrl);

  const toastEl = toast && (!flow || (gl && flow.phase === "back")) && (
    <div className={`${s.toast} ${gl ? s.toastHigh : ""}`} role="status">
      {/* eslint-disable-next-line @next/next/no-img-element -- 우리 스티커 그림 (작은 webp) */}
      {toastSticker ? <img src={`/img/stickers/${toastSticker}.webp`} alt="" width={30} height={30} style={{ objectFit: "contain", verticalAlign: "middle" }} /> : <Sparkle size={16} />} {toast}
    </div>
  );

  const readingBar = flow && gl && flow.phase === "reading" && (
    <div
      className={closingSheet ? stage.sheet : `${s.readBar} ${readBarOpen ? s.readBarOn : ""}`}
      role={closingSheet ? "dialog" : "region"}
      aria-modal={closingSheet ? true : undefined}
      aria-hidden={!closingSheet && !readBarOpen ? true : undefined}
      inert={!closingSheet && !readBarOpen ? true : undefined}
      aria-label={`${flow.book.title} 읽는 중`}
    >
      <ReadingPanel
        compact
        onMode={setClosingSheet}
        onCollapse={() => setReadBarOpen(false)}
        book={flow.book}
        startedAt={flow.startedAt}
        speed={speed}
        busy={busy}
        error={flowErr}
        onFinish={finish}
        onPutBack={() => void back3d()}
        onClosing={() => void stageApi.current?.greet(CLOSE_LINES[Math.floor(Math.random() * CLOSE_LINES.length)])}
      />
    </div>
  );

  // ── 입체 홈: 무대가 화면 가득 ──
  if (gl) {
    const readCount = all.filter((b) => b.status === "read").length;
    return (
      <>
        <div className={s.immersive} data-immersive>
          {books && me ? (
            <ImmersiveStage
              mode="home"
              immersive
              inPlace
              insets={stageInsets}
              books={all}
              avatar={me.avatar}
              name={me.nickname}
              me
              house={me.house}
              title={editing ? "책을 끌어서 옮겨요" : arranging ? "물건을 끌어서 옮겨요" : all.length ? "책을 누르면 꺼내 와요" : "나의 도서관"}
              editing={editing}
              onReorder={reorder}
              arranging={arranging}
              onArrange={arranged}
              onItemDoubleTap={() => {
                if (flow || !canItems) return;
                setEditing(false);
                setArranging(true); // 두 번 누른 물건을 바로 끌어 옮길 수 있게 (11-13 사용자: "더블클릭하면 위치 조절")
              }}
              reading={flow?.phase === "reading"}
              readingSheet={closingSheet}
              timerFrom={flow?.phase === "reading" && !closingSheet ? flow.startedAt : null}
              deco={decoView}
              gifts={me.pending}
              onGift={openGift}
              onPick={startRead}
              onAdd={() => router.push("/add")}
              onReady={onStageReady}
              onFail={() => setGl(false)}
              onView={setShelf}
              hud={
                <>
                  {!tidy && <SideTab open={drawer} onOpen={() => setDrawer(true)} badge={missions?.ready ?? 0} />}
                  {!tidy && <HudPoints points={me.points} />}
                  {!tidy && notice && (
                    <HudNotice
                      notice={notice}
                      onClose={() => {
                        try {
                          localStorage.setItem("bookbook.noticeClosed", notice.id);
                        } catch {
                          // 저장이 막히면 이번만 닫힌다
                        }
                        setNotice(null);
                      }}
                    />
                  )}
                  {showCredit && <HudCredit />}
                  {all.length === 0 && !tidy && <HudHint>&lsquo;책 꽂기&rsquo;로 첫 책을 꽂아 보세요</HudHint>}
                  {flow?.phase === "reading" && !closingSheet && !readBarOpen && <ReadHandle onOpen={() => setReadBarOpen(true)} />}
                  {tidy ? (
                    <EditBar
                      mode={arranging ? "items" : "books"}
                      canBooks={canBooks}
                      canItems={canItems}
                      moved={Object.keys(me.deco.pos ?? {}).length > 0}
                      onMode={(m) => {
                        setEditing(m === "books");
                        setArranging(m === "items");
                      }}
                      onSort={(k) => reorder(sortBooks(all, k))}
                      onReset={resetPos}
                      onDone={() => {
                        setEditing(false);
                        setArranging(false);
                      }}
                    />
                  ) : (
                    <QuickMenu
                      hidden={flow?.phase === "reading"}
                      shelf={shelf}
                      empty={all.length === 0}
                      canSort={canBooks || canItems}
                      pending={me.pending}
                      sharing={sharing}
                      onAdd={() => router.push("/add")}
                      onZoom={() => stageApi.current?.setShelfView(!shelf)}
                      onSort={() => (canBooks ? setEditing(true) : setArranging(true))}
                      onShare={() => void share()}
                    />
                  )}
                </>
              }
            />
          ) : (
            <div className={`${stage.slot} ${stage.immersiveSlot}`} />
          )}
          {err && <p className={`${ui.error} ${s.immersiveErr}`}>{err}</p>}
        </div>

        <SideDrawer open={drawer} onClose={closeDrawer} title="나의 도서관">
          <Link href="/decorate" className={hud.pointRow}>
            <span>
              내 {POINT_NAME} <b>{me ? me.points.toLocaleString() : 0}</b>
            </span>
            <span className={hud.small}>상점 가기 ›</span>
          </Link>
          {missions && <MissionPanel view={missions} onClaim={claimMission} onGo={closeDrawer} />}
          <div className={hud.stats}>
            <Stat value={`${all.length}권`} label="꽂은 책" />
            <Stat value={`${readCount}권`} label="다 읽은 책" />
            <Stat value={formatMinutes(week)} label="이번 주 읽은 시간" />
            <Stat value={perBook ? formatMinutes(perBook) : "아직"} label="한 권 다 읽는 데 평균" />
          </div>

          {reading.length > 0 && (
            <section className={hud.block}>
              <h3 className={hud.blockTitle}>읽는 중</h3>
              {reading.map((b) => {
                const left = minutesLeft(b, speed);
                return (
                  <div key={b.id} className={hud.row}>
                    <CoverSticker src={b.coverUrl} title={b.title} w={40} tilt={-3} />
                    <div className={hud.rowBody}>
                      <Link href={`/book/${b.id}`} className={hud.rowTitle}>
                        {b.title}
                      </Link>
                      {b.pages ? (
                        <>
                          <Progress value={((b.currentPage ?? 0) / b.pages) * 100} />
                          <span className={hud.small}>
                            {b.currentPage ?? 0} / {b.pages}쪽{left ? ` · 남은 ${speed.measured ? "" : "어림 "}${formatMinutes(left)}` : ""}
                          </span>
                        </>
                      ) : (
                        <span className={hud.small}>{shortAuthor(b.author)}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      className={hud.rowBtn}
                      disabled={Boolean(flow)}
                      onClick={() => {
                        setDrawer(false);
                        setTimeout(() => startRead(b), 320); // 서랍이 닫히고 아바타가 꺼내러 간다
                      }}
                    >
                      이어 읽기
                    </button>
                  </div>
                );
              })}
            </section>
          )}

          <section className={hud.block}>
            <h3 className={hud.blockTitle}>놀러 온 친구</h3>
            {guests.length === 0 ? (
              <p className={hud.small}>아직 놀러 온 친구가 없어요. 내 도서관을 공유하면 친구가 놀러 와서 발도장을 남겨요.</p>
            ) : (
              guests.slice(0, 6).map((g) => (
                <Link key={g.handle} href={`/u/${g.handle}`} className={hud.row}>
                  {g.stamp ? <StampIcon kind={g.stamp.kind} size={28} /> : <Sparkle size={22} color="var(--mint)" />}
                  <span className={hud.rowBody}>
                    <b className={hud.rowTitle}>
                      {g.nickname} <span className={hud.small}>· {asOf ? ago(g.at, asOf) : ""}</span>
                    </b>
                    <span className={hud.small}>{g.stamp?.note ? `“${g.stamp.note}”` : g.stamp ? "발도장을 남겼어요" : "놀러 왔다 갔어요"}</span>
                  </span>
                  <span className={hud.small}>놀러 가기 ›</span>
                </Link>
              ))
            )}
            <div style={{ marginTop: 12, textAlign: "center" }}>
              <ShareLibrary name={me && me.nickname !== "나" ? me.nickname : "내"} wide onDone={say} />
            </div>
          </section>

          <nav className={`${hud.block} ${hud.links}`} aria-label="바로 가기">
            <Link href="/library" className={hud.link}>
              목록으로 보기 <span aria-hidden>›</span>
            </Link>
            <Link href="/decorate" className={hud.link}>
              꾸미기 · 상점{me && me.pending > 0 ? ` · 배달 상자 ${me.pending}` : ""} <span aria-hidden>›</span>
            </Link>
            <Link href="/log" className={hud.link}>
              읽은 기록 <span aria-hidden>›</span>
            </Link>
            <button
              type="button"
              className={`${hud.link} ${hud.linkBtn}`}
              aria-pressed={music}
              onClick={() => {
                setMusic(!music);
                setMusicState(!music);
              }}
            >
              배경 음악 <span className={hud.small}>{music ? "켜짐" : "꺼짐"}</span>
            </button>
            {hasVoices() && (
              <button
                type="button"
                className={`${hud.link} ${hud.linkBtn}`}
                aria-pressed={sound}
                onClick={() => {
                  setSound(!sound);
                  setSoundState(!sound);
                }}
              >
                캐릭터 목소리 <span className={hud.small}>{sound ? "켜짐" : "꺼짐"}</span>
              </button>
            )}
          </nav>
          {showCredit && <Yes24Credit />}
        </SideDrawer>

        {toastEl}
        {readingBar}
      </>
    );
  }

  return (
    <>
      <TopBar
        right={
          <Link href="/add" className={ui.iconBtn} aria-label="책 추가">
            +
          </Link>
        }
      />

      <section className={s.hero} style={{ paddingBottom: 0 }}>
        <Sparkle size={20} style={{ position: "absolute", left: 22, top: 22 }} />
        <StarDoodle size={15} style={{ position: "absolute", right: 26, top: 30 }} color="var(--coral)" />
        <h1 className={s.heroTitle}>나의 도서관</h1>
        <p className={ui.muted} style={{ marginTop: 6 }}>
          책 {all.length}권 · 이번 주 {formatMinutes(week)}
        </p>
        <p className={ui.muted}>{perBook ? `한 권 다 읽는 데 평균 ${formatMinutes(perBook)}` : "책을 눌러 꺼내 읽으면 읽은 시간이 쌓여요"}</p>
      </section>

      {err && <p className={ui.error}>{err}</p>}

      {books && (
        <>
          {show3d && me && (
            <LibraryStage
              mode="home"
              books={all}
              avatar={me.avatar}
              name={me.nickname}
              me
              title={editing ? "책을 끌어서 옮겨요" : "책을 누르면 꺼내 와요"}
              editing={editing}
              onReorder={reorder}
              reading={flow?.phase === "reading"}
              deco={decoView}
              gifts={me.pending}
              onGift={openGift}
              onPick={startRead}
              onAdd={() => router.push("/add")}
              onReady={onStageReady}
              onFail={() => setGl(false)}
            />
          )}
          {!gl && (
            <Bookshelf
              title={editing ? "책을 끌어서 옮겨요" : "책을 눌러 꺼내 읽어요"}
              books={all}
              outId={flow?.book.id ?? null}
              onPick={takeOut}
              register={register}
              editing={editing}
              onReorder={reorder}
            />
          )}
          <div className={s.shelfTools}>
            {editing ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                {/* 정리하기 — 한 번에 정렬 (책이 미끄러져 자리를 바꾼다) */}
                <div className={ui.chips} style={{ justifyContent: "center" }}>
                  {SORTS.map((k) => (
                    <button key={k} type="button" className={ui.chip} onClick={() => reorder(sortBooks(all, k))}>
                      {SORT_LABEL[k]}
                    </button>
                  ))}
                </div>
                <button type="button" className={ui.btn} onClick={() => setEditing(false)}>
                  다 됐어요
                </button>
              </div>
            ) : (
              <>
                {all.length > 1 && (
                  <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={() => setEditing(true)} disabled={Boolean(flow)}>
                    책장 정리
                  </button>
                )}
                <Link href="/decorate" className={ui.textBtn}>
                  꾸미기{me && me.pending > 0 ? ` · 선물 ${me.pending}` : ""} ›
                </Link>
                <Link href="/library" className={ui.textBtn}>
                  목록 ›
                </Link>
              </>
            )}
          </div>
        </>
      )}

      {books && all.length === 0 && (
        <div className={s.empty}>
          <p className={s.handTitle}>아직 빈 책장이에요</p>
          <p className={ui.muted}>읽은 책, 읽는 책, 읽고 싶은 책을 꽂아 보세요.</p>
          <Link href="/add" className={ui.btn}>
            첫 책 꽂기 ▸
          </Link>
        </div>
      )}

      {reading.length > 0 && (
        <section className={s.section}>
          <div className={s.stack12}>
            {reading.map((b, i) => {
              const left = minutesLeft(b, speed);
              return (
                <div key={b.id} className={ui.paper}>
                  <Tape color={i % 2 ? "mint" : "apricot"} />
                  <span className={ui.paperLabel}>읽는 중</span>
                  <div className={s.nowRow}>
                    <CoverSticker src={b.coverUrl} title={b.title} w={58} tilt={-3} />
                    <div className={s.nowBody}>
                      <Link href={`/book/${b.id}`} className={s.bookTitle}>
                        {b.title}
                      </Link>
                      <span className={ui.muted}>{shortAuthor(b.author)}</span>
                      {b.pages ? (
                        <>
                          <Progress value={((b.currentPage ?? 0) / b.pages) * 100} />
                          <span className={ui.muted}>
                            {b.currentPage ?? 0} / {b.pages}쪽{left ? ` · 남은 시간 ${speed.measured ? "" : "어림 "}${formatMinutes(left)}` : ""}
                          </span>
                        </>
                      ) : (
                        <span className={ui.muted}>쪽수를 넣으면 남은 시간이 보여요</span>
                      )}
                    </div>
                  </div>
                  <button type="button" className={`${ui.btn} ${ui.btnWide}`} style={{ marginTop: 14 }} onClick={() => startRead(b)} disabled={Boolean(flow)}>
                    이어 읽기 ▸
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {books && me && (
        <section className={`${ui.paper} ${s.section}`}>
          <Tape color="sky" />
          <span className={ui.paperLabel}>놀러 온 친구</span>
          {guests.length === 0 ? (
            <p className={ui.muted} style={{ marginBottom: 10 }}>
              아직 놀러 온 친구가 없어요. 내 도서관을 공유하면 친구가 놀러 와서 발도장을 남겨요.
            </p>
          ) : (
            <div className={s.stack12} style={{ marginBottom: 12 }}>
              {guests.slice(0, 6).map((g) => (
                <Link key={g.handle} href={`/u/${g.handle}`} className={s.guestRow}>
                  {g.stamp ? <StampIcon kind={g.stamp.kind} size={28} /> : <Sparkle size={22} color="var(--mint)" />}
                  <span className={s.nowBody} style={{ gap: 2 }}>
                    <b>
                      {g.nickname} <span className={ui.muted} style={{ fontWeight: 400 }}>· {asOf ? ago(g.at, asOf) : ""}</span>
                    </b>
                    {g.stamp?.note ? <span style={{ fontSize: 14 }}>&ldquo;{g.stamp.note}&rdquo;</span> : <span className={ui.muted}>{g.stamp ? "발도장을 남겼어요" : "놀러 왔다 갔어요"}</span>}
                  </span>
                  <span className={ui.muted}>놀러 가기 ›</span>
                </Link>
              ))}
            </div>
          )}
          <div style={{ textAlign: "center" }}>
            <ShareLibrary name={me.nickname === "나" ? "내" : me.nickname} wide onDone={(m) => { setToast(m); setTimeout(() => setToast(null), 3000); }} />
          </div>
        </section>
      )}

      {showCredit && <Yes24Credit />}

      {toastEl}

      {flow && !gl && (
        <ReadingOverlay
          flow={flow}
          speed={speed}
          busy={busy}
          error={flowErr}
          onOutDone={() => flowRef.current && setFlow({ ...flowRef.current, phase: "reading" })}
          onBackDone={backDone}
          onFinish={finish}
          onPutBack={() => putBack2d()}
        />
      )}
    </>
  );
}
