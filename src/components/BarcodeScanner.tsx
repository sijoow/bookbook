"use client";

// 바코드로 책 찾기 — 책 뒤표지의 바코드(EAN-13, 978·979로 시작 = ISBN)를 읽는다.
//  1) 카메라를 바로 쓸 수 있으면(https 또는 localhost) 실시간으로 비춰서
//  2) 아니면(폰에서 http 로 열었을 때 등) 사진을 찍어 올려서
//  3) 그래도 안 되면 ISBN 숫자를 직접
// 판독기는 기기에 있으면 그걸(안드로이드 크롬), 없으면 zxing-wasm 판독기(public/wasm, 처음 쓸 때만 불러옴)

import { useEffect, useRef, useState } from "react";
import { toIsbn13 } from "@/lib/books/isbn";
import s from "./shelf.module.css";
import ui from "./ui.module.css";

type Detector = { detect: (source: CanvasImageSource | ImageBitmap) => Promise<Array<{ rawValue: string }>> };

let prepared = false;
async function getDetector(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
  if (Native) {
    try {
      if ((await Native.getSupportedFormats()).includes("ean_13")) return new Native({ formats: ["ean_13"] });
    } catch {
      // 기기 판독기가 고장이면 아래 판독기로
    }
  }
  const mod = await import("barcode-detector/ponyfill");
  if (!prepared) {
    mod.prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? "/wasm/zxing_reader.wasm" : prefix + path) },
    });
    prepared = true;
  }
  return new mod.BarcodeDetector({ formats: ["ean_13"] });
}

/** 판독 결과 중 책 ISBN 하나 */
function pickIsbn(codes: Array<{ rawValue: string }>): string | null {
  for (const c of codes) {
    const isbn = toIsbn13(c.rawValue);
    if (isbn) return isbn;
  }
  return null;
}

export function BarcodeScanner({ onFound, onClose }: { onFound: (isbn13: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const done = useRef(false);
  // 카메라를 바로 쓸 수 있는 곳인지 (http 로 연 폰은 안 됨 → 사진으로)
  const [canLive] = useState(() => typeof window !== "undefined" && window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia));
  const [live, setLive] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");

  function found(isbn: string) {
    if (done.current) return;
    done.current = true;
    navigator.vibrate?.(60);
    onFound(isbn);
  }

  useEffect(() => {
    if (!canLive) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        setLive(true);
        const det = await getDetector();
        timer = setInterval(async () => {
          const v = video.current;
          if (!v || v.readyState < 2 || done.current) return;
          try {
            const isbn = pickIsbn(await det.detect(v));
            if (isbn) found(isbn);
          } catch {
            // 한 장 못 읽으면 다음 장
          }
        }, 300);
      } catch {
        setMsg("카메라를 열 수 없어요. 아래 '사진으로 찍기'를 써 주세요.");
      }
    })();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // found·onFound 는 한 번만 쓰이고(done) 바뀌어도 다시 켤 필요가 없다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLive]);

  async function fromPhoto(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const det = await getDetector();
      const bmp = await createImageBitmap(file);
      const isbn = pickIsbn(await det.detect(bmp));
      bmp.close();
      if (isbn) found(isbn);
      else setMsg("책 바코드를 못 찾았어요. 바코드가 크고 또렷하게 나오게 다시 찍어 주세요.");
    } catch {
      setMsg("사진을 읽지 못했어요. 다시 찍어 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${s.overlay} ${s.fade}`} role="dialog" aria-modal="true" aria-label="바코드로 책 찾기">
      <div className={s.scan}>
        <h2 className={s.panelTitle}>바코드로 책 찾기</h2>
        <p className={ui.muted}>책 뒤표지 아래쪽 바코드를 네모 안에 비춰 주세요</p>

        {canLive && (
          <div className={s.scanBox}>
            <video ref={video} className={s.scanVideo} playsInline muted />
            <i className={s.scanGuide} aria-hidden />
            {!live && !msg && <span className={s.scanWait}>카메라 켜는 중…</span>}
          </div>
        )}

        {msg && <p className={ui.error}>{msg}</p>}

        <label className={`${ui.btn} ${canLive ? ui.btnGhost : ""} ${ui.btnWide}`} style={{ marginTop: 16 }}>
          {busy ? "읽는 중…" : "사진으로 찍기"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) fromPhoto(f);
            }}
          />
        </label>

        <form
          className={s.finishRow}
          style={{ marginTop: 18 }}
          onSubmit={(e) => {
            e.preventDefault();
            const isbn = toIsbn13(typed);
            if (isbn) found(isbn);
            else setMsg("ISBN 이 맞지 않아요. 바코드 아래 978·979로 시작하는 13자리 숫자예요.");
          }}
        >
          <input className={ui.field} inputMode="numeric" placeholder="ISBN 직접 넣기 (978…)" value={typed} onChange={(e) => setTyped(e.target.value.replace(/[^\dXx-]/g, ""))} aria-label="ISBN" />
          <button className={ui.btn}>찾기</button>
        </form>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button type="button" className={ui.textBtn} onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
