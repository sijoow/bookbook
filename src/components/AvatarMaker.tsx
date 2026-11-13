"use client";
/* eslint-disable @next/next/no-img-element -- 그림 칸은 그 자리에서 그린 data URL · 우리 아이콘·스티커(작은 webp) */

// 나의 모습 꾸미기 — 11-13 사용자: 동물의 숲 꾸미기처럼 "얼굴이 확대로 해서 가고 좌우 옆으로 해서 꾸미는" + "밑에 select 방식이 아니라"
//   + "굳이 자기 얼굴 안 넣고 예제를 여러 개 줘서" → 왼쪽 = 아바타 크게(얼굴 탭이면 얼굴로 다가감),
//   오른쪽 = 위 탭(추천·얼굴·머리·눈·입·옷·동물, ‹ › 와 좌우로 밀기) · 그림 칸 · 색 동그라미 · 결정.
// 그 게임의 그림·색·아이콘은 따라 하지 않는다 — 배치만. 그림체는 우리 다꾸(모눈종이·갈색 펜·버터/민트).
// 그림 칸: 머리 모양·추천·몸·안경 = 입체 아바타를 따로 찍은 사진(library3d/thumbs), 눈·눈썹·입·볼 = 얼굴 그림을 잘라 낸 것.

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AVATAR_COLOR,
  BROWS,
  BROWS_LABEL,
  CHEEKS,
  CHEEKS_LABEL,
  EYES,
  EYES_LABEL,
  GENDERS,
  GENDER_LABEL,
  HAIR_COLORS,
  HAIR_COLOR_LABEL,
  HAIR_FOR,
  HAIR_LABEL,
  HAIR_STYLES,
  MOUTHS,
  MOUTH_LABEL,
  OUTFITS,
  OUTFIT_LABEL,
  PETS,
  PET_LABEL,
  PRESETS,
  SKINS,
  SKIN_LABEL,
  STICKERS,
  STICKER_LABEL,
  type AvatarConfig,
} from "@/lib/avatar/config";
import type { LibraryBook } from "@/lib/books/types";
import { FEATURES } from "@/lib/features";
import type { DecoView } from "./library3d/world";
import m from "./maker.module.css";

const LibraryStage = dynamic(() => import("./library3d/LibraryStage"), { ssr: false });
// 내 사진으로 만들기 — 11-13 숨김 (FEATURES.photoAvatar). 켜야만 불러온다
const PhotoAvatar = dynamic(() => import("./PhotoAvatar").then((x) => x.PhotoAvatar), { ssr: false });
const NO_BOOKS: LibraryBook[] = [];

export type MakerTab = "preset" | "face" | "hair" | "eyes" | "mouth" | "outfit" | "pet";
const TABS: Array<{ id: MakerTab; label: string; focus: "face" | "body" | "pet" }> = [
  { id: "preset", label: "추천", focus: "body" },
  { id: "face", label: "얼굴", focus: "face" },
  { id: "hair", label: "머리", focus: "face" },
  { id: "eyes", label: "눈", focus: "face" },
  { id: "mouth", label: "입", focus: "face" },
  { id: "outfit", label: "옷", focus: "body" },
  { id: "pet", label: "동물", focus: "pet" },
];
const ICON: Record<MakerTab, string> = { preset: "preset", face: "face", hair: "hair", eyes: "eyes", mouth: "mouth", outfit: "outfit", pet: "pet" };

type Opt = { key: string; label: string; on: boolean; pick: () => void; img?: string; color?: string };
type Group = { title: string; kind: "thumbs" | "swatches"; wide?: boolean; opts: Opt[] };

/** 얼굴 그림 칸 열쇠 (같은 얼굴이면 다시 그리지 않는다) */
const look = (v: AvatarConfig) => `${v.skin}|${v.eyes}|${v.brows}|${v.mouth}|${v.cheeks}|${v.sticker}`;

