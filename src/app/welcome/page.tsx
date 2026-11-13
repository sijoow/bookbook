"use client";

// 처음 가입 — 11-13 사용자: "회원가입을 한 후에 나의 모습 선택하고 >> 내가 살 집 선택하기 >> 이런 식으로"
// ① 가입: 닉네임 + 필수 동의 셋(이용약관·개인정보·만 14세 이상)  ② 나의 모습: 꾸미기 창(추천 예시·얼굴·머리·눈·입·옷·동물 — 11-13 사진으로 만들기는 뺌)
// ③ 내가 살 집: 모눈 방·다락방·창가 원룸·숲속 오두막 (벽·바닥·창·구도가 다르다) → 도서관으로 (+ 가입 축하 포인트)
// 구글로 처음 들어온 사람도 여기를 거친다. 이미 마친 계정이면 도서관으로. 14세 기준은 '확인 대기'(추천안).

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AvatarMaker } from "@/components/AvatarMaker";
import stage from "@/components/library3d/stage.module.css";
import ui from "@/components/ui.module.css";
import type { AvatarConfig } from "@/lib/avatar/config";
import { api } from "@/lib/client/api";
import { hasWebGL } from "@/lib/client/webgl";
import { POINTS, POINT_NAME } from "@/lib/deco/items";
import { DEFAULT_HOUSE, HOUSE, HOUSES, type HouseId } from "@/lib/house/houses";
import type { LibraryBook } from "@/lib/books/types";
import shop from "../(app)/screens.module.css";
import s from "../login/login.module.css";

const LibraryStage = dynamic(() => import("@/components/library3d/LibraryStage"), {
  ssr: false,
  loading: () => <div className={`${stage.slot} ${stage.previewSlot}`} />,
});

type Me = { handle: string; nickname: string; onboarded: boolean; avatar: AvatarConfig; house?: HouseId };
const NO_BOOKS: LibraryBook[] = [];
const STEPS = ["가입", "나의 모습", "내가 살 집"] as const;

