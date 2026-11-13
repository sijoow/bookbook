"use client";

// 친구 도서관 놀러 가기 — 친구 책장(읽기만)에 친구 아바타가 앉아 있다. 책을 누르면 친구 아바타가 꺼내 와서 보여 준다.
// 11-12: 내 아바타도 손님으로 걸어 들어와 앉고(놀러 온 기록), 발도장(스티커 + 한마디)을 남기면 친구의 '놀러 온 친구'에 보인다.
// 나와 같은 책엔 반짝이. 고른 책의 친구 상태·별점·한줄평·걸린 시간 → 내 책장에 담기. '통하는 책'에서 같은 책을 나란히.
// 11-13 사용자: "친구네 놀러 갔을 때도 원래 우리 메인에 있던 그 스타일로" → 홈처럼 무대가 화면 가득:
//   왼쪽 위 ‹(멀티버스로) · 이름판 '○○의 도서관' · 왼쪽 색인 탭 → 옆 서랍(숫자·통하는 책) ·
//   아래 메뉴(발도장 · 통하는 책 · 크게 보기 · 우리 집). 친구가 책을 보여 주면 메뉴가 내려가고 책 카드가 올라온다.
// 입체 화면을 못 여는 기기는 2D 책장 (예전 화면).

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TopBar } from "@/components/Bars";
import { CoverSticker, Stars } from "@/components/Bits";
import { Bookshelf } from "@/components/Bookshelf";
import { Sparkle, Tape, Yes24Credit } from "@/components/Deco";
import { HudBack, HudBar, HudButton, HudCredit, SideDrawer, SideTab, Stat, hud } from "@/components/HomeHud";
import { MenuIcon } from "@/components/MenuIcon";
import { STAMPS, STAMP_LABEL, StampIcon } from "@/components/Stamp";
import type { StageApi } from "@/components/library3d/LibraryStage";
import stage from "@/components/library3d/stage.module.css";
import ui from "@/components/ui.module.css";
import { readAvatar, type AvatarConfig } from "@/lib/avatar/config";
import { readDeco, type Deco } from "@/lib/deco/items";
import type { HouseId } from "@/lib/house/houses";
import { api } from "@/lib/client/api";
import { hasWebGL } from "@/lib/client/webgl";
import { formatMinutes } from "@/lib/books/reading";
import { STATUS_SAY, shortAuthor, type BookStatus, type LibraryBook } from "@/lib/books/types";
import { josa } from "@/lib/ko";
import s from "../../screens.module.css";

const LibraryStage = dynamic(() => import("@/components/library3d/LibraryStage"), {
  ssr: false,
  loading: () => <div className={`${stage.slot} ${stage.immersiveSlot}`} />,
});
const HUD_INSETS = { top: 50, bottom: 96, left: 0 };

type Side = { id: string; status: BookStatus; readMinutes: number; rating: number | null; oneLiner: string | null };
type PortalView = { workKey: string; open: boolean; title: string; coverUrl: string | null; mine: Side; theirs: Side };
type Data = { user: { handle: string; nickname: string; avatar: AvatarConfig; deco?: Deco; house?: HouseId }; books: LibraryBook[]; portals: PortalView[]; myWorkKeys: string[] };

/** "다 읽음 · 4시간 20분" */
function sideLine(x: Side): string {
  const t = x.readMinutes > 0 ? ` · ${formatMinutes(x.readMinutes)}` : "";
  return `${STATUS_SAY[x.status]}${t}`;
}

