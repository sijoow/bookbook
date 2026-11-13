"use client";
/* eslint-disable @next/next/no-img-element -- 우리 스티커 그림 (작은 webp) */

// 내 사진으로 아바타 — 11-13 사용자와 정함: "폰 안에서만 처리"
//   AI·서버로 보내지 않는다 · 사진은 저장하지 않고 닫으면 지운다 · 성별은 사진으로 짐작하지 않는다(고른 그대로)
// 사진 고르기(카메라·앨범) → 얼굴(이마~턱)을 동그라미에 맞추기(끌기·두 손가락 벌리기·막대·마우스 휠)
// → '이걸로 만들기' = 160px 작은 그림으로 색만 읽어 피부·머리 색·길이를 고른다 (lib/avatar/fromPhoto)
// 눈·눈썹·입·안경은 사진으로 고르지 않는다 — 아래 고르기에서 사람이.

import { useCallback, useEffect, useRef, useState } from "react";
import { HAIR_COLOR_LABEL, HAIR_LABEL, SKIN_LABEL, type AvatarConfig } from "@/lib/avatar/config";
import { GUIDE, clampView, fitView, photoPatch, photoSummary, readPhoto, zoomAt, type PhotoView } from "@/lib/avatar/fromPhoto";
import p from "./photo.module.css";
import s from "./shelf.module.css";
import ui from "./ui.module.css";

const FRAME = 280; // 틀 한 변 (계산 단위 — 화면에선 폭에 맞게 줄어든다)
const READ = 160; // 읽는 그림 한 변
const MAX_SIDE = 1400; // 큰 사진은 줄여서 쓴다 (폰 메모리)

type Photo = { src: HTMLCanvasElement | ImageBitmap; w: number; h: number };
type Pt = { x: number; y: number };