export default function Welcome() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [step, setStep] = useState(0);
  const [nick, setNick] = useState("");
  const [avatar, setAvatar] = useState<AvatarConfig | null>(null);
  const [house, setHouse] = useState<HouseId>(DEFAULT_HOUSE);
  const [agree, setAgree] = useState({ terms: false, privacy: false, age14: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [gl] = useState(hasWebGL);

  useEffect(() => {
    let alive = true;
    api<Me>("/api/me")
      .then((m) => {
        if (!alive) return;
        if (m.onboarded) {
          router.replace("/");
          return;
        }
        setMe(m);
        setAvatar(m.avatar);
        setHouse(m.house ?? DEFAULT_HOUSE);
        setNick(m.nickname === "새 친구" ? "" : m.nickname);
      })
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [router]);

  const all = agree.terms && agree.privacy && agree.age14;
  const step1Ok = Boolean(nick.trim()) && all;

  function go(n: number) {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function start() {
    if (!step1Ok || !avatar || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ welcome?: number }>("/api/me", { method: "PATCH", json: { profile: { nickname: nick }, avatar, house, onboard: { terms: true, privacy: true, age14: true } } });
      router.replace(r.welcome ? `/?welcome=${r.welcome}` : "/");
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className={s.wrap}>
      <p className={s.logo}>bookbook</p>
      <h1 className={s.title} style={{ marginTop: 14 }}>
        {step === 0 ? "반가워요!" : step === 1 ? "나의 모습을 골라요" : "어디서 살까요?"}
      </h1>
      <ol className={s.steps} aria-label="가입 단계">
        {STEPS.map((t, i) => (
          <li key={t} className={i === step ? s.stepOn : i < step ? s.stepDone : ""} aria-current={i === step ? "step" : undefined}>
            <b>{i + 1}</b> {t}
          </li>
        ))}
      </ol>
      {err && <p className={ui.error}>{err}</p>}

      {me && avatar && step === 0 && (
        <form
          style={{ width: "100%" }}
          onSubmit={(e) => {
            e.preventDefault();
            if (step1Ok) go(1);
          }}
        >
          <section className={`${ui.paper} ${s.step}`}>
            <span className={ui.paperLabel}>닉네임</span>
            <input className={ui.field} value={nick} maxLength={12} onChange={(e) => setNick(e.target.value)} placeholder="친구들에게 보일 이름 (12자까지)" aria-label="닉네임" autoComplete="nickname" />
          </section>

          <section className={`${ui.paper} ${s.step}`}>
            <span className={ui.paperLabel}>약속</span>
            <label className={s.agree} style={{ fontWeight: 700 }}>
              <input type="checkbox" checked={all} onChange={(e) => setAgree({ terms: e.target.checked, privacy: e.target.checked, age14: e.target.checked })} />
              모두 동의해요
            </label>
            <hr className={ui.dashed} />
            <label className={s.agree}>
              <input type="checkbox" checked={agree.terms} onChange={(e) => setAgree({ ...agree, terms: e.target.checked })} />
              <span className={s.req}>필수</span> 이용약관
              <Link href="/terms#terms" target="_blank">
                보기
              </Link>
            </label>
            <label className={s.agree}>
              <input type="checkbox" checked={agree.privacy} onChange={(e) => setAgree({ ...agree, privacy: e.target.checked })} />
              <span className={s.req}>필수</span> 개인정보 수집·이용
              <Link href="/terms#privacy" target="_blank">
                보기
              </Link>
            </label>
            <label className={s.agree}>
              <input type="checkbox" checked={agree.age14} onChange={(e) => setAgree({ ...agree, age14: e.target.checked })} />
              <span className={s.req}>필수</span> 만 14세 이상이에요
            </label>
          </section>

          <button className={`${ui.btn} ${ui.btnWide}`} style={{ marginTop: 20 }} disabled={!step1Ok}>
            다음 — 나의 모습 ▸
          </button>
        </form>
      )}

      {me && avatar && step === 1 && (
        <div style={{ width: "100%" }}>
          <section className={`${ui.paper} ${s.step}`}>
            <span className={ui.paperLabel}>나의 모습</span>
            <div style={{ height: "min(600px, calc(100dvh - 210px))", minHeight: 420 }}>
              <AvatarMaker value={avatar} name={nick.trim() || "나"} onChange={(p) => setAvatar((a) => (a ? { ...a, ...p } : a))} onDone={() => go(2)} doneLabel="결정 ▸" />
            </div>
            <p className={ui.muted} style={{ marginTop: 10, fontSize: 13 }}>
              예시 모습에서 골라 고쳐 써도 돼요 · 나중에 마이페이지에서 언제든 바꿀 수 있어요
            </p>
          </section>
          <div className={s.stepNav}>
            <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={() => go(0)}>
              ◂ 이전
            </button>
          </div>
        </div>
      )}

      {me && avatar && step === 2 && (
        <div style={{ width: "100%" }}>
          <section className={`${ui.paper} ${s.step}`}>
            <span className={ui.paperLabel}>내가 살 집</span>
            {gl && <LibraryStage mode="home" books={NO_BOOKS} avatar={avatar} name={nick.trim() || "나"} me house={house} title={`${HOUSE[house].label}에서 살래요?`} />}
            <div className={shop.houseGrid} style={{ marginTop: 12 }}>
              {HOUSES.map((h) => (
                <button key={h} type="button" className={`${shop.houseCard} ${house === h ? shop.houseOn : ""}`} onClick={() => setHouse(h)} aria-pressed={house === h}>
                  <b>{HOUSE[h].label}</b>
                  <span>{HOUSE[h].blurb}</span>
                  <small>{HOUSE[h].view}</small>
                </button>
              ))}
            </div>
            <p className={ui.muted} style={{ marginTop: 10, fontSize: 13 }}>
              책을 읽으면 {POINT_NAME}가 쌓여요. {POINT_NAME}로 소품·가구를 사서 집을 꾸며요 · 처음 가입하면 {POINTS.welcome} {POINT_NAME}
            </p>
          </section>
          <div className={s.stepNav}>
            <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={() => go(1)}>
              ◂ 이전
            </button>
            <button type="button" className={ui.btn} onClick={() => void start()} disabled={busy || !step1Ok}>
              {busy ? "들어가는 중…" : "도서관 들어가기 ▸"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
