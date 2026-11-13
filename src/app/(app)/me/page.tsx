"use client";

// 마이페이지 (회원) — 11-12 사용자: "마이페이지·회원 페이지를 따로" + "거기서 얼굴 꾸미기나 이런 거 있게"
// 프로필(아바타·닉네임·아이디·한 줄 소개) · 아바타 꾸미기(화면 가득 꾸미기 창 — 왼쪽 아바타 크게, 오른쪽 탭·그림 칸·색·결정, 11-13)
// · 도서관 꾸미기·선물 · 나의 독서 · 계정(로그인·알림·약관·로그아웃·탈퇴, 개발 중엔 시험 계정)
// 로그인 = 구글(베타, 11-13) · 개발 중엔 시험 계정. 카카오는 출시 뒤.

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AvatarMaker } from "@/components/AvatarMaker";
import mk from "@/components/maker.module.css";
import { TopBar } from "@/components/Bars";
import { Sparkle, Tape } from "@/components/Deco";
import { ShareLibrary } from "@/components/ShareLibrary";
import stage from "@/components/library3d/stage.module.css";
import ui from "@/components/ui.module.css";
import { EYES_LABEL, GENDER_LABEL, HAIR_LABEL, PET_LABEL, type AvatarConfig } from "@/lib/avatar/config";
import { api } from "@/lib/client/api";
import { makeSaver } from "@/lib/client/saver";
import { hasWebGL } from "@/lib/client/webgl";
import { formatMinutes, minutesPerBook, readingSpeed } from "@/lib/books/reading";
import { STATUS_LABEL, STATUS_ORDER, type LibraryBook, type ReadingSession } from "@/lib/books/types";
import { POINT_NAME, TRACK, type Deco } from "@/lib/deco/items";
import { HOUSE, type HouseId } from "@/lib/house/houses";
import s from "../screens.module.css";

const LibraryStage = dynamic(() => import("@/components/library3d/LibraryStage"), {
  ssr: false,
  loading: () => <div className={`${stage.slot} ${stage.previewSlot}`} />,
});

type DevAccounts = { accounts: Array<{ handle: string; nickname: string }>; current: string | null; beta?: boolean };
type Me = {
  handle: string;
  nickname: string;
  bio: string;
  login: string[];
  avatar: AvatarConfig;
  deco: Deco;
  readCount: number;
  pending: number;
  points: number;
  house: HouseId;
  email: string | null;
  admin?: boolean;
  adminLogin?: boolean; // 베타로 들어온 관리자 — fe 비밀번호로 로그인하면 관리자 화면이 열린다
};
const NO_BOOKS: LibraryBook[] = [];
const LOGIN_LABEL: Record<string, string> = { dev: "시험 계정 (개발용)", password: "아이디 · 비밀번호", kakao: "카카오", google: "구글" };