/** 사진 파일 → 그릴 수 있는 그림 (사진 방향은 브라우저가 맞춰 준다) */
async function loadPhoto(file: File): Promise<Photo> {
  let src: CanvasImageSource;
  let w: number;
  let h: number;
  let bmp: ImageBitmap | null = null;
  try {
    bmp = await createImageBitmap(file);
    src = bmp;
    w = bmp.width;
    h = bmp.height;
  } catch {
    // createImageBitmap 이 못 여는 사진(일부 HEIC 등) — img 로 한 번 더
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      src = img;
      w = img.naturalWidth;
      h = img.naturalHeight;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  if (!w || !h) throw new Error("빈 사진");
  if (bmp && Math.max(w, h) <= MAX_SIDE) return { src: bmp, w, h };
  const k = Math.min(1, MAX_SIDE / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext("2d")?.drawImage(src, 0, 0, c.width, c.height);
  bmp?.close();
  return { src: c, w: c.width, h: c.height };
}

/** 화면 좌표 → 틀 계산 단위 (틀은 화면 폭에 맞게 줄어들 수 있다) */
function toFrame(el: HTMLElement | null, cx: number, cy: number): Pt {
  const r = el?.getBoundingClientRect();
  if (!r || !r.width) return { x: FRAME / 2, y: FRAME / 2 };
  return { x: ((cx - r.left) * FRAME) / r.width, y: ((cy - r.top) * FRAME) / r.height };
}

/** 사진을 메모리에서 지운다 */
function release(ph: Photo | null) {
  if (!ph) return;
  if (typeof ImageBitmap !== "undefined" && ph.src instanceof ImageBitmap) ph.src.close();
  else if (ph.src instanceof HTMLCanvasElement) {
    ph.src.width = 0;
    ph.src.height = 0;
  }
}

export function PhotoAvatar({ value, onChange, onDone }: { value: AvatarConfig; onChange: (patch: Partial<AvatarConfig>) => void; onDone?: (summary: string) => void }) {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [view, setView] = useState<PhotoView | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [doubt, setDoubt] = useState(false); // 얼굴이 동그라미에 안 맞은 것 같아 한 번 물었다
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const okBtn = useRef<HTMLButtonElement>(null);
  const ptrs = useRef(new Map<number, Pt>());

  async function pick(file: File) {
    setErr(null);
    setMsg(null);
    setDoubt(false);
    setBusy(true);
    try {
      const ph = await loadPhoto(file);
      release(photo);
      setPhoto(ph);
      setView(fitView(ph.w, ph.h, FRAME));
    } catch {
      setErr("이 사진은 열 수 없어요. 다른 사진으로 해 볼까요?");
    } finally {
      setBusy(false);
    }
  }

  const close = useCallback(() => {
    release(photo);
    setPhoto(null);
    setView(null);
    setDoubt(false);
    ptrs.current.clear();
  }, [photo]);

  // 틀에 그리기
  useEffect(() => {
    const c = canvas.current;
    if (!c || !photo || !view) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = Math.round(FRAME * dpr);
    if (c.width !== size) {
      c.width = size;
      c.height = size;
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#2b2420";
    ctx.fillRect(0, 0, FRAME, FRAME);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(photo.src, view.x, view.y, photo.w * view.scale, photo.h * view.scale);
  }, [photo, view]);

  // 열리면 '이걸로 만들기'에 초점, Esc 로 닫기, 마우스 휠로 크게·작게 (화면은 안 내려가게)
  useEffect(() => {
    if (!photo) return;
    okBtn.current?.focus();
    const el = frame.current;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setDoubt(false);
      const at = toFrame(el, e.clientX, e.clientY);
      setView((v) => v && zoomAt(v, e.deltaY < 0 ? 1.1 : 1 / 1.1, at.x, at.y, photo.w, photo.h, FRAME));
    };
    window.addEventListener("keydown", onKey);
    el?.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      el?.removeEventListener("wheel", onWheel);
    };
  }, [photo, close]);

  const local = (x: number, y: number) => toFrame(frame.current, x, y);

  function down(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, local(e.clientX, e.clientY));
  }
  function move(e: React.PointerEvent<HTMLDivElement>) {
    const m = ptrs.current;
    const old = m.get(e.pointerId);
    if (!old || !photo) return;
    const before = [...m.values()];
    const now = local(e.clientX, e.clientY);
    m.set(e.pointerId, now);
    const after = [...m.values()];
    const { w, h } = photo;
    setDoubt(false);
    if (after.length === 1) {
      setView((v) => v && clampView({ ...v, x: v.x + now.x - old.x, y: v.y + now.y - old.y }, w, h, FRAME));
      return;
    }
    // 두 손가락 — 벌리면 크게, 같이 움직이면 옮기기
    const [a0, b0] = before;
    const [a1, b1] = after;
    const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y);
    const d1 = Math.hypot(a1.x - b1.x, a1.y - b1.y);
    const c0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
    const c1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
    setView((v) => {
      if (!v) return v;
      const moved = clampView({ ...v, x: v.x + c1.x - c0.x, y: v.y + c1.y - c0.y }, w, h, FRAME);
      return d0 > 4 ? zoomAt(moved, d1 / d0, c1.x, c1.y, w, h, FRAME) : moved;
    });
  }
  function up(e: React.PointerEvent<HTMLDivElement>) {
    ptrs.current.delete(e.pointerId);
  }

  /** 동그라미 안을 읽어 아바타에 입힌다 — 작은 그림은 읽고 바로 지운다 */
  function apply() {
    if (!photo || !view) return;
    const k = READ / FRAME;
    const c = document.createElement("canvas");
    c.width = READ;
    c.height = READ;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      setErr("이 기기에서는 사진을 읽지 못했어요");
      return;
    }
    ctx.drawImage(photo.src, view.x * k, view.y * k, photo.w * view.scale * k, photo.h * view.scale * k);
    const read = readPhoto(ctx.getImageData(0, 0, READ, READ));
    c.width = 0;
    c.height = 0;
    if (!read.face && !doubt) {
      setDoubt(true); // 볼 자리가 피부 같지 않다 — 맞춰 보라고 한 번 묻는다 (빛이 이상한 사진일 수도 있어 '그래도'를 둔다)
      return;
    }
    const patch = photoPatch(read, value);
    onChange(patch);
    const summary = photoSummary(read, patch, { skin: SKIN_LABEL, hairColor: HAIR_COLOR_LABEL, hair: HAIR_LABEL });
    setMsg(read.sure ? `사진으로 바꿨어요 — ${summary}. 눈·입·안경은 아래에서 골라요` : `${summary}로 바꿨어요. 머리는 사진에서 잘 안 보여 그대로 뒀어요`);
    close();
    onDone?.(summary);
  }

  const min = photo ? Math.max(FRAME / photo.w, FRAME / photo.h) : 1;
  const zoom = photo && view ? view.scale / min : 1;
  const { cx, cy, rx, ry } = GUIDE;

  return (
    <>
      <div className={p.start}>
        <label className={`${ui.btn} ${ui.btnGhost} ${p.startBtn}`} aria-disabled={busy}>
          <img src="/img/stickers/frame.webp" alt="" aria-hidden />
          {busy ? "사진 여는 중…" : "내 사진으로 만들기"}
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = ""; // 같은 사진을 다시 골라도 열리게 + 파일 손잡이를 남기지 않게
              if (f) void pick(f);
            }}
          />
        </label>
      </div>
      {!msg && !err && <p className={p.startNote}>사진은 이 기기 안에서만 쓰고 바로 지워요 · 어디에도 보내지 않아요</p>}
      {err && (
        <p className={ui.error} style={{ textAlign: "center", marginTop: -4 }}>
          {err}
        </p>
      )}
      {msg && (
        <p className={p.status} role="status">
          {msg}
        </p>
      )}

      {photo && view && (
        <div className={`${s.overlay} ${s.fade}`} role="dialog" aria-modal="true" aria-label="내 사진으로 아바타 만들기">
          <div className={s.scan}>
            <h2 className={s.panelTitle}>얼굴을 동그라미에 맞춰요</h2>
            <p className={ui.muted}>이마부터 턱까지 들어오게 — 끌어서 옮기고, 두 손가락으로 벌려 크게</p>

            <div className={p.frame} ref={frame} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} data-photo-frame>
              <canvas ref={canvas} className={p.canvas} aria-label="고른 사진" role="img" />
              <svg className={p.guide} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                <path
                  d={`M0 0H100V100H0Z M${cx * 100 - rx * 100} ${cy * 100}a${rx * 100} ${ry * 100} 0 1 0 ${rx * 200} 0a${rx * 100} ${ry * 100} 0 1 0 ${-rx * 200} 0Z`}
                  fill="rgba(43,36,32,0.42)"
                  fillRule="evenodd"
                />
                <ellipse cx={cx * 100} cy={cy * 100} rx={rx * 100} ry={ry * 100} fill="none" stroke="#5a4535" strokeWidth={3.2} vectorEffect="non-scaling-stroke" />
                <ellipse cx={cx * 100} cy={cy * 100} rx={rx * 100} ry={ry * 100} fill="none" stroke="#fff" strokeWidth={2} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
              </svg>
              <span className={p.mark} style={{ top: `${(cy - ry) * 100}%` }}>
                이마
              </span>
              <span className={p.mark} style={{ top: `${(cy + ry) * 100}%` }}>
                턱
              </span>
            </div>

            <label className={p.zoom}>
              작게
              <input
                type="range"
                min={1}
                max={4}
                step={0.01}
                value={zoom}
                aria-label="사진 크기"
                onChange={(e) => {
                  setDoubt(false);
                  const target = Number(e.target.value) * min;
                  setView((v) => v && zoomAt(v, target / v.scale, FRAME / 2, FRAME / 2, photo.w, photo.h, FRAME));
                }}
              />
              크게
            </label>

            {doubt && (
              <p className={ui.error} role="alert" style={{ marginTop: 12 }}>
                얼굴이 동그라미에 안 맞은 것 같아요. 이마는 위 &apos;이마&apos;에, 턱은 아래 &apos;턱&apos;에 오게 맞춰 주세요
              </p>
            )}
            <div className={p.actions}>
              <button ref={okBtn} type="button" className={ui.btn} onClick={apply}>
                {doubt ? "그래도 이걸로 만들기" : "이걸로 만들기"}
              </button>
              <label className={`${ui.btn} ${ui.btnGhost}`} style={{ cursor: "pointer" }}>
                다른 사진
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void pick(f);
                  }}
                />
              </label>
            </div>
            <p className={p.note}>
              피부색·머리 색·머리 길이만 사진에서 골라요. 눈·입·안경은 직접 골라 주세요.
              <br />
              사진은 이 기기 안에서만 읽고, 닫으면 바로 지워요. 서버나 AI 로 보내지 않아요.
            </p>
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <button type="button" className={ui.textBtn} onClick={close}>
                그만두기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
