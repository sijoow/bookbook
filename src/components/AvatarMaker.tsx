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
  EYE_COLORS,
  EYE_COLOR_LABEL,
  BOTTOMS,
  BOTTOM_LABEL,
  GENDERS,
  GENDER_LABEL,
  GENDER_TOP,
  HAIR_COLORS,
  HAIR_COLOR_LABEL,
  HAIR_FOR,
  HAIR_LABEL,
  HAIR_STYLES,
  MOUTHS,
  MOUTH_LABEL,
  NOSES,
  NOSE_LABEL,
  OUTFITS,
  OUTFIT_LABEL,
  PATTERNS,
  PATTERN_LABEL,
  PETS,
  PET_LABEL,
  PRESETS,
  SHOES,
  SHOES_LABEL,
  SKINS,
  SKIN_LABEL,
  STICKERS,
  STICKER_LABEL,
  TOPS,
  TOP_LABEL,
  type AvatarConfig,
} from "@/lib/avatar/config";
import type { LibraryBook } from "@/lib/books/types";
import { CLOTHES } from "@/lib/deco/items";
import { FEATURES } from "@/lib/features";
import type { DecoView, StageFocus } from "./library3d/world";
import m from "./maker.module.css";

const LibraryStage = dynamic(() => import("./library3d/LibraryStage"), { ssr: false });
// 내 사진으로 만들기 — 11-13 숨김 (FEATURES.photoAvatar). 켜야만 불러온다
const PhotoAvatar = dynamic(() => import("./PhotoAvatar").then((x) => x.PhotoAvatar), { ssr: false });
const NO_BOOKS: LibraryBook[] = [];

export type MakerTab = "preset" | "face" | "hair" | "eyes" | "mouth" | "outfit" | "pet";
const TABS: Array<{ id: MakerTab; label: string; focus: StageFocus }> = [
  { id: "preset", label: "추천", focus: "body" },
  { id: "face", label: "얼굴", focus: "face" },
  { id: "hair", label: "머리", focus: "hair" },
  { id: "eyes", label: "눈", focus: "eyes" },
  { id: "mouth", label: "코·입", focus: "mouth" },
  { id: "outfit", label: "옷", focus: "body" },
  { id: "pet", label: "동물", focus: "pet" },
];
const ICON: Record<MakerTab, string> = { preset: "preset", face: "face", hair: "hair", eyes: "eyes", mouth: "mouth", outfit: "outfit", pet: "pet" };

type Opt = { key: string; label: string; on: boolean; pick: () => void; img?: string; color?: string };
type Group = { title: string; kind: "thumbs" | "swatches"; wide?: boolean; named?: boolean; cover?: boolean; opts: Opt[] }; // named = 그림 아래 이름 (예시 모습만 — 나머지는 그림으로만 고른다)

/** 옷 탭 그림 칸 열쇠 — 그 칸이 바꾸는 값만 빼고 나머지가 같으면 같은 그림 */
const outfitKeys = (v: AvatarConfig) => {
  const j = (o: Partial<AvatarConfig>) => JSON.stringify({ ...v, ...o });
  return {
    top: j({ top: "dress" }),
    bottom: j({ bottom: "shorts", top: v.top === "dress" ? "tee" : v.top }),
    shoes: j({ shoes: "flats" }),
    gender: j({ gender: "girl", top: "dress" }),
    glasses: j({ glasses: false }),
  };
};

