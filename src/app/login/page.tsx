"use client";

// 로그인 · 회원가입 — 11-13 사용자: "구글로 일단 하지 말고 오늘은 일반 회원으로 해서 넣어 놓자 (구글은 추후에)"
// 아이디 + 비밀번호 (가입하면 바로 로그인 → 처음 가입 3단계 /welcome). 5번 틀리면 15분 잠금, 잊으면 관리자가 임시 비밀번호.
// 구글 로그인 코드(/api/auth/google)는 그대로 있다 — 열 때 여기 버튼을 되살린다. 개발 중엔 시험 계정·새로 가입해 보기.
// 탭 막대 없는 화면 (app 묶음 밖).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sparkle, StarDoodle } from "@/components/Deco";
import ui from "@/components/ui.module.css";
import { LOGIN_ERROR, safeNext } from "@/lib/auth/google";
import { api } from "@/lib/client/api";
import s from "./login.module.css";

type DevAccounts = { accounts: Array<{ handle: string; nickname: string }>; current: string | null };
type Mode = "login" | "join";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [handle, setHandle] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dev, setDev] = useState<DevAccounts | null>(null);
  const [bye, setBye] = useState(false);
  const [next, setNext] = useState("/");
  const [beta, setBeta] = useState(false); // 베타 모드 — 앱은 로그인 없이 열리고, 여기선 관리자(fe) 로그인만 (11-13)

  useEffect(() => {
    let alive = true;
    const q = new URLSearchParams(window.location.search);
    // 주소창 값은 불러온 뒤 콜백에서 상태로 (렌더 중에 window 를 읽지 않게)
    Promise.resolve().then(() => {
      if (!alive) return;
      setBye(q.get("bye") === "1");
      setNext(safeNext(q.get("next")));
      if (q.get("join") === "1") setMode("join");
      const e = q.get("error");
      if (e) setErr(LOGIN_ERROR[e] ?? LOGIN_ERROR.google);
    });
    api<DevAccounts>("/api/dev/login")
      .then((d) => alive && setDev(d))
      .catch(() => {});
    api<{ beta?: boolean }>("/api/auth/providers")
      .then((p) => {
        if (!alive || !p.beta) return;
        setBeta(true);
        setMode("login");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  function switchTo(m: Mode) {
    setMode(m);
    setErr(null);
    setPw("");
    setPw2("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr(null);
    if (mode === "join" && pw !== pw2) {
      setErr("비밀번호 두 칸이 서로 달라요");
      return;
    }
    setBusy(true);
    try {
      if (mode === "join") {
        await api("/api/auth/signup", { json: { handle, password: pw } });
        router.replace("/welcome");
      } else {
        const r = await api<{ onboarded: boolean; admin?: boolean }>("/api/auth/login", { json: { handle, password: pw } });
        router.replace(r.admin ? "/admin" : r.onboarded ? next : "/welcome"); // 관리자(개발자) 계정은 관리자 화면으로
      }
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }

  async function enter(h: string) {
    await api("/api/dev/login", { json: { handle: h } });
    router.replace(next);
  }

  async function fresh() {
    await api("/api/dev/login", { json: { fresh: true } });
    router.replace("/welcome");
  }

  const join = mode === "join";
  return (
    <main className={s.wrap}>
      <p className={s.logo}>bookbook</p>
      <div className={s.hero}>
        <Sparkle size={22} className={s.spark1} />
        <StarDoodle size={16} color="var(--coral)" className={s.spark2} />
        {/* eslint-disable-next-line @next/next/no-img-element -- 우리 행성 스티커 */}
        <img src="/img/planet-home.webp" alt="" width={170} height={170} className={s.planet} />
      </div>
      <h1 className={s.title}>나만의 도서관</h1>
      <p className={s.lead}>
        책을 꺼내 읽으면 포인트가 쌓이고,
        <br />
        내 집을 꾸미고, 친구 도서관에 놀러 가요
      </p>
      {bye && <p className={s.bye}>탈퇴했어요. 그동안 고마웠어요.</p>}

      {beta && (
        <p className={ui.muted} style={{ textAlign: "center", lineHeight: 1.6, marginBottom: 10 }}>
          지금은 베타예요 — 앱은 로그인 없이 바로 열려요.
          <br />
          여기서는 관리자(개발자) 로그인만 해요 ·{" "}
          <Link href="/" className={ui.textBtn}>
            앱으로 ›
          </Link>
        </p>
      )}
      <section className={`${ui.paper} ${s.authBox}`}>
        <div className={s.authTabs} role="tablist" aria-label="로그인 · 회원가입" hidden={beta}>
          <button type="button" role="tab" aria-selected={!join} className={`${s.authTab} ${!join ? s.authTabOn : ""}`} onClick={() => switchTo("login")}>
            로그인
          </button>
          <button type="button" role="tab" aria-selected={join} className={`${s.authTab} ${join ? s.authTabOn : ""}`} onClick={() => switchTo("join")}>
            회원가입
          </button>
        </div>
        <form onSubmit={submit} className={s.authForm}>
          <label className={s.authLabel} htmlFor="handle">
            아이디
          </label>
          <input
            id="handle"
            className={ui.field}
            value={handle}
            onChange={(e) => setHandle(e.target.value.replace(/\s/g, ""))}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={16}
            placeholder={join ? "영어 소문자·숫자·_ 4~16자" : "아이디"}
          />
          {join && <p className={s.authHint}>친구에게 @{handle.trim().toLowerCase() || "아이디"} 로 보여요 (나중에 못 바꿔요)</p>}
          <label className={s.authLabel} htmlFor="pw">
            비밀번호
          </label>
          <div className={s.pwRow}>
            <input
              id="pw"
              className={ui.field}
              type={show ? "text" : "password"}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete={join ? "new-password" : "current-password"}
              maxLength={64}
              placeholder={join ? "8자 이상, 글자와 숫자를 섞어서" : "비밀번호"}
            />
            <button type="button" className={s.pwShow} onClick={() => setShow(!show)} aria-pressed={show}>
              {show ? "숨기기" : "보기"}
            </button>
          </div>
          {join && (
            <>
              <label className={s.authLabel} htmlFor="pw2">
                비밀번호 한 번 더
              </label>
              <input id="pw2" className={ui.field} type={show ? "text" : "password"} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" maxLength={64} />
            </>
          )}
          {err && (
            <p className={ui.error} role="alert">
              {err}
            </p>
          )}
          <button className={`${ui.btn} ${ui.btnWide}`} style={{ marginTop: 12 }} disabled={busy || !handle || !pw || (join && !pw2)}>
            {busy ? "잠깐만요…" : join ? "가입하고 시작하기 ▸" : "로그인 ▸"}
          </button>
          {!join && <p className={s.authHint}>비밀번호를 잊었으면 운영자에게 문의해 주세요 — 임시 비밀번호를 드려요</p>}
        </form>
      </section>

      {dev && (
        <div className={`${ui.paper} ${s.devBox}`}>
          <span className={ui.paperLabel}>개발 중 — 시험 계정</span>
          <p className={ui.muted} style={{ marginBottom: 8 }}>
            이 PC 의 개발 서버에서만 보여요
          </p>
          <div className={ui.chips}>
            {dev.accounts.map((a) => (
              <button key={a.handle} type="button" className={ui.chip} onClick={() => enter(a.handle)}>
                {a.nickname}
              </button>
            ))}
          </div>
          {!beta && (
            <button type="button" className={`${ui.btn} ${ui.btnGhost} ${ui.btnWide}`} style={{ marginTop: 12 }} onClick={fresh}>
              새로 가입해 보기 (시험) ▸
            </button>
          )}
        </div>
      )}

      <p className={s.terms}>
        시작하면 <Link href="/terms">이용약관 · 개인정보 처리방침</Link>에 동의하게 돼요
      </p>
    </main>
  );
}