export default function MyPage() {
  const router = useRouter();
  const [books, setBooks] = useState<LibraryBook[] | null>(null);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [dev, setDev] = useState<DevAccounts | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [making, setMaking] = useState<AvatarConfig | null>(null); // 꾸미기 창 (결정 전까지는 여기서만 바뀐다)
  const [editing, setEditing] = useState(false);
  const [nick, setNick] = useState("");
  const [bio, setBio] = useState("");
  const [leaving, setLeaving] = useState(false); // 탈퇴 확인 중
  const [pwOpen, setPwOpen] = useState(false); // 비밀번호 바꾸기
  const [pwForm, setPwForm] = useState({ current: "", next: "", next2: "" });
  const [busy, setBusy] = useState(false);
  const [gl] = useState(hasWebGL);
  const preview = useRef<HTMLDivElement>(null);
  // 빠르게 여러 번 골라도 마지막 모습이 저장되게 (한 번에 하나씩, 늘 전체 값)
  const [saveAvatar] = useState(() => makeSaver((a: AvatarConfig) => api("/api/me", { method: "PATCH", json: { avatar: a } }), (e) => setErr(e.message)));

  useEffect(() => {
    let alive = true;
    Promise.all([api<{ books: LibraryBook[] }>("/api/library"), api<{ sessions: ReadingSession[] }>("/api/sessions")])
      .then(([l, x]) => {
        if (!alive) return;
        setBooks(l.books);
        setSessions(x.sessions);
      })
      .catch(() => {});
    api<Me>("/api/me")
      .then((m) => alive && setMe(m))
      .catch((e: Error) => alive && setErr(e.message));
    // 개발 중에만 — 시험 계정 바꾸기 (운영에선 404 라 안 보인다)
    api<DevAccounts>("/api/dev/login")
      .then((d) => alive && setDev(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const decoView = useMemo(() => (me ? { worn: me.deco.worn, placed: me.deco.placed } : undefined), [me]);

  // 꾸미기 창이 열려 있는 동안 뒤 화면이 밀리지 않게
  useEffect(() => {
    if (!making) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, [making]);

  function say(t: string) {
    setToast(t);
    setTimeout(() => setToast(null), 2400);
  }

  /** 아바타 한 칸 바꾸기 — 화면 먼저, 저장은 줄 세워서 (마지막 모습이 남는다) */
  function changeLook(patch: Partial<AvatarConfig>) {
    if (!me) return;
    setErr(null);
    const avatar = { ...me.avatar, ...patch };
    setMe({ ...me, avatar });
    saveAvatar(avatar);
  }

  function startEdit() {
    if (!me) return;
    setNick(me.nickname);
    setBio(me.bio);
    setEditing(true);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ nickname: string; bio: string }>("/api/me", { method: "PATCH", json: { profile: { nickname: nick, bio } } });
      setMe({ ...me, nickname: r.nickname, bio: r.bio });
      setEditing(false);
      say("프로필을 바꿨어요");
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function switchTo(handle: string) {
    await api("/api/dev/login", { json: { handle } });
    router.push("/"); // 화면마다 열릴 때 새로 불러오니 바뀐 계정으로 보인다
  }

  async function freshAccount() {
    await api("/api/dev/login", { json: { fresh: true } });
    router.push("/welcome");
  }

  async function logout() {
    setBusy(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      router.replace("/login");
    } finally {
      setBusy(false);
    }
  }

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.next !== pwForm.next2) {
      setErr("새 비밀번호 두 칸이 서로 달라요");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api("/api/me/password", { json: { current: pwForm.current, next: pwForm.next } });
      setPwOpen(false);
      setPwForm({ current: "", next: "", next2: "" });
      say("비밀번호를 바꿨어요");
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    setBusy(true);
    setErr(null);
    try {
      await api("/api/me", { method: "DELETE" });
      router.replace("/login?bye=1");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  const all = books ?? [];
  const total = all.reduce((t, b) => t + b.readMinutes, 0);
  const perBook = minutesPerBook(all);
  const speed = readingSpeed(sessions);

  return (
    <>
      <TopBar title="마이페이지" />
      {err && <p className={ui.error}>{err}</p>}

      {/* 프로필 */}
      <section className={`${ui.paper} ${s.section}`}>
        <Tape color="coral" />
        <span className={ui.paperLabel}>나의 프로필</span>
        {me && gl && !making && (
          <div ref={preview}>
            <LibraryStage mode="preview" books={NO_BOOKS} avatar={me.avatar} name={me.nickname} me deco={decoView} focus="body" onAvatar={() => setMaking(me.avatar)} hint="아바타를 누르면 꾸미기" />
          </div>
        )}
        {me && !gl && <p className={ui.muted}>이 기기에서는 입체 화면을 볼 수 없어요. 고른 모습은 다른 기기에서 보여요.</p>}
        {me && !editing && (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <p className={s.handTitle}>{me.nickname}</p>
            <p className={ui.muted}>@{me.handle}</p>
            <p style={{ fontSize: 14, marginTop: 6, color: me.bio ? "var(--ink)" : "var(--ink-soft)" }}>{me.bio || "한 줄 소개를 적어 보세요"}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 10 }}>
              <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={startEdit}>
                프로필 수정
              </button>
              <ShareLibrary name={me.nickname === "나" ? "내" : me.nickname} onDone={say} />
            </div>
          </div>
        )}
        {me && editing && (
          <form onSubmit={saveProfile} style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <label className={ui.muted} htmlFor="nick">
              닉네임 (12자까지)
            </label>
            <input id="nick" className={ui.field} value={nick} maxLength={12} onChange={(e) => setNick(e.target.value)} autoComplete="nickname" />
            <label className={ui.muted} htmlFor="bio">
              한 줄 소개 (60자까지)
            </label>
            <input id="bio" className={ui.field} value={bio} maxLength={60} onChange={(e) => setBio(e.target.value)} placeholder="예: 잠들기 전 30분 소설" />
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 4 }}>
              <button className={ui.btn} disabled={busy || !nick.trim()}>
                저장
              </button>
              <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={() => setEditing(false)}>
                그만두기
              </button>
            </div>
          </form>
        )}
      </section>

      {/* 아바타 꾸미기 */}
      {me && (
        <section className={`${ui.paper} ${s.section}`}>
          <Tape color="butter" />
          <span className={ui.paperLabel}>아바타 꾸미기</span>
          <p className={ui.muted} style={{ marginBottom: 10, lineHeight: 1.6 }}>
            {GENDER_LABEL[me.avatar.gender]} · {HAIR_LABEL[me.avatar.hair]} · {EYES_LABEL[me.avatar.eyes]} 눈{me.avatar.glasses ? " · 안경" : ""}
            {me.avatar.pet !== "none" ? ` · ${PET_LABEL[me.avatar.pet]}와 함께` : ""}
          </p>
          <button type="button" className={`${ui.btn} ${ui.btnWide}`} onClick={() => setMaking(me.avatar)}>
            나의 모습 꾸미기 ▸
          </button>
          <p className={ui.muted} style={{ marginTop: 8, fontSize: 13 }}>
            예시 모습에서 골라 고쳐 써도 돼요 — 얼굴·머리·눈·입·옷·동물
          </p>
        </section>
      )}

      {/* 꾸미기 창 — 화면 가득 (11-13 사용자: 동물의 숲처럼 왼쪽 얼굴 크게, 오른쪽에서 골라 '결정') */}
      {me && making && (
        <div className={mk.sheet} role="dialog" aria-modal="true" aria-label="나의 모습 꾸미기">
          <div className={mk.sheetHead}>
            <span className={mk.sheetTitle}>나의 모습</span>
            <button type="button" className={mk.sheetClose} onClick={() => setMaking(null)}>
              그만두기
            </button>
          </div>
          <div className={mk.sheetBody}>
            <AvatarMaker
              value={making}
              name={me.nickname}
              deco={decoView}
              onChange={(p) => setMaking((d) => (d ? { ...d, ...p } : d))}
              onDone={() => {
                changeLook(making);
                setMaking(null);
                say("새 모습으로 바꿨어요");
              }}
            />
          </div>
        </div>
      )}

      {/* 포인트 · 꾸미기 상점 · 내 집 */}
      {me && (
        <section className={`${ui.paper} ${s.section}`}>
          <Tape color="mint" />
          <span className={ui.paperLabel}>{POINT_NAME} · 꾸미기</span>
          <p className={s.pointBig} style={{ fontSize: 28 }}>
            <i className={s.coin} aria-hidden /> {me.points.toLocaleString()}
          </p>
          <p style={{ fontSize: 14, marginTop: 4 }}>
            사는 집 {HOUSE[me.house].label} · 가진 물건 {me.deco.owned.length}/{TRACK.length}
            {me.pending > 0 ? ` · 배달 상자 ${me.pending}개` : ""}
          </p>
          <p className={ui.muted}>책을 읽으면 {POINT_NAME}가 쌓이고, 상점에서 소품·가구를 사서 내 집을 꾸며요</p>
          <Link href="/decorate" className={`${ui.btn} ${ui.btnWide}`} style={{ marginTop: 12 }}>
            {me.pending > 0 ? "배달 상자 열고 꾸미기 ▸" : "꾸미기 상점 ▸"}
          </Link>
        </section>
      )}

      {/* 나의 독서 */}
      <section className={`${ui.paper} ${s.section}`}>
        <Tape color="sky" />
        <span className={ui.paperLabel}>나의 독서</span>
        {books && (
          <>
            <p className={s.handTitle}>
              책 {all.length}권 · 다 읽은 책 {all.filter((b) => b.status === "read").length}권
            </p>
            <p className={ui.muted}>
              지금까지 {formatMinutes(total)} 읽었어요{perBook ? ` · 한 권 평균 ${formatMinutes(perBook)}` : ""}
              {speed.measured ? ` · 1분에 ${speed.ppm.toFixed(1)}쪽` : ""}
            </p>
            <hr className={ui.dashed} />
            <div className={ui.chips}>
              {STATUS_ORDER.map((k) => (
                <span key={k} className={ui.chip}>
                  {STATUS_LABEL[k]} {all.filter((b) => b.status === k).length}
                </span>
              ))}
              <span className={ui.chip}>한줄평 {all.filter((b) => b.oneLiner).length}</span>
            </div>
          </>
        )}
      </section>

      {/* 계정 */}
      <section className={`${ui.paper} ${s.section}`}>
        <Tape color="apricot" />
        <span className={ui.paperLabel}>계정</span>
        <div className={s.stack12}>
          <div className={s.settingRow}>
            <span>로그인</span>
            <span className={ui.muted}>
              {me ? me.login.map((p) => LOGIN_LABEL[p] ?? p).join(", ") : "…"}
              {me?.email ? ` · ${me.email}` : ""}
            </span>
          </div>
          {me?.login.includes("password") && (
            <button type="button" className={s.settingRow} onClick={() => setPwOpen(!pwOpen)} aria-expanded={pwOpen} style={{ width: "100%", background: "none", border: 0, font: "inherit", color: "inherit", textAlign: "left" }}>
              <span>비밀번호 바꾸기</span>
              <span className={ui.muted}>{pwOpen ? "닫기" : "›"}</span>
            </button>
          )}
          {pwOpen && (
            <form onSubmit={changePw} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input className={ui.field} type="password" autoComplete="current-password" placeholder="지금 비밀번호 (임시 비밀번호도)" value={pwForm.current} onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })} aria-label="지금 비밀번호" />
              <input className={ui.field} type="password" autoComplete="new-password" placeholder="새 비밀번호 (8자 이상, 글자+숫자)" value={pwForm.next} onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })} aria-label="새 비밀번호" />
              <input className={ui.field} type="password" autoComplete="new-password" placeholder="새 비밀번호 한 번 더" value={pwForm.next2} onChange={(e) => setPwForm({ ...pwForm, next2: e.target.value })} aria-label="새 비밀번호 한 번 더" />
              <button className={ui.btn} disabled={busy || !pwForm.current || !pwForm.next || !pwForm.next2}>
                바꾸기
              </button>
            </form>
          )}
          <div className={s.settingRow}>
            <span>구글 · 카카오 로그인</span>
            <span className={ui.muted}>베타 뒤에 열려요</span>
          </div>
          <div className={s.settingRow}>
            <span>알림 (친구가 놀러 오면)</span>
            <span className={ui.muted}>준비 중</span>
          </div>
          {me?.adminLogin && (
            <Link href="/login?next=/admin" className={s.settingRow}>
              <span>관리자 페이지</span>
              <span className={ui.muted}>fe 비밀번호로 열기 ›</span>
            </Link>
          )}
          {me?.admin && (
            <Link href="/admin" className={s.settingRow}>
              <span>관리자 페이지</span>
              <span className={ui.muted}>회원 · 통계 · 글 · 공지 ›</span>
            </Link>
          )}
          <Link href="/terms" className={s.settingRow}>
            <span>이용약관 · 개인정보 처리방침</span>
            <span className={ui.muted}>›</span>
          </Link>
          <hr className={ui.dashed} />
          <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center" }}>
            <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={logout} disabled={busy}>
              로그아웃
            </button>
            {!leaving && (
              <button type="button" className={ui.textBtn} onClick={() => setLeaving(true)}>
                회원 탈퇴
              </button>
            )}
          </div>
          {leaving && (
            <div className={s.danger} role="alert">
              <p style={{ fontWeight: 700 }}>정말 탈퇴할까요?</p>
              <p style={{ fontSize: 14, marginTop: 4 }}>
                책 {all.length}권, 읽은 기록, 메모, 꾸민 도서관, 책장 친구가 모두 지워지고 되돌릴 수 없어요.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10 }}>
                <button type="button" className={`${ui.btn} ${s.dangerBtn}`} onClick={leave} disabled={busy}>
                  모두 지우고 탈퇴
                </button>
                <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={() => setLeaving(false)}>
                  그만두기
                </button>
              </div>
            </div>
          )}
        </div>
        {dev && (
          <>
            <hr className={ui.dashed} />
            <p className={ui.muted} style={{ marginBottom: 8 }}>
              개발 중 — 시험 계정 바꾸기 (친구 도서관을 혼자 시험해 볼 때)
            </p>
            <div className={ui.chips}>
              {dev.accounts.map((a) => (
                <button key={a.handle} type="button" className={`${ui.chip} ${dev.current === a.handle ? ui.chipOn : ""}`} onClick={() => switchTo(a.handle)}>
                  {a.nickname}
                </button>
              ))}
              {!dev.beta && (
                <button type="button" className={ui.chip} onClick={freshAccount}>
                  + 새로 가입해 보기
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {toast && (
        <div className={s.toast} role="status">
          <Sparkle size={16} /> {toast}
        </div>
      )}
    </>
  );
}