/** 얼굴 그림 칸 열쇠 (같은 얼굴이면 다시 그리지 않는다) */
const look = (v: AvatarConfig) => `${v.skin}|${v.eyes}|${v.brows}|${v.mouth}|${v.cheeks}|${v.sticker}|${v.eyeColor}|${v.nose}`;

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
  // 옷 탭에선 상점 옷(한 벌)을 잠깐 벗겨 기본 옷이 보이게
  const shopWear = CLOTHES.find((c) => deco?.worn.includes(c.id)) ?? null;
  const stageDeco = useMemo(() => (tab === "outfit" && deco && shopWear ? { ...deco, worn: deco.worn.filter((id) => id !== shopWear.id) } : deco), [tab, deco, shopWear]);

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
        const base = { eyes: v.eyes, brows: v.brows, mouth: v.mouth, cheeks: v.cheeks, sticker: v.sticker, eyeColor: v.eyeColor, nose: v.nose };
        const pairs: Array<[string, string]> = [];
        if (tab === "eyes") {
          for (const e of EYES) pairs.push([`eyes:${e}|${look(v)}`, faceThumb({ ...base, eyes: e, brows: "none" }, "eyes", skin)]);
          for (const b of BROWS) pairs.push([`brows:${b}|${look(v)}`, faceThumb({ ...base, brows: b }, "brows", skin)]);
        } else if (tab === "mouth") {
          for (const no of NOSES) pairs.push([`nose:${no}|${look(v)}`, faceThumb({ ...base, nose: no }, "nose", skin)]);
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
        const k = outfitKeys(v);
        // 윗옷 먼저 (가장 많이 고른다) → 아랫옷 · 신발 → 몸 · 안경
        const tops = await avatarThumbs(TOPS.map((t) => ({ ...v, top: t })), "torso");
        add(TOPS.map((t, i): [string, string] => [`top:${t}|${k.top}`, tops[i]]));
        const bottoms = await avatarThumbs(BOTTOMS.map((b) => ({ ...v, top: v.top === "dress" ? "tee" : v.top, bottom: b })), "legs");
        add(BOTTOMS.map((b, i): [string, string] => [`bottom:${b}|${k.bottom}`, bottoms[i]]));
        const shoes = await avatarThumbs(SHOES.map((sh) => ({ ...v, shoes: sh })), "feet");
        add(SHOES.map((sh, i): [string, string] => [`shoes:${sh}|${k.shoes}`, shoes[i]]));
        const bodies = await avatarThumbs(GENDERS.map((g) => ({ ...v, gender: g, top: GENDER_TOP[g] })), "bust");
        const glasses = await avatarThumbs([false, true].map((g) => ({ ...v, glasses: g })), "head");
        add([
          ...GENDERS.map((g, i): [string, string] => [`gender:${g}|${k.gender}`, bodies[i]]),
          [`glasses:0|${k.glasses}`, glasses[0]],
          [`glasses:1|${k.glasses}`, glasses[1]],
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
            named: true,
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
          // 모자는 상점 머리 소품으로 옮김 (11-13 사용자: "모자는 악세사리처럼")
        ];
      }
      case "eyes":
        return [
          { title: "눈", kind: "thumbs", wide: true, opts: opt("eyes", EYES, EYES_LABEL, v.eyes, (k) => `eyes:${k}|${look(v)}`, (eyes) => ({ eyes })) },
          { title: "눈동자 색", kind: "swatches", opts: EYE_COLORS.map((k) => ({ key: k, label: EYE_COLOR_LABEL[k], on: v.eyeColor === k, pick: () => onChange({ eyeColor: k }), color: AVATAR_COLOR.eye[k] })) },
          { title: "눈썹", kind: "thumbs", wide: true, opts: opt("brows", BROWS, BROWS_LABEL, v.brows, (k) => `brows:${k}|${look(v)}`, (brows) => ({ brows })) },
        ];
      case "mouth":
        return [
          { title: "코", kind: "thumbs", opts: opt("nose", NOSES, NOSE_LABEL, v.nose, (k) => `nose:${k}|${look(v)}`, (nose) => ({ nose })) },
          { title: "입", kind: "thumbs", wide: true, opts: opt("mouth", MOUTHS, MOUTH_LABEL, v.mouth, (k) => `mouth:${k}|${look(v)}`, (mouth) => ({ mouth })) },
        ];
      case "outfit": {
        const k = outfitKeys(v);
        return [
          { title: "윗옷", kind: "thumbs", opts: opt("top", TOPS, TOP_LABEL, v.top, (x) => `top:${x}|${k.top}`, (top) => ({ top })) },
          { title: v.pattern === "none" || !FEATURES.patterns ? "윗옷 색" : "윗옷 색 (무늬를 고르면 무늬 색 그대로)", kind: "swatches", opts: OUTFITS.map((x) => ({ key: x, label: OUTFIT_LABEL[x], on: v.outfit === x, pick: () => onChange({ outfit: x, pattern: "none" }), color: AVATAR_COLOR.outfit[x] })) },
          // 무늬 칸은 숨김 (FEATURES.patterns — 11-13 사용자: "무늬가 아니라 일반적인 옷")
          ...(FEATURES.patterns ? [{
            title: "무늬",
            kind: "thumbs" as const,
            cover: true,
            opts: PATTERNS.map((p) => ({
              key: `pattern:${p}`,
              label: PATTERN_LABEL[p],
              on: v.pattern === p,
              pick: () => onChange({ pattern: p }),
              // 무늬 없음 = 지금 옷 색 한 장 (그림만으로 고르게)
              img: p === "none" ? `data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2764%27 height=%2764%27><rect width=%2764%27 height=%2764%27 rx=%2710%27 fill=%27${encodeURIComponent(AVATAR_COLOR.outfit[v.outfit])}%27/></svg>` : `/img/patterns/${p}.webp`,
            })),
          }] : []),
          { title: v.top === "dress" ? "아랫옷 (원피스엔 가려져요)" : "아랫옷", kind: "thumbs", opts: opt("bottom", BOTTOMS, BOTTOM_LABEL, v.bottom, (x) => `bottom:${x}|${k.bottom}`, (bottom) => ({ bottom, ...(v.top === "dress" ? { top: "tee" as const } : {}) })) },
          { title: "신발", kind: "thumbs", opts: opt("shoes", SHOES, SHOES_LABEL, v.shoes, (x) => `shoes:${x}|${k.shoes}`, (shoes) => ({ shoes })) },
          { title: "몸 · 목소리", kind: "thumbs", opts: opt("gender", GENDERS, GENDER_LABEL, v.gender, (x) => `gender:${x}|${k.gender}`, (gender) => ({ gender, top: GENDER_TOP[gender] })) },
          {
            title: "안경",
            kind: "thumbs",
            opts: [false, true].map((g) => ({
              key: `glasses:${g}`,
              label: g ? "안경" : "안경 없이",
              on: v.glasses === g,
              pick: () => onChange({ glasses: g }),
              img: t(`glasses:${g ? 1 : 0}|${k.glasses}`),
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
        <LibraryStage mode="preview" books={NO_BOOKS} avatar={v} name={name} me deco={stageDeco} focus={focus} stand className={m.stageSlot} />
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
          {tab === "outfit" && shopWear && <p className={m.groupTitle}>상점 옷 &lsquo;{shopWear.label}&rsquo;을(를) 입고 있어요 — 여기선 벗고 기본 옷을 보여 줘요</p>}
          {FEATURES.photoAvatar && tab === "preset" && <PhotoAvatar value={v} onChange={onChange} onDone={() => setTab("face")} />}
          {groups.map((g) => (
            <section key={g.title}>
              <h4 className={m.groupTitle}>{g.title}</h4>
              {g.kind === "thumbs" ? (
                <div className={`${m.grid} ${g.wide ? m.gridWide : ""} ${g.cover ? m.gridCover : ""}`}>
                  {g.opts.map((o) => (
                    <button key={o.key} type="button" className={`${m.tile} ${o.on ? m.tileOn : ""}`} aria-pressed={o.on} aria-label={o.label} onClick={o.pick}>
                      {o.img ? <img src={o.img} alt="" /> : <span className={m.tileText}>{o.label.slice(0, 4)}</span>}
                      {g.named && <span className={m.tileLabel}>{o.label}</span>}
                    </button>
                  ))}
                </div>
              ) : (
                <div className={`${m.swatches} ${g.opts.length >= 12 ? m.swatchesMany : ""}`}>
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
