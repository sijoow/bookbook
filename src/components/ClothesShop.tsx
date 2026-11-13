"use client";
/* eslint-disable @next/next/no-img-element -- 우리 스티커 그림 (작은 webp) */

// 옷 가게 — 11-13 사용자: "옷도 사게 해서 입히는 것도" + 동물의 숲 옷 가게처럼 "가운데 캐릭터, 둘레에 옷과 값, 아래 합계"
// 가운데 = 서 있는 내 아바타(누른 옷을 바로 입어 봄), 양옆 = 옷 6벌(스티커 + 값), 아래 = 고른 옷 · 값 · 사기/입기/벗기.
// 그 게임의 그림·색은 따라 하지 않는다 — 배치만, 그림체는 우리 다꾸.
// 사면 바로 입는다(배달 상자는 선물일 때만), 가진 옷은 여기서 바로 입고 벗는다. 한 벌만 (자리 body).

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { AvatarConfig } from "@/lib/avatar/config";
import type { LibraryBook } from "@/lib/books/types";
import { CLOTHES, POINT_NAME, type Deco, type DecoItem } from "@/lib/deco/items";
import m from "./maker.module.css";

const LibraryStage = dynamic(() => import("./library3d/LibraryStage"), { ssr: false });
const NO_BOOKS: LibraryBook[] = [];

export function ClothesShop({
  avatar,
  name,
  deco,
  points,
  busy,
  onBuy,
  onWear,
  onClose,
}: {
  avatar: AvatarConfig;
  name: string;
  deco: Deco;
  points: number;
  busy: boolean;
  onBuy: (item: DecoItem) => void;
  onWear: (item: DecoItem) => void; // 입기/벗기 (가진 옷)
  onClose: () => void;
}) {
  const wearing = deco.worn.find((id) => CLOTHES.some((c) => c.id === id)) ?? null;
  const [pick, setPick] = useState<string | null>(wearing);
  const item = CLOTHES.find((c) => c.id === pick) ?? null;
  // 입어 보기 — 고른 옷을 입힌 모습 (저장은 '입기'·'사기'에서)
  const view = useMemo(() => {
    const rest = deco.worn.filter((id) => !CLOTHES.some((c) => c.id === id));
    return { worn: pick ? [...rest, pick] : rest, placed: [] as string[] };
  }, [deco.worn, pick]);

  const tile = (c: DecoItem) => {
    const owned = deco.owned.includes(c.id);
    const coming = deco.boxes.includes(c.id);
    return (
      <button key={c.id} type="button" className={`${m.shopTile} ${pick === c.id ? m.shopTileOn : ""}`} onClick={() => setPick(pick === c.id ? null : c.id)} aria-pressed={pick === c.id} aria-label={`${c.label} 입어 보기`}>
        <img src={`/img/stickers/${c.id}.webp`} alt="" />
        <span className={m.shopName}>{c.label}</span>
        <small className={m.shopPrice}>{owned ? (wearing === c.id ? "입는 중" : "내 옷") : coming ? "배달 중" : `${c.price} ${POINT_NAME}`}</small>
      </button>
    );
  };

  let action: { label: string; run: () => void; off?: boolean; note?: string } | null = null;
  if (item) {
    if (deco.owned.includes(item.id)) action = wearing === item.id ? { label: "벗기", run: () => onWear(item), note: "기본 옷으로 돌아가요" } : { label: "입기", run: () => onWear(item) };
    else if (deco.boxes.includes(item.id)) action = { label: "닫고 상자 열기", run: onClose, note: "방에 온 배달 상자를 열면 바로 입어요" };
    else if (points < item.price) action = { label: "사기", run: () => {}, off: true, note: `${POINT_NAME}가 ${item.price - points} 모자라요 — 책을 읽으면 쌓여요` };
    else action = { label: "사기", run: () => onBuy(item), note: `사면 바로 입어요 · 남는 ${POINT_NAME} ${points - item.price}` };
  }

  return (
    <div className={m.sheet} role="dialog" aria-modal="true" aria-label="옷 가게">
      <div className={m.sheetHead}>
        <span className={m.sheetTitle}>옷 가게</span>
        <span className={m.shopPoints} aria-label={`내 ${POINT_NAME} ${points}`}>
          <i aria-hidden /> {points.toLocaleString()}
        </span>
        <button type="button" className={m.sheetClose} onClick={onClose}>
          닫기
        </button>
      </div>
      <div className={m.shop}>
        <div className={m.shopCol}>{CLOTHES.slice(0, 3).map(tile)}</div>
        <div className={m.shopStage}>
          <LibraryStage mode="preview" books={NO_BOOKS} avatar={avatar} name={name} me deco={view} focus="body" stand className={m.stageSlot} />
        </div>
        <div className={m.shopCol}>{CLOTHES.slice(3, 6).map(tile)}</div>
      </div>
      <div className={m.shopBar}>
        <div className={m.shopSum}>
          {item ? (
            <>
              <b>{item.label}</b>
              <span>{deco.owned.includes(item.id) ? "가진 옷" : `${item.price} ${POINT_NAME}`}</span>
            </>
          ) : (
            <span>옷을 누르면 입어 볼 수 있어요</span>
          )}
        </div>
        {action && (
          <button type="button" className={m.shopBuy} onClick={action.run} disabled={busy || action.off}>
            {action.label}
          </button>
        )}
      </div>
      {action?.note && <p className={m.shopNote}>{action.note}</p>}
    </div>
  );
}