export function AvatarMaker({
  value: v,
  onChange,
  onDone,
  name,
  deco,
  doneLabel = "결정",
  busy = false,
  initialTab = "preset",
}: {
  value: AvatarConfig;
  onChange: (patch: Partial<AvatarConfig>) => void;
  onDone: () => void;
  name: string;
  deco?: DecoView;
  doneLabel?: string;
  busy?: boolean;
  initialTab?: MakerTab;
}) {
  const [tab, setTab] = useState<MakerTab>(initialTab);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const focus = TABS.find((t) => t.id === tab)?.focus ?? "body";

  // 그림 칸 — 고른 탭에 필요한 것만, 다 그린 것부터 보인다
  useEffect(() => {
    let alive = true;
    const add = (pairs: Array<[string, string]>) => {
      if (!alive) return;
      setThumbs((t) => {
        const n = { ...t };
        for (const [k, s] of pairs) if (s) n[k] = s;
        return n;
      });
    };
    (async () => {
      if (tab === "face" || tab === "eyes" || tab === "mouth") {
        const { faceThumb } = await import("./library3d/textures");
        const skin = AVATAR_COLOR.skin[v.skin];
        const base = { eyes: v.eyes, brows: v.brows, mouth: v.mouth, cheeks: v.cheeks, sticker: v.sticker };
        const pairs: Array<[string, string]> = [];
        if (tab === "eyes") {
          for (const e of EYES) pairs.push([`eyes:${e}|${look(v)}`, faceThumb({ ...base, eyes: e, brows: "none" }, "eyes", skin)]);
          for (const b of BROWS) pairs.push([`brows:${b}|${look(v)}`, faceThumb({ ...base, brows: b }, "brows", skin)]);
        } else if (tab === "mouth") {
          for (const mo of MOUTHS) pairs.push([`mouth:${mo}|${look(v)}`, faceThumb({ ...base, mouth: mo }, "mouth", skin)]);
        } else {
          for (const c of CHEEKS) pairs.push([`cheeks:${c}|${look(v)}`, faceThumb({ ...base, cheeks: c, sticker: "none" }, "cheeks", skin)]);
          for (const st of STICKERS) pairs.push([`sticker:${st}|${look(v)}`, faceThumb({ ...base, sticker: st }, "cheeks", skin)]);
        }
        add(pairs);
        return;
      }
      if (tab === "pet") return;
      const { avatarThumbs } = await import("./library3d/thumbs");
      if (tab === "preset") {
        const imgs = await avatarThumbs(
          PRESETS.map((p) => ({ ...p.look, pet: "none" })),
          "bust",
        );
        add(PRESETS.map((p, i) => [`preset:${p.id}`, imgs[i]]));
      } else if (tab === "hair") {
        const styles = HAIR_FOR[v.gender] ?? HAIR_STYLES;
        const imgs = await avatarThumbs(
          styles.map((h) => ({ ...v, hair: h, glasses: false })),
          "head",
          { face: false },
        );
        add(styles.map((h, i) => [`hair:${h}|${v.hairColor}|${v.skin}|${v.outfit}`, imgs[i]]));
      } else if (tab === "outfit") {
        const bodies = await avatarThumbs(
          GENDERS.map((g) => ({ ...v, gender: g })),
          "bust",
        );
        const glasses = await avatarThumbs(
          [false, true].map((g) => ({ ...v, glasses: g })),
          "head",
        );
        const rest = JSON.stringify({ ...v, gender: "", glasses: false });
        add([
          ...GENDERS.map((g, i): [string, string] => [`gender:${g}|${rest}`, bodies[i]]),
          [`glasses:0|${rest}|${v.gender}`, glasses[0]],
          [`glasses:1|${rest}|${v.gender}`, glasses[1]],
        ]);
      }
    })().catch(() => {
      // 그림 칸을 못 그리면 글자 칸 그대로
    });
    return () => {
      alive = false;
    };
  }, [tab, v]);

  const groups = useMemo((): Group[] => {
    const t = (k: string) => thumbs[k];
    const opt = <K extends string>(prefix: string, keys: readonly K[], labels: Record<K, string>, cur: K, key: (k: K) => string, patch: (k: K) => Partial<AvatarConfig>): Opt[] =>
      keys.map((k) => ({ key: `${prefix}:${k}`, label: labels[k], on: cur === k, pick: () => onChange(patch(k)), img: t(key(k)) }));
    switch (tab) {
      case "preset":
        return [
          {
            title: "예시 모습",
            kind: "thumbs",
            opts: PRESETS.map((p) => ({
              key: p.id,
              label: p.name,
              on: (Object.keys(p.look) as Array<keyof typeof p.look>).every((k) => v[k] === p.look[k]),
              pick: () => onChange(p.look),
              img: t(`preset:${p.id}`),
            })),
          },
        ];
      case "face":
        return [
          { title: "피부", kind: "swatches", opts: SKINS.map((k) => ({ key: k, label: SKIN_LABEL[k], on: v.skin === k, pick: () => onChange({ skin: k }), color: AVATAR_COLOR.skin[k] })) },
          { title: "볼", kind: "thumbs", wide: true, opts: opt("cheeks", CHEEKS, CHEEKS_LABEL, v.cheeks, (k) => `cheeks:${k}|${look(v)}`, (cheeks) => ({ cheeks })) },
          { title: "얼굴 스티커", kind: "thumbs", wide: true, opts: opt("sticker", STICKERS, STICKER_LABEL, v.sticker, (k) => `sticker:${k}|${look(v)}`, (sticker) => ({ sticker })) },
        ];
      case "hair": {
        const styles = HAIR_FOR[v.gender] ?? HAIR_STYLES;
        return [
          { title: "머리 모양", kind: "thumbs", opts: opt("hair", styles, HAIR_LABEL, v.hair, (k) => `hair:${k}|${v.hairColor}|${v.skin}|${v.outfit}`, (hair) => ({ hair })) },
          { title: "머리 색", kind: "swatches", opts: HAIR_COLORS.map((k) => ({ key: k, label: HAIR_COLOR_LABEL[k], on: v.hairColor === k, pick: () => onChange({ hairColor: k }), color: AVATAR_COLOR.hair[k] })) },
        ];
      }
      case "eyes":
        return [
          { title: "눈", kind: "thumbs", wide: true, opts: opt("eyes", EYES, EYES_LABEL, v.eyes, (k) => `eyes:${k}|${look(v)}`, (eyes) => ({ eyes })) },
          { title: "눈썹", kind: "thumbs", wide: true, opts: opt("brows", BROWS, BROWS_LABEL, v.brows, (k) => `brows:${k}|${look(v)}`, (brows) => ({ brows })) },
        ];
      case "mouth":
        return [{ title: "입", kind: "thumbs", wide: true, opts: opt("mouth", MOUTHS, MOUTH_LABEL, v.mouth, (k) => `mouth:${k}|${look(v)}`, (mouth) => ({ mouth })) }];
      case "outfit": {
        const rest = JSON.stringify({ ...v, gender: "", glasses: false });
        return [
          { title: "몸", kind: "thumbs", opts: opt("gender", GENDERS, GENDER_LABEL, v.gender, (k) => `gender:${k}|${rest}`, (gender) => ({ gender })) },
          { title: "옷 색", kind: "swatches", opts: OUTFITS.map((k) => ({ key: k, label: OUTFIT_LABEL[k], on: v.outfit === k, pick: () => onChange({ outfit: k }), color: AVATAR_COLOR.outfit[k] })) },
          {
            title: "안경",
            kind: "thumbs",
            opts: [false, true].map((g) => ({
              key: `glasses:${g}`,
              label: g ? "안경" : "안경 없이",
              on: v.glasses === g,
              pick: () => onChange({ glasses: g }),
              img: t(`glasses:${g ? 1 : 0}|${rest}|${v.gender}`),
            })),
          },
        ];
      }
      case "pet":
        return [
          {
            title: "함께 사는 동물 — 졸졸 따라다니고, 읽는 동안엔 옆에서 꾸벅",
            kind: "thumbs",
            opts: PETS.map((p) => ({ key: p, label: PET_LABEL[p], on: v.pet === p, pick: () => onChange({ pet: p }), img: p === "none" ? undefined : `/img/stickers/pet-${p}.webp` })),
          },
        ];
    }
  }, [tab, v, thumbs, onChange]);

  const idx = TABS.findIndex((t) => t.id === tab);
  const move = (d: number) => setTab(TABS[(idx + d + TABS.length) % TABS.length].id);

  return (
    <div className={m.maker}>
      <div className={m.stageCol}>
        <LibraryStage mode="preview" books={NO_BOOKS} avatar={v} name={name} me deco={deco} focus={focus} stand className={m.stageSlot} />
      </div>
      <div className={m.panel}>
        <div className={m.tabs}>
          <button type="button" className={m.arrow} onClick={() => move(-1)} aria-label="앞 탭">
            ‹
          </button>
          <div className={m.tabRow} role="tablist" aria-label="꾸밀 곳">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} aria-label={t.label} title={t.label} className={`${m.tab} ${tab === t.id ? m.tabOn : ""}`} onClick={() => setTab(t.id)}>
                <img src={`/img/icons/maker-${ICON[t.id]}.webp`} alt="" />
              </button>
            ))}
          </div>
          <button type="button" className={m.arrow} onClick={() => move(1)} aria-label="다음 탭">
            ›
          </button>
        </div>
        <p className={m.tabName}>{TABS[idx].label}</p>
        <div
          className={m.scroll}
          role="tabpanel"
          aria-label={TABS[idx].label}
          onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
          onPointerUp={(e) => {
            const s = swipe.current;
            swipe.current = null;
            if (!s) return;
            const dx = e.clientX - s.x;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 2) move(dx < 0 ? 1 : -1); // 좌우로 밀면 옆 탭
          }}
        >
          {FEATURES.photoAvatar && tab === "preset" && <PhotoAvatar value={v} onChange={onChange} onDone={() => setTab("face")} />}
          {groups.map((g) => (
            <section key={g.title}>
              <h4 className={m.groupTitle}>{g.title}</h4>
              {g.kind === "thumbs" ? (
                <div className={`${m.grid} ${g.wide ? m.gridWide : ""}`}>
                  {g.opts.map((o) => (
                    <button key={o.key} type="button" className={`${m.tile} ${o.on ? m.tileOn : ""}`} aria-pressed={o.on} aria-label={o.label} onClick={o.pick}>
                      {o.img ? <img src={o.img} alt="" /> : <span className={m.tileText}>{o.label.slice(0, 4)}</span>}
                      <span className={m.tileLabel}>{o.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className={m.swatches}>
                  {g.opts.map((o) => (
                    <button key={o.key} type="button" className={`${m.swatch} ${o.on ? m.swatchOn : ""}`} style={{ background: o.color }} aria-pressed={o.on} aria-label={o.label} title={o.label} onClick={o.pick} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
        <button type="button" className={m.done} onClick={onDone} disabled={busy}>
          {doneLabel}
        </button>
      </div>
    </div>
  );
}
