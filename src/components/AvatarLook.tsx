"use client";
/* eslint-disable @next/next/no-img-element -- 우리 스티커 그림 (작은 webp) */

// 아바타 모습 고르기 — 성별 · 얼굴(눈·눈썹·입·볼·얼굴 스티커) · 머리(모양·색) · 옷·피부(옷 색·피부·안경) · 동물. 처음부터 다 고를 수 있다.
// 11-12 사용자: "남자 여자 있고" · "동반 애견이나 이런 요소도 고를 수 있게"
// 11-12 사용자: "마이페이지에서 얼굴 꾸미기나 이런 거 있게". 선물 소품·방 물건은 꾸미기 화면(/decorate)에서.

import {
  AVATAR_COLOR,
  BROWS,
  BROWS_LABEL,
  CHEEKS,
  CHEEKS_LABEL,
  EYES,
  EYES_LABEL,
  GENDERS,
  GENDER_HAIR,
  GENDER_LABEL,
  HAIR_COLORS,
  HAIR_FOR,
  HAIR_COLOR_LABEL,
  HAIR_LABEL,
  HAIR_STYLES,
  MOUTHS,
  MOUTH_LABEL,
  OUTFITS,
  OUTFIT_LABEL,
  PETS,
  PET_LABEL,
  SKINS,
  SKIN_LABEL,
  STICKERS,
  STICKER_LABEL,
  randomFace,
  type AvatarConfig,
} from "@/lib/avatar/config";
import ui from "./ui.module.css";

export type LookPart = "face" | "hair" | "body" | "pet";
export const LOOK_PARTS: Array<{ id: LookPart; label: string }> = [
  { id: "face", label: "얼굴" },
  { id: "hair", label: "머리" },
  { id: "body", label: "옷·피부" },
  { id: "pet", label: "동물" },
];

/** 색 동그라미 + 이름 */
function Swatch({ color, label, on, onClick }: { color: string; label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`${ui.chip} ${on ? ui.chipOn : ""}`} onClick={onClick} aria-pressed={on}>
      <i aria-hidden style={{ display: "inline-block", width: 14, height: 14, marginRight: 5, borderRadius: 99, background: color, border: "1.5px solid var(--ink)", verticalAlign: -2 }} />
      {label}
    </button>
  );
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={ui.muted} style={{ marginBottom: 6 }}>
        {title}
      </p>
      <div className={ui.chips}>{children}</div>
    </div>
  );
}

/** 글자 칩 여러 개 중 하나 */
function Pick<K extends string>({ keys, labels, value, onPick }: { keys: readonly K[]; labels: Record<K, string>; value: K; onPick: (k: K) => void }) {
  return (
    <>
      {keys.map((k) => (
        <button key={k} type="button" className={`${ui.chip} ${value === k ? ui.chipOn : ""}`} onClick={() => onPick(k)} aria-pressed={value === k}>
          {labels[k]}
        </button>
      ))}
    </>
  );
}

