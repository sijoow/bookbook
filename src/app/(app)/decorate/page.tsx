"use client";
/* eslint-disable @next/next/no-img-element -- 우리 스티커 그림 (작은 webp) */

// 꾸미기 · 상점 — 11-13 사용자: "책을 다 읽거나 할 때마다 포인트가 쌓이고, 장식품을 구매해서 내 집을 꾸미는 시스템"
// 위 무대는 내 방 그대로 — 산 물건은 배달 상자로 방에 오고, 상자를 누르면 아바타가 열어 바로 하고/놓는다.
// 물건 칸: 가진 것(누르면 하기/빼기) · 상자 속(누르면 열기) · 아직(값 — 누르면 '살까요?')
// 내 집(벽·바닥·창·구도)도 여기서 바꾼다. 얼굴·머리·옷 색은 마이페이지. 옷 가게(옷 한 벌 사서 입기, 11-13)는 화면 가득 창으로.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { TopBar } from "@/components/Bars";
import { ClothesShop } from "@/components/ClothesShop";
import { Sparkle, Tape } from "@/components/Deco";
import type { StageApi } from "@/components/library3d/LibraryStage";
import stage from "@/components/library3d/stage.module.css";
import { StageLoading } from "@/components/library3d/StageLoading";
import ui from "@/components/ui.module.css";
import type { AvatarConfig } from "@/lib/avatar/config";
import { api } from "@/lib/client/api";
import { makeSaver } from "@/lib/client/saver";
import { hasWebGL } from "@/lib/client/webgl";
import { CLOTHES, PAINTS, PAINT_COLOR, PAINT_LABEL, POINTS, POINT_NAME, ROOM_SURFACES, SHELF_ITEMS, TRACK, wear, type Deco, type DecoItem, type PaintId } from "@/lib/deco/items";
import { HOUSE, HOUSES, type HouseId } from "@/lib/house/houses";
import type { LibraryBook } from "@/lib/books/types";
import s from "../screens.module.css";

const LibraryStage = dynamic(() => import("@/components/library3d/LibraryStage"), {
  ssr: false,
  loading: () => (
    <div className={stage.slot}>
      <StageLoading />
    </div>
  ),
});

type Me = { handle: string; nickname: string; avatar: AvatarConfig; deco: Deco; points: number; house: HouseId; readCount: number; pending: number };
type History = { reason: string; delta: number; ref: string; at: string; note: string | null };

const SLOT_LABEL = { head: "머리", neck: "목", back: "등", body: "몸" } as const;
const REASON: Record<string, string> = { welcome: "처음 가입", finish: "책을 다 읽음", shelve: "책을 꽂음", read: "읽은 시간", buy: "샀어요", admin: "선물 (운영)", mission: "오늘의 미션" };