export default function FriendLibrary() {
  const { handle } = useParams<{ handle: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<LibraryBook | null>(null);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  // 서버·첫 화면은 둘 다 '입체'로 같게 (하이드레이션), 불러온 뒤 실제로 잰다
  const [gl, setGl] = useState(true);
  const stageApi = useRef<StageApi | null>(null);
  const card = useRef<HTMLElement>(null);
  const [mine2, setMine2] = useState<{ nickname: string; avatar: AvatarConfig; deco: Deco } | null>(null);
  const [stamp, setStamp] = useState<string>("heart");
  const [note, setNote] = useState("");
  const [stamped, setStamped] = useState(false);
  const [stampOpen, setStampOpen] = useState(false); // 발도장 창
  const [drawer, setDrawer] = useState(false); // 옆 서랍 (숫자·통하는 책)
  const [shelf, setShelf] = useState(false); // 크게 보기 중

  useEffect(() => {
    let alive = true;
    api<Data>(`/api/universe/${encodeURIComponent(handle)}`)
      .then((d) => {
        if (!alive) return;
        setGl(hasWebGL());
        setData(d);
        setMine(new Set(d.myWorkKeys));
        // 놀러 왔다 (3시간에 한 번만 센다)
        api(`/api/universe/${encodeURIComponent(handle)}/visit`, { method: "POST" }).catch(() => {});
      })
      .catch((e: Error) => alive && setErr(e.message));
    // 손님으로 들어갈 내 아바타
    api<{ nickname: string; avatar: AvatarConfig; deco: Deco }>("/api/me")
      .then((m) => alive && setMine2(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [handle]);

  const portals = useMemo(() => data?.portals ?? [], [data]);
  const marks = useMemo(() => new Set(portals.map((p) => p.theirs.id)), [portals]);
  const guest = useMemo(() => (mine2 ? { avatar: mine2.avatar, name: mine2.nickname, worn: mine2.deco.worn } : null), [mine2]);
  // 옛 서버 응답엔 아바타가 없을 수 있다 → 아이디로 정한 기본 아바타
  const avatar = useMemo(() => (data ? readAvatar(data.user.avatar, data.user.handle) : null), [data]);
  // 친구가 꾸민 방·소품 그대로
  const deco = useMemo(() => {
    const d = readDeco(data?.user.deco);
    return { worn: d.worn, placed: d.placed, pos: d.pos, paint: d.paint };
  }, [data]);
  const closeDrawer = useCallback(() => setDrawer(false), []);

  const name = data?.user.nickname ?? "친구";
  const open = portals.filter((p) => p.open).length;
  const say = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 2800);
  };

  function choose(b: LibraryBook) {
    setSel(b);
    setStampOpen(false);
    void stageApi.current?.present(b.id);
    // (2D) 고른 책 카드가 화면 아래에 있으면 살짝 보이게
    setTimeout(() => card.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 60);
  }

  function closeCard() {
    setSel(null);
    void stageApi.current?.stow();
  }

  /** 발도장 남기기 — 손님(나)이 만세, 친구의 '놀러 온 친구'에 보인다 */
  async function leaveStamp(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api(`/api/universe/${encodeURIComponent(handle)}/stamp`, { json: { kind: stamp, note: note.trim() || undefined } });
      stageApi.current?.guestCheer();
      setStamped(true);
      setNote("");
      setStampOpen(false);
      say(`발도장을 남겼어요 — ${name}의 도서관 '놀러 온 친구'에 보여요`);
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  }

  async function take(b: LibraryBook) {
    setErr(null);
    try {
      const r = await api<{ book: LibraryBook; duplicate: boolean }>(`/api/universe/${encodeURIComponent(handle)}/take`, { json: { bookId: b.id } });
      setMine((m) => new Set(m).add(b.workKey));
      say(r.duplicate ? "이미 내 책장에 있는 책이에요" : `『${r.book.title}』${josa(r.book.title, "을", "를")} 내 책장 '읽고 싶은'에 꽂았어요`);
      if (!r.duplicate) void stageApi.current?.greet("잘 읽어!");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  /** 고른 책 — 친구가 보여 주는 책 (상태·걸린 시간·별점·한줄평 · 담기 · 돌려주기) */
  const bookInfo = (b: LibraryBook) => (
    <>
      <div className={s.nowRow}>
        <CoverSticker src={b.coverUrl} title={b.title} w={62} tilt={-3} />
        <div className={s.nowBody}>
          <span className={s.bookTitle}>{b.title}</span>
          <span className={ui.muted}>{shortAuthor(b.author)}</span>
          <span style={{ fontSize: 14 }}>
            {name}: {STATUS_SAY[b.status]}
            {b.readMinutes > 0 ? (b.status === "read" ? ` · ${formatMinutes(b.readMinutes)} 걸림` : ` · 지금까지 ${formatMinutes(b.readMinutes)}`) : ""}
          </span>
          {b.rating ? <Stars value={b.rating} size={16} /> : null}
        </div>
      </div>
      {b.oneLiner && <p className={s.quote}>&ldquo;{b.oneLiner}&rdquo;</p>}
    </>
  );

  const portalList = (
    <>
      {portals.length === 0 && <p className={ui.muted}>아직 같은 책이 없어요. {name}의 책을 담아 읽어 보면 통로가 생겨요.</p>}
      {portals.map((p) => (
        <div key={p.workKey} className={s.portalRow}>
          <CoverSticker src={p.coverUrl} title={p.title} w={44} tilt={0} />
          <div className={s.nowBody}>
            <span className={s.bookTitle}>
              {p.title} {p.open ? <span className={s.openTag}>열린 통로</span> : <span className={s.faintTag}>희미한 통로</span>}
            </span>
            <span style={{ fontSize: 13 }}>
              {name}: {sideLine(p.theirs)}
            </span>
            <span style={{ fontSize: 13 }}>
              나: {sideLine(p.mine)} ·{" "}
              <Link href={`/book/${p.mine.id}`} style={{ textDecoration: "underline" }}>
                내 기록
              </Link>
            </span>
            {p.theirs.oneLiner && <span className={ui.muted}>&ldquo;{p.theirs.oneLiner}&rdquo;</span>}
          </div>
        </div>
      ))}
    </>
  );

  const stampForm = (
    <form onSubmit={leaveStamp}>
      <div className={ui.chips} role="radiogroup" aria-label="발도장 스티커">
        {STAMPS.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={stamp === k} className={`${ui.chip} ${stamp === k ? ui.chipOn : ""}`} onClick={() => setStamp(k)}>
            <StampIcon kind={k} size={20} /> {STAMP_LABEL[k]}
          </button>
        ))}
      </div>
      <input className={ui.field} style={{ marginTop: 10 }} value={note} maxLength={40} onChange={(e) => setNote(e.target.value)} placeholder={`${name}에게 한마디 (40자까지, 안 써도 돼요)`} aria-label="한마디" />
      <button className={`${ui.btn} ${ui.btnWide}`} style={{ marginTop: 10 }}>
        {stamped ? "발도장 하나 더 ▸" : "꾹 남기기 ▸"}
      </button>
    </form>
  );

  const toastEl = toast && (
    <div className={`${s.toast} ${gl ? s.toastHigh : ""}`} role="status">
      <Sparkle size={16} /> {toast}
    </div>
  );

  // ── 입체: 무대가 화면 가득 (홈과 같은 모양) ──
  if (gl) {
    const showCredit = Boolean(data?.books.some((b) => b.coverUrl || b.sideCoverUrl));
    return (
      <>
        <div className={s.immersive} data-immersive>
          {data && avatar ? (
            <LibraryStage
              house={data.user.house}
              mode="visit"
              immersive
              insets={HUD_INSETS}
              books={data.books}
              avatar={avatar}
              deco={deco}
              guest={guest}
              name={name}
              marks={marks}
              title={`${name}의 도서관`}
              onPick={choose}
              onReady={(a) => (stageApi.current = a)}
              onFail={() => setGl(false)}
              onView={setShelf}
              hud={
                <>
                  <HudBack href="/multiverse" label="멀티버스로 돌아가기" />
                  <SideTab open={drawer} onOpen={() => setDrawer(true)} label={`${name}의 책장`} />
                  {showCredit && <HudCredit />}
                  <HudBar cols={4} hidden={Boolean(sel) || stampOpen}>
                    <HudButton icon={<MenuIcon name="paw" />} label="발도장" onClick={() => setStampOpen(true)} />
                    <HudButton icon={<MenuIcon name="portal" />} label="통하는 책" badge={portals.length || undefined} onClick={() => setDrawer(true)} />
                    <HudButton icon={shelf ? <MenuIcon name="house" /> : <MenuIcon name="zoom" />} label={shelf ? "방 보기" : "크게 보기"} on={shelf} onClick={() => stageApi.current?.setShelfView(!shelf)} />
                    <HudButton icon={<MenuIcon name="house" />} label="우리 집" href="/" />
                  </HudBar>
                </>
              }
            />
          ) : (
            <div className={`${stage.slot} ${stage.immersiveSlot}`} />
          )}
          {err && <p className={`${ui.error} ${s.immersiveErr}`}>{err}</p>}
        </div>

        {/* 친구가 보여 주는 책 — 메뉴 자리에 올라온다 */}
        <section className={`${s.readBar} ${sel ? s.readBarOn : ""} ${s.visitCard}`} aria-hidden={!sel || undefined} inert={!sel || undefined} aria-label="친구가 보여 주는 책">
          {sel && (
            <>
              {bookInfo(sel)}
              <div className={s.visitActions}>
                {mine.has(sel.workKey) ? (
                  <span className={ui.muted}>내 책장에 있는 책이에요</span>
                ) : (
                  <button type="button" className={ui.btn} onClick={() => take(sel)}>
                    내 책장에 담기 ▸
                  </button>
                )}
                <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={closeCard}>
                  {name}에게 돌려주기
                </button>
              </div>
            </>
          )}
        </section>

        {/* 발도장 창 */}
        {stampOpen && (
          <div className={stage.sheet} role="dialog" aria-modal="true" aria-label="발도장 남기기">
            <p className={s.handTitle} style={{ marginBottom: 10 }}>
              {name}에게 발도장
            </p>
            {stampForm}
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button type="button" className={ui.textBtn} onClick={() => setStampOpen(false)}>
                그만두기
              </button>
            </div>
          </div>
        )}

        <SideDrawer open={drawer} onClose={closeDrawer} title={`${name}의 책장`}>
          {data && (
            <>
              <div className={hud.stats}>
                <Stat value={`${data.books.length}권`} label="꽂힌 책" />
                <Stat value={`${portals.length}권`} label="나와 같은 책" />
                <Stat value={`${open}개`} label="열린 통로 (둘 다 다 읽음)" />
                <Stat value={`${data.books.filter((b) => b.status === "read").length}권`} label={`${name}이(가) 다 읽은 책`} />
              </div>
              <p className={hud.small} style={{ marginTop: 10 }}>
                <Sparkle size={12} color="var(--mint)" /> 반짝이는 책은 나도 가진 책이에요. 책을 누르면 {name}
                {josa(name, "이", "가")} 꺼내 와서 보여 줘요.
              </p>
              <section className={hud.block}>
                <h3 className={hud.blockTitle}>통하는 책</h3>
                {portalList}
              </section>
              {showCredit && <Yes24Credit />}
            </>
          )}
        </SideDrawer>
        {toastEl}
      </>
    );
  }

  // ── 2D (입체를 못 여는 기기) — 예전 화면 ──
  return (
    <>
      <TopBar back="/multiverse" title={`${name}의 도서관`} />
      {err && <p className={ui.error}>{err}</p>}

      {data && (
        <>
          <section className={s.hero} style={{ paddingBottom: 0 }}>
            <p className={ui.muted}>
              책 {data.books.length}권 · 열린 통로 {open} · 같은 책 {portals.length}
            </p>
            <p className={ui.muted}>
              <Sparkle size={12} color="var(--mint)" /> 반짝이는 책은 나도 가진 책이에요
            </p>
          </section>

          <Bookshelf title={`${name}의 책장`} books={data.books} onPick={choose} marks={marks} addSlot={false} pickLabel="보기" />

          {sel && (
            <section ref={card} className={`${ui.paper} ${s.section}`}>
              <Tape color="butter" />
              {bookInfo(sel)}
              {mine.has(sel.workKey) ? (
                <p className={ui.muted} style={{ marginTop: 12, textAlign: "center" }}>
                  내 책장에 있는 책이에요
                </p>
              ) : (
                <button type="button" className={`${ui.btn} ${ui.btnWide}`} style={{ marginTop: 14 }} onClick={() => take(sel)}>
                  내 책장에 담기 ▸
                </button>
              )}
              <div style={{ textAlign: "center", marginTop: 10 }}>
                <button type="button" className={ui.textBtn} onClick={closeCard}>
                  닫기
                </button>
              </div>
            </section>
          )}

          <section className={`${ui.paper} ${s.section}`}>
            <Tape color="coral" />
            <span className={ui.paperLabel}>발도장 남기기</span>
            {stampForm}
          </section>

          <section className={`${ui.paper} ${s.section}`}>
            <Tape color="mint" />
            <span className={ui.paperLabel}>통하는 책</span>
            {portalList}
          </section>
          {data.books.some((b) => b.coverUrl || b.sideCoverUrl) && <Yes24Credit />}
        </>
      )}
      {toastEl}
    </>
  );
}