/** 탭 — 얼굴 · 머리 · 옷·피부 */
export function LookTabs({ value, onChange }: { value: LookPart; onChange: (p: LookPart) => void }) {
  return (
    <div role="tablist" aria-label="아바타 꾸미기" style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", margin: "12px 0 14px" }}>
      {LOOK_PARTS.map((p) => (
        <button key={p.id} type="button" role="tab" aria-selected={value === p.id} className={`${ui.chip} ${value === p.id ? ui.chipOn : ""}`} style={{ minWidth: 64 }} onClick={() => onChange(p.id)}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

/** 성별 — 고르면 머리도 그 성별의 처음 머리로 바뀐다 (다른 머리도 다 고를 수 있다) */
export function GenderPick({ value, onChange }: { value: AvatarConfig; onChange: (patch: Partial<AvatarConfig>) => void }) {
  return (
    <div role="radiogroup" aria-label="성별" style={{ display: "flex", gap: 8, justifyContent: "center" }}>
      {GENDERS.map((g) => (
        <button
          key={g}
          type="button"
          role="radio"
          aria-checked={value.gender === g}
          className={`${ui.chip} ${value.gender === g ? ui.chipOn : ""}`}
          style={{ minWidth: 96, fontSize: 15 }}
          onClick={() => value.gender !== g && onChange({ gender: g, hair: GENDER_HAIR[g] })}
        >
          {GENDER_LABEL[g]}
        </button>
      ))}
    </div>
  );
}

export function AvatarLook({ value: av, onChange, part }: { value: AvatarConfig; onChange: (patch: Partial<AvatarConfig>) => void; part?: LookPart }) {
  const show = (p: LookPart) => !part || part === p;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {show("face") && (
        <>
          <Row title="눈">
            <Pick keys={EYES} labels={EYES_LABEL} value={av.eyes} onPick={(eyes) => onChange({ eyes })} />
          </Row>
          <Row title="눈썹">
            <Pick keys={BROWS} labels={BROWS_LABEL} value={av.brows} onPick={(brows) => onChange({ brows })} />
          </Row>
          <Row title="입">
            <Pick keys={MOUTHS} labels={MOUTH_LABEL} value={av.mouth} onPick={(mouth) => onChange({ mouth })} />
          </Row>
          <Row title="볼">
            <Pick keys={CHEEKS} labels={CHEEKS_LABEL} value={av.cheeks} onPick={(cheeks) => onChange({ cheeks })} />
          </Row>
          <Row title="얼굴 스티커">
            <Pick keys={STICKERS} labels={STICKER_LABEL} value={av.sticker} onPick={(sticker) => onChange({ sticker })} />
          </Row>
          <div style={{ textAlign: "center" }}>
            <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={() => onChange(randomFace())}>
              아무거나 골라 줘
            </button>
          </div>
        </>
      )}
      {show("hair") && (
        <>
          <Row title="머리 모양">
            <Pick keys={HAIR_FOR[av.gender] ?? HAIR_STYLES} labels={HAIR_LABEL} value={av.hair} onPick={(hair) => onChange({ hair })} />
          </Row>
          <Row title="머리 색">
            {HAIR_COLORS.map((c) => (
              <Swatch key={c} color={AVATAR_COLOR.hair[c]} label={HAIR_COLOR_LABEL[c]} on={av.hairColor === c} onClick={() => onChange({ hairColor: c })} />
            ))}
          </Row>
        </>
      )}
      {show("pet") && (
        <div>
          <p className={ui.muted} style={{ marginBottom: 8 }}>
            함께 사는 동물 — 졸졸 따라다니고, 읽는 동안엔 옆에서 꾸벅 자요
          </p>
          <div className={ui.stickerGrid} role="radiogroup" aria-label="함께 사는 동물">
            {PETS.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={av.pet === p} className={`${ui.stickerTile} ${av.pet === p ? ui.stickerOn : ""}`} onClick={() => onChange({ pet: p })}>
                {p === "none" ? <span style={{ height: 52, display: "grid", placeItems: "center", fontSize: 22 }}>—</span> : <img src={`/img/stickers/pet-${p}.webp`} alt="" />}
                <span>{PET_LABEL[p]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {show("body") && (
        <>
          <Row title="옷 색">
            {OUTFITS.map((o) => (
              <Swatch key={o} color={AVATAR_COLOR.outfit[o]} label={OUTFIT_LABEL[o]} on={av.outfit === o} onClick={() => onChange({ outfit: o })} />
            ))}
          </Row>
          <Row title="피부 · 안경">
            {SKINS.map((k) => (
              <Swatch key={k} color={AVATAR_COLOR.skin[k]} label={SKIN_LABEL[k]} on={av.skin === k} onClick={() => onChange({ skin: k })} />
            ))}
            <button type="button" className={`${ui.chip} ${av.glasses ? ui.chipOn : ""}`} onClick={() => onChange({ glasses: !av.glasses })} aria-pressed={av.glasses}>
              안경
            </button>
          </Row>
        </>
      )}
    </div>
  );
}