export default function Decorate() {
  const [me, setMe] = useState<Me | null>(null);
  const [books, setBooks] = useState<LibraryBook[] | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastSticker, setToastSticker] = useState<string | null>(null);
  const [asking, setAsking] = useState<DecoItem | null>(null); // '살까요?'
  const [buying, setBuying] = useState(false);
  const [shopOpen, setShopOpen] = useState(false); // 옷 가게 창
  const [gl] = useState(hasWebGL);
  const stageApi = useRef<StageApi | null>(null);
  const opening = useRef(false);
  // 켜고 끄기를 빠르게 해도 마지막 상태가 저장되게 (한 번에 하나씩, 늘 전체 목록)
  const [saveDeco] = useState(() => makeSaver((d: { worn: string[]; placed: string[] }) => api("/api/me", { method: "PATCH", json: { deco: d } }), (e) => setErr(e.message)));
  const [savePaint] = useState(() => makeSaver((paint: PaintId) => api("/api/me", { method: "PATCH", json: { deco: { paint } } }), (e) => setErr(e.message)));
  const [saveHouse] = useState(() => makeSaver((house: HouseId) => api("/api/me", { method: "PATCH", json: { house } }), (e) => setErr(e.message)));

  useEffect(() => {
    let alive = true;
    Promise.all([api<Me>("/api/me"), api<{ books: LibraryBook[] }>("/api/library"), api<{ history: History[] }>("/api/shop")])
      .then(([m, l, sh]) => {
        if (!alive) return;
        setMe(m);
        setBooks(l.books);
        setHistory(sh.history);
      })
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const myDeco = me?.deco;
  const decoView = useMemo(() => (myDeco ? { worn: myDeco.worn, placed: myDeco.placed, pos: myDeco.pos, paint: myDeco.paint } : undefined), [myDeco]);

  function say(t: string, sticker: string | null = null) {
    setToast(t);
    setToastSticker(sticker);
    setTimeout(() => {
      setToast(null);
      setToastSticker(null);
    }, 2800);
  }

  /** 하고/놓기 켜고 끄기 — 화면 먼저, 저장은 줄 세워서 */
  function toggle(item: DecoItem) {
    if (!me) return;
    setErr(null);
    const d = me.deco;
    const worn = item.kind === "avatar" ? (d.worn.includes(item.id) ? d.worn.filter((x) => x !== item.id) : wear(d.worn, item.id)) : d.worn;
    const placed = item.kind !== "avatar" ? (d.placed.includes(item.id) ? d.placed.filter((x) => x !== item.id) : [...d.placed, item.id]) : d.placed;
    setMe({ ...me, deco: { ...d, worn, placed } });
    saveDeco({ worn, placed });
  }

  /** 배달 상자 열기 — 아바타가 열고 물건을 바로 하고/놓는다 */
  async function openGift() {
    if (opening.current || !me || me.pending <= 0) return;
    opening.current = true;
    try {
      const r = await api<{ item: DecoItem; deco: Deco; pending: number }>("/api/me/gift", { method: "POST" });
      if (stageApi.current) await stageApi.current.openGift(r.item.id, r.deco, r.pending);
      setMe((m) => (m ? { ...m, deco: r.deco, pending: r.pending } : m));
      say(`${r.item.label}${r.item.kind === "avatar" ? " — 바로 했어요" : " — 방에 놓았어요"}`, r.item.id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      opening.current = false;
    }
  }

  /** 사기 — 포인트를 빼고 배달 상자가 방에 온다 (위로 올라가 상자를 보여 준다) */
  async function buy(item: DecoItem) {
    if (!me || buying) return;
    setBuying(true);
    setErr(null);
    try {
      const r = await api<{ points: number; pending: number }>("/api/shop", { json: { id: item.id } });
      setMe((m) => (m ? { ...m, points: r.points, pending: r.pending, deco: { ...m.deco, boxes: [...m.deco.boxes, item.id] } } : m));
      setHistory((h) => [{ reason: "buy", delta: -item.price, ref: item.id, at: new Date().toISOString(), note: null }, ...h]);
      setAsking(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      say(`${item.label} 배달 상자가 왔어요 — 상자를 눌러 열어요`, item.id);
    } catch (e) {
      setErr((e as Error).message);
      setAsking(null);
    } finally {
      setBuying(false);
    }
  }

  // 옷 가게 창이 열려 있는 동안 뒤 화면이 밀리지 않게
  useEffect(() => {
    if (!shopOpen) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, [shopOpen]);

  /** 책장 칠하기 색 — 칠하기를 꺼 두었으면 켜면서 */
  function paint(p: PaintId) {
    if (!me) return;
    const d = me.deco;
    const placed = d.placed.includes("paint") ? d.placed : [...d.placed, "paint"];
    setMe({ ...me, deco: { ...d, paint: p, placed } });
    savePaint(p);
    if (placed !== d.placed) saveDeco({ worn: d.worn, placed });
  }

  function moveHouse(h: HouseId) {
    if (!me || me.house === h) return;
    setMe({ ...me, house: h });
    saveHouse(h);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** 스티커 한 칸 — 가진 것 · 상자 속 · 상점 */
  const tile = (item: DecoItem) => {
    if (!me) return null;
    const img = <img src={`/img/stickers/${item.id}.webp`} alt="" />;
    if (me.deco.owned.includes(item.id)) {
      const on = item.kind === "avatar" ? me.deco.worn.includes(item.id) : me.deco.placed.includes(item.id);
      return (
        <button key={item.id} type="button" className={`${ui.stickerTile} ${on ? ui.stickerOn : ""}`} onClick={() => toggle(item)} aria-pressed={on} aria-label={`${item.label} ${on ? "빼기" : "하기"}`}>
          {img}
          <span>{item.label}</span>
          <small>{on ? (item.kind === "avatar" ? (item.slot === "body" ? "입는 중" : `${SLOT_LABEL[item.slot ?? "head"]}에 하는 중`) : item.kind === "shelf" ? "쓰는 중" : "놓음") : "꺼 둠"}</small>
        </button>
      );
    }
    if (me.deco.boxes.includes(item.id)) {
      return (
        <button key={item.id} type="button" className={`${ui.stickerTile} ${ui.stickerBox}`} onClick={openGift} aria-label={`${item.label} — 배달 상자 열기`}>
          {img}
          <span>{item.label}</span>
          <small>상자 속 · 열기</small>
        </button>
      );
    }
    const short = me.points < item.price;
    return (
      <button key={item.id} type="button" className={`${ui.stickerTile} ${s.shopTile} ${short ? s.shopShort : ""}`} onClick={() => setAsking(item)} aria-label={`${item.label} ${item.price}${POINT_NAME}`}>
        {img}
        <span>{item.label}</span>
        <small className={s.price}>
          <i className={s.coin} aria-hidden />
          {item.price}
        </small>
      </button>
    );
  };

  return (
    <>
      <TopBar back="/" title="꾸미기 · 상점" />
      {err && <p className={ui.error}>{err}</p>}

      {me && books && gl && (
        <LibraryStage
          mode="home"
          books={books}
          avatar={me.avatar}
          name={me.nickname}
          me
          house={me.house}
          deco={decoView}
          gifts={me.pending}
          title={me.pending > 0 ? "배달 상자를 눌러 열어요" : "고르면 바로 바뀌어요"}
          onPick={() => void stageApi.current?.greet()}
          onGift={openGift}
          onReady={(a) => (stageApi.current = a)}
        />
      )}

      {me && shopOpen && (
        <ClothesShop
          avatar={me.avatar}
          name={me.nickname}
          deco={me.deco}
          points={me.points}
          busy={buying}
          onWear={toggle}
          onBuy={(item) => {
            void buy(item).then(() => setShopOpen(false));
          }}
          onClose={() => setShopOpen(false)}
        />
      )}

      {me && (
        <>
          <section className={`${ui.paper} ${s.section}`}>
            <Tape color="coral" />
            <span className={ui.paperLabel}>내 {POINT_NAME}</span>
            <p className={s.pointBig}>
              <i className={s.coin} aria-hidden /> {me.points.toLocaleString()}
            </p>
            <p className={ui.muted} style={{ marginTop: 4, lineHeight: 1.6 }}>
              책을 다 읽으면 +{POINTS.finish} · 읽은 시간 10분마다 +{POINTS.readPer10}(하루 {POINTS.readDailyCap}까지) · 책을 꽂으면 +{POINTS.shelve}(하루 {POINTS.shelveDailyMax}권)
            </p>
            {me.pending > 0 && (
              <button type="button" className={`${ui.btn} ${ui.btnWide}`} style={{ marginTop: 12 }} onClick={openGift}>
                배달 상자 열기 ({me.pending}) ▸
              </button>
            )}
            {history.length > 0 && (
              <details className={s.history}>
                <summary>최근 {POINT_NAME} 내역</summary>
                <ul>
                  {history.slice(0, 12).map((h, i) => (
                    <li key={i}>
                      <span>{h.reason === "buy" ? `${TRACK.find((t) => t.id === h.ref)?.label ?? "물건"} 샀어요` : (h.note ?? REASON[h.reason] ?? h.reason)}</span>
                      <b className={h.delta < 0 ? s.minus : s.plus}>
                        {h.delta > 0 ? "+" : ""}
                        {h.delta}
                      </b>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <section className={`${ui.paper} ${s.section}`}>
            <Tape color="sky" />
            <span className={ui.paperLabel}>내가 사는 집</span>
            <div className={s.houseGrid}>
              {HOUSES.map((h) => (
                <button key={h} type="button" className={`${s.houseCard} ${me.house === h ? s.houseOn : ""}`} onClick={() => moveHouse(h)} aria-pressed={me.house === h}>
                  <b>{HOUSE[h].label}</b>
                  <span>{HOUSE[h].blurb}</span>
                  <small>{me.house === h ? "지금 사는 집" : HOUSE[h].view}</small>
                </button>
              ))}
            </div>
          </section>

          <section className={`${ui.paper} ${s.section}`}>
            <Tape color="butter" />
            <span className={ui.paperLabel}>아바타 소품</span>
            <p className={ui.muted} style={{ marginBottom: 8 }}>
              머리·목·등에 하나씩 할 수 있어요
            </p>
            <div className={ui.stickerGrid}>{TRACK.filter((t) => t.kind === "avatar" && t.slot !== "body").map(tile)}</div>
          </section>

          <section className={`${ui.paper} ${s.section}`}>
            <Tape color="coral" />
            <span className={ui.paperLabel}>옷 가게</span>
            <p className={ui.muted} style={{ marginBottom: 10 }}>
              한 벌씩 입어요 — 눌러서 입어 보고 사요. 안 입으면 마이페이지에서 고른 옷 색 그대로
            </p>
            <div className={s.clothesRow}>
              {CLOTHES.map((c) => (
                <img key={c.id} src={`/img/stickers/${c.id}.webp`} alt={c.label} title={c.label} className={me.deco.worn.includes(c.id) ? s.clothesOn : ""} />
              ))}
            </div>
            <button type="button" className={`${ui.btn} ${ui.btnWide}`} style={{ marginTop: 12 }} onClick={() => setShopOpen(true)}>
              옷 가게 들어가기 ▸
            </button>
          </section>

          <section className={`${ui.paper} ${s.section}`}>
            <Tape color="mint" />
            <span className={ui.paperLabel}>방 꾸미기</span>
            <p className={ui.muted} style={{ marginBottom: 8 }}>
              놓고 싶은 것만 켜 두세요. 친구가 놀러 오면 그대로 보여요
            </p>
            <div className={ui.stickerGrid}>{TRACK.filter((t) => t.kind === "room" && t.id !== "ladder").map(tile)}</div>
            {gl && me.deco.placed.some((id) => ROOM_SURFACES[id]) && (
              <>
                <p className={ui.muted} style={{ margin: "12px 0 8px" }}>
                  놓은 물건은 끌어서 책장 위·바닥·벽 어디로든 옮길 수 있어요 (줄 전구는 책장에 걸려 있어 그대로)
                </p>
                <Link href="/?arrange=1" className={`${ui.btn} ${ui.btnWide}`}>
                  방에서 자리 옮기기 ▸
                </Link>
              </>
            )}
          </section>

          <section className={`${ui.paper} ${s.section}`}>
            <Tape color="sky" />
            <span className={ui.paperLabel}>책장 꾸미기</span>
            <p className={ui.muted} style={{ marginBottom: 8 }}>
              넓은 책장은 한 칸에 책이 더, 높은 책장은 한 줄 더. 켜고 끌 수 있어요
            </p>
            <div className={ui.stickerGrid}>{SHELF_ITEMS.map(tile)}</div>
            {me.deco.owned.includes("paint") && (
              <>
                <p className={ui.muted} style={{ margin: "12px 0 8px" }}>
                  책장 색 {me.deco.placed.includes("paint") ? `— 지금 ${PAINT_LABEL[me.deco.paint]}` : "— 칠하기가 꺼져 있어요 (원목)"}
                </p>
                <div className={s.paintRow} role="radiogroup" aria-label="책장 색">
                  {PAINTS.map((p) => {
                    const on = me.deco.placed.includes("paint") && me.deco.paint === p;
                    return (
                      <button key={p} type="button" role="radio" aria-checked={on} aria-label={PAINT_LABEL[p]} title={PAINT_LABEL[p]} className={`${s.paintDot} ${on ? s.paintOn : ""}`} style={{ background: PAINT_COLOR[p][0] }} onClick={() => paint(p)}>
                        <span>{PAINT_LABEL[p]}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          <section className={`${ui.paper} ${s.section}`}>
            <Tape color="apricot" />
            <span className={ui.paperLabel}>아바타 얼굴 · 머리 · 옷</span>
            <p className={ui.muted} style={{ marginBottom: 10 }}>
              눈·눈썹·입·볼과 머리·옷 색, 예시 모습 고르기는 마이페이지 &lsquo;나의 모습 꾸미기&rsquo;에서
            </p>
            <Link href="/me" className={`${ui.btn} ${ui.btnWide}`}>
              마이페이지에서 꾸미기 ▸
            </Link>
          </section>

          <p style={{ textAlign: "center", marginTop: 18 }}>
            <Link href="/" className={ui.textBtn}>
              도서관으로 ›
            </Link>
          </p>
        </>
      )}

      {asking && me && (
        <div className={stage.sheet} role="dialog" aria-modal="true" aria-label={`${asking.label} 사기`}>
          <img src={`/img/stickers/${asking.id}.webp`} alt="" width={84} height={84} style={{ objectFit: "contain" }} />
          <p className={s.handTitle} style={{ marginTop: 6 }}>
            {asking.label}
          </p>
          <p className={s.price} style={{ justifyContent: "center", fontSize: 18, marginTop: 4 }}>
            <i className={s.coin} aria-hidden />
            {asking.price} {POINT_NAME}
          </p>
          <p className={ui.muted} style={{ marginTop: 6 }}>
            {me.points >= asking.price ? `사고 나면 ${(me.points - asking.price).toLocaleString()} ${POINT_NAME}가 남아요 · 배달 상자로 와요` : `${(asking.price - me.points).toLocaleString()} ${POINT_NAME}가 모자라요 — 책을 읽으면 쌓여요`}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
            <button type="button" className={ui.btn} disabled={buying || me.points < asking.price} onClick={() => void buy(asking)}>
              {buying ? "사는 중…" : "살게요"}
            </button>
            <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={() => setAsking(null)}>
              그만두기
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className={s.toast} role="status">
          {toastSticker ? <img src={`/img/stickers/${toastSticker}.webp`} alt="" width={30} height={30} style={{ objectFit: "contain", verticalAlign: "middle" }} /> : <Sparkle size={16} />} {toast}
        </div>
      )}
    </>
  );
}
