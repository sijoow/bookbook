"use client";
/* eslint-disable @next/next/no-img-element -- 우리 스티커 그림 (작은 webp) */

// 관리자 — 11-13 사용자: 회원 관리 · 통계 대시보드 · 글 관리 · 운영 상태·공지
// 관리자가 아니면 API 가 404 라 여기서도 '관리자만'. 탭 막대 없는 화면 (app 묶음 밖), 컴퓨터에서도 넓게.
// 메뉴는 왼쪽 옆 막대 (11-13 사용자: "어드민 단은 사이드 쪽에 있는 게 좋아서") — 좁은 화면에선 위로 접힌다. 고른 메뉴는 주소 #(users 등)에 남는다.
// 차트: 한 줄짜리 막대(시리즈 하나 = 범례 없음, 제목이 이름), 막대색 #c9675a(대비·채도 검사 통과), 누르거나 올리면 값, '표로 보기'.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { IconChart, IconCoin, IconMegaphone, IconNote, IconPeople } from "@/components/InkIcons";
import { COST_LOG, ESTIMATES, KRW_PER_USD, MODEL_3D_NOTE, PHOTO_OUT_RULES, costTotals } from "@/lib/admin/costs";
import { api } from "@/lib/client/api";
import { ITEM } from "@/lib/deco/items";
import { HOUSE, type HouseId } from "@/lib/house/houses";
import s from "./admin.module.css";

type Tab = "dash" | "users" | "posts" | "ops" | "costs";
const TABS: Array<{ id: Tab; label: string; sub: string; Icon: typeof IconChart }> = [
  { id: "dash", label: "대시보드", sub: "가입·활동·읽은 시간·많이 꽂힌 책", Icon: IconChart },
  { id: "users", label: "회원", sub: "찾기 · 포인트 · 정지 · 탈퇴 처리", Icon: IconPeople },
  { id: "posts", label: "글", sub: "발도장 한마디 · 한줄평 숨기기", Icon: IconNote },
  { id: "ops", label: "운영 · 공지", sub: "DB · YES24 · 로그인 상태, 공지 띄우기", Icon: IconMegaphone },
  { id: "costs", label: "비용", sub: "그림·목소리에 쓴 돈 · 얼굴로 캐릭터 만들기 예상 비용", Icon: IconCoin },
];
const isTab = (v: string): v is Tab => TABS.some((t) => t.id === v);

type Stats = {
  totals: { users: number; onboarded: number; today: number; week: number; booksTotal: number; readTotal: number; pointsIssued: number; pointsSpent: number };
  days: Array<{ day: string; signups: number; active: number; minutes: number; finished: number }>;
  topBooks: Array<{ title: string; author: string | null; readers: number }>;
  topItems: Array<{ id: string; n: number }>;
};
type UserRow = {
  handle: string;
  nickname: string;
  email: string | null;
  login: string[];
  createdAt: string;
  lastSeenAt: string | null;
  books: number;
  read: number;
  points: number;
  house: HouseId;
  onboarded: boolean;
  suspended: { at: string; reason: string } | null;
};
type Post = { kind: "stamp" | "review"; id: string; text: string; by: string; byHandle: string; where: string; at: string; hidden: boolean };
type Ops = {
  db: { ok: boolean; pingMs: number; name: string };
  yes24: { key: boolean; quota: { limit: number | null; remaining: number | null; at: string } | null };
  google: boolean;
  appUrl: string | null;
  adminConfigured: boolean;
  node: string;
  uptimeMin: number;
  counts: Record<string, number>;
};
type Notice = { id: string; text: string; level: "info" | "event" | "warn"; active: boolean; at: string; by: string };

const LEVEL: Record<Notice["level"], string> = { info: "알림", event: "이벤트", warn: "점검·주의" };
const COUNT_LABEL: Record<string, string> = { users: "회원", userBooks: "꽂힌 책", sessions: "읽은 기록", memos: "메모", friendships: "친구", visits: "놀러 감", stamps: "발도장", pointLog: "포인트 장부", logins: "로그인", apiCache: "YES24 캐시" };

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const md = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;

/** 막대 하나짜리 차트 — 14일. 막대 위에 올리거나 누르면 값 */
function DayBars({ title, unit, days, pick }: { title: string; unit: string; days: Stats["days"]; pick: (d: Stats["days"][number]) => number }) {
  const [on, setOn] = useState<number | null>(null);
  const vals = days.map(pick);
  const max = Math.max(1, ...vals);
  const sum = vals.reduce((t, v) => t + v, 0);
  const W = 280;
  const H = 120;
  const bw = W / vals.length;
  return (
    <section className={s.card}>
      <div className={s.chartHead}>
        <h3>{title}</h3>
        <span>
          14일 합계 <b>{sum.toLocaleString()}</b>
          {unit}
        </span>
      </div>
      <div className={s.chartBox}>
        <svg viewBox={`0 0 ${W} ${H + 18}`} className={s.chart} role="img" aria-label={`${title} 14일`}>
          <line x1="0" x2={W} y1={H} y2={H} className={s.base} />
          <line x1="0" x2={W} y1={H / 2} y2={H / 2} className={s.grid} />
          {vals.map((v, i) => {
            const h = v ? Math.max(3, (v / max) * (H - 16)) : 0;
            const x = i * bw + bw * 0.18;
            const w = bw * 0.64;
            return (
              <g key={days[i].day} onMouseEnter={() => setOn(i)} onMouseLeave={() => setOn(null)} onClick={() => setOn(on === i ? null : i)}>
                <rect x={i * bw} y="0" width={bw} height={H} fill="transparent" />
                {h > 0 && <path d={`M${x},${H} v${-(h - 4)} q0,-4 4,-4 h${w - 8} q4,0 4,4 v${h - 4} z`} className={on === i ? s.barOn : s.bar} />}
                {(i % 3 === 1 || i === vals.length - 1) && (
                  <text x={i * bw + bw / 2} y={H + 13} className={s.tick}>
                    {md(days[i].day)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {on != null && (
          <div className={s.tip} style={{ left: `${((on + 0.5) / vals.length) * 100}%` }}>
            <b>
              {vals[on].toLocaleString()}
              {unit}
            </b>
            <span>{md(days[on].day)}</span>
          </div>
        )}
      </div>
      <details className={s.table}>
        <summary>표로 보기</summary>
        <table>
          <tbody>
            {days.map((d, i) => (
              <tr key={d.day}>
                <td>{d.day}</td>
                <td>
                  {vals[i].toLocaleString()}
                  {unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function Dashboard() {
  const [st, setSt] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api<Stats>("/api/admin/stats")
      .then((r) => alive && setSt(r))
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, []);
  if (err) return <p className={s.err}>{err}</p>;
  if (!st) return <p className={s.muted}>불러오는 중…</p>;
  const t = st.totals;
  const tiles = [
    { n: t.onboarded, label: "가입한 사람", sub: `가입 중 포함 ${t.users}` },
    { n: t.today, label: "오늘 들어온 사람", sub: "한국 날짜" },
    { n: t.week, label: "7일 동안 들어온 사람", sub: "한 번이라도" },
    { n: t.booksTotal, label: "꽂힌 책", sub: `다 읽은 책 ${t.readTotal}` },
    { n: t.pointsIssued, label: "준 포인트", sub: `상점에서 쓴 ${t.pointsSpent.toLocaleString()}` },
  ];
  return (
    <>
      <div className={s.tiles}>
        {tiles.map((x) => (
          <div key={x.label} className={s.tile}>
            <b>{x.n.toLocaleString()}</b>
            <span>{x.label}</span>
            <small>{x.sub}</small>
          </div>
        ))}
      </div>
      <div className={s.grid2}>
        <DayBars title="하루 가입" unit="명" days={st.days} pick={(d) => d.signups} />
        <DayBars title="하루 들어온 사람" unit="명" days={st.days} pick={(d) => d.active} />
        <DayBars title="하루 읽은 시간" unit="분" days={st.days} pick={(d) => d.minutes} />
        <DayBars title="하루 다 읽은 책" unit="권" days={st.days} pick={(d) => d.finished} />
      </div>
      <div className={s.grid2}>
        <section className={s.card}>
          <h3>많이 꽂힌 책</h3>
          <ol className={s.rank}>
            {st.topBooks.map((b, i) => (
              <li key={i}>
                <span>
                  {b.title}
                  {b.author ? <small> · {b.author}</small> : null}
                </span>
                <b>{b.readers}명</b>
              </li>
            ))}
            {!st.topBooks.length && <li className={s.muted}>아직 없어요</li>}
          </ol>
        </section>
        <section className={s.card}>
          <h3>상점에서 많이 산 물건</h3>
          <ol className={s.rank}>
            {st.topItems.map((it) => (
              <li key={it.id}>
                <span className={s.itemRow}>
                  <img src={`/img/stickers/${it.id}.webp`} alt="" width={26} height={26} />
                  {ITEM[it.id]?.label ?? it.id}
                </span>
                <b>{it.n}번</b>
              </li>
            ))}
            {!st.topItems.length && <li className={s.muted}>아직 없어요</li>}
          </ol>
        </section>
      </div>
    </>
  );
}

function Users() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ total: number; per: number; users: UserRow[] } | null>(null);
  const [open, setOpen] = useState<{ handle: string; act: "points" | "suspend" | "delete" } | null>(null);
  const [form, setForm] = useState({ delta: "100", note: "", reason: "", confirm: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback((qq: string, pg: number) => {
    return api<{ total: number; per: number; users: UserRow[] }>(`/api/admin/users?q=${encodeURIComponent(qq)}&page=${pg}`)
      .then((r) => setData(r))
      .catch((e: Error) => setMsg(e.message));
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void load(q, page), 250); // 찾는 말을 칠 때마다 바로 부르지 않게
    return () => clearTimeout(t);
  }, [q, page, load]);

  async function run(handle: string, body: object | null, label: string) {
    setBusy(true);
    setMsg(null);
    try {
      if (body) {
        const r = await api<{ tempPassword?: string }>(`/api/admin/users/${handle}`, { method: "PATCH", json: body });
        if (r.tempPassword) label = `임시 비밀번호: ${r.tempPassword} (한 번만 보여요 — 회원에게 전해 주세요. 마이페이지에서 바꿀 수 있어요)`;
      }
      else await api(`/api/admin/users/${handle}?confirm=${encodeURIComponent(form.confirm)}`, { method: "DELETE" });
      setMsg(`${label} — @${handle}`);
      setOpen(null);
      setForm({ delta: "100", note: "", reason: "", confirm: "" });
      await load(q, page);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={s.toolbar}>
        <input
          className={s.input}
          placeholder="닉네임 · 아이디 · 이메일로 찾기"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          aria-label="회원 찾기"
        />
        {data && <span className={s.muted}>{data.total.toLocaleString()}명</span>}
      </div>
      {msg && <p className={s.note}>{msg}</p>}
      <div className={s.list}>
        {data?.users.map((u) => (
          <article key={u.handle} className={`${s.card} ${s.userCard}`}>
            <div className={s.userHead}>
              <div>
                <b className={s.nick}>{u.nickname}</b> <span className={s.muted}>@{u.handle}</span>
                {u.suspended && <span className={s.badgeWarn}>정지</span>}
                {!u.onboarded && <span className={s.badge}>가입 중</span>}
              </div>
              <span className={s.muted}>{u.login.map((l) => (l === "google" ? "구글" : l === "dev" ? "시험" : l === "password" ? "아이디·비밀번호" : l)).join(", ")}</span>
            </div>
            <div className={s.userMeta}>
              <span>{u.email ?? "이메일 없음"}</span>
              <span>가입 {fmtDate(u.createdAt)}</span>
              <span>마지막 {fmtDate(u.lastSeenAt)}</span>
              <span>
                책 {u.books} · 다 읽음 {u.read}
              </span>
              <span>포인트 {u.points.toLocaleString()}</span>
              <span>{HOUSE[u.house].label}</span>
              {u.suspended && <span className={s.warnText}>정지 이유: {u.suspended.reason}</span>}
            </div>
            <div className={s.actions}>
              <button type="button" className={s.btnGhost} onClick={() => setOpen({ handle: u.handle, act: "points" })}>
                포인트
              </button>
              {u.suspended ? (
                <button type="button" className={s.btnGhost} disabled={busy} onClick={() => void run(u.handle, { suspend: null }, "정지를 풀었어요")}>
                  정지 해제
                </button>
              ) : (
                <button type="button" className={s.btnGhost} onClick={() => setOpen({ handle: u.handle, act: "suspend" })}>
                  정지
                </button>
              )}
              <button type="button" className={s.btnGhost} disabled={busy} onClick={() => void run(u.handle, { resetNickname: true }, "닉네임을 '책 친구'로 바꿨어요")}>
                닉네임 초기화
              </button>
              {u.login.includes("password") && (
                <button type="button" className={s.btnGhost} disabled={busy} onClick={() => void run(u.handle, { resetPassword: true }, "")}>
                  비밀번호 초기화
                </button>
              )}
              <button type="button" className={s.btnDanger} onClick={() => setOpen({ handle: u.handle, act: "delete" })}>
                탈퇴 처리
              </button>
            </div>
            {open?.handle === u.handle && open.act === "points" && (
              <form
                className={s.inline}
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(u.handle, { points: { delta: Number(form.delta), note: form.note } }, `포인트 ${Number(form.delta) > 0 ? "+" : ""}${form.delta}`);
                }}
              >
                <input className={s.input} inputMode="numeric" value={form.delta} onChange={(e) => setForm({ ...form, delta: e.target.value.replace(/[^\d-]/g, "") })} aria-label="포인트 (빼려면 -)" style={{ width: 90 }} />
                <input className={s.input} value={form.note} maxLength={60} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="이유 (회원에게 보여요)" aria-label="이유" />
                <button className={s.btn} disabled={busy || !form.note.trim() || !Number(form.delta)}>
                  주기
                </button>
              </form>
            )}
            {open?.handle === u.handle && open.act === "suspend" && (
              <form
                className={s.inline}
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(u.handle, { suspend: { reason: form.reason } }, "정지했어요 (바로 로그아웃)");
                }}
              >
                <input className={s.input} value={form.reason} maxLength={100} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="정지 이유" aria-label="정지 이유" />
                <button className={s.btnDanger} disabled={busy || !form.reason.trim()}>
                  정지하기
                </button>
              </form>
            )}
            {open?.handle === u.handle && open.act === "delete" && (
              <form
                className={s.inline}
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(u.handle, null, "탈퇴 처리했어요");
                }}
              >
                <span className={s.warnText}>책·기록·친구·포인트까지 모두 지워져요. 되돌릴 수 없어요.</span>
                <input className={s.input} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} placeholder={`확인: ${u.handle} 입력`} aria-label="확인용 아이디" />
                <button className={s.btnDanger} disabled={busy || form.confirm !== u.handle}>
                  모두 지우기
                </button>
              </form>
            )}
          </article>
        ))}
      </div>
      {data && data.total > data.per && (
        <div className={s.pager}>
          <button type="button" className={s.btnGhost} disabled={page === 0} onClick={() => setPage(page - 1)}>
            ◂ 앞
          </button>
          <span className={s.muted}>
            {page + 1} / {Math.ceil(data.total / data.per)}
          </span>
          <button type="button" className={s.btnGhost} disabled={(page + 1) * data.per >= data.total} onClick={() => setPage(page + 1)}>
            뒤 ▸
          </button>
        </div>
      )}
    </>
  );
}

function Posts() {
  const [kind, setKind] = useState<"all" | "stamp" | "review">("all");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api<{ posts: Post[] }>(`/api/admin/posts?kind=${kind}`)
      .then((r) => alive && setPosts(r.posts))
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [kind]);

  async function toggle(p: Post) {
    try {
      await api("/api/admin/posts", { method: "PATCH", json: { kind: p.kind, id: p.id, hide: !p.hidden } });
      setPosts((xs) => xs?.map((x) => (x.id === p.id && x.kind === p.kind ? { ...x, hidden: !p.hidden } : x)) ?? null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <div className={s.toolbar}>
        {(["all", "stamp", "review"] as const).map((k) => (
          <button key={k} type="button" className={`${s.chip} ${kind === k ? s.chipOn : ""}`} onClick={() => setKind(k)} aria-pressed={kind === k}>
            {k === "all" ? "전체" : k === "stamp" ? "발도장 한마디" : "한줄평"}
          </button>
        ))}
        <span className={s.muted}>남에게 보이는 글만 — 메모는 본인만 보는 글이라 여기 없어요</span>
      </div>
      {err && <p className={s.err}>{err}</p>}
      <div className={s.list}>
        {posts?.map((p) => (
          <article key={`${p.kind}-${p.id}`} className={`${s.card} ${p.hidden ? s.hiddenPost : ""}`}>
            <p className={s.postText}>&ldquo;{p.text}&rdquo;</p>
            <div className={s.userMeta}>
              <span>
                {p.by} @{p.byHandle}
              </span>
              <span>{p.where}</span>
              <span>{fmtDate(p.at)}</span>
              {p.hidden && <span className={s.warnText}>숨김</span>}
            </div>
            <div className={s.actions}>
              <button type="button" className={p.hidden ? s.btnGhost : s.btnDanger} onClick={() => void toggle(p)}>
                {p.hidden ? "다시 보이기" : "숨기기"}
              </button>
            </div>
          </article>
        ))}
        {posts && !posts.length && <p className={s.muted}>아직 글이 없어요</p>}
      </div>
    </>
  );
}

function OpsTab() {
  const [ops, setOps] = useState<Ops | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [text, setText] = useState("");
  const [level, setLevel] = useState<Notice["level"]>("info");
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(
    () =>
      Promise.all([api<Ops>("/api/admin/ops"), api<{ notices: Notice[] }>("/api/admin/notices")])
        .then(([o, n]) => {
          setOps(o);
          setNotices(n.notices);
        })
        .catch((e: Error) => setMsg(e.message)),
    [],
  );
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  async function post() {
    try {
      await api("/api/admin/notices", { json: { text, level } });
      setText("");
      setMsg("공지를 띄웠어요 — 홈 위쪽에 보여요");
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  async function act(id: string, how: "on" | "off" | "del") {
    try {
      if (how === "del") await api(`/api/admin/notices/${id}`, { method: "DELETE" });
      else await api(`/api/admin/notices/${id}`, { method: "PATCH", json: { active: how === "on" } });
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  const ok = (b: boolean) => <span className={b ? s.ok : s.bad}>{b ? "정상" : "확인 필요"}</span>;
  const q = ops?.yes24.quota;
  return (
    <>
      {msg && <p className={s.note}>{msg}</p>}
      {ops && (
        <div className={s.tiles}>
          <div className={s.tile}>
            <span>DB</span>
            <b className={s.small}>{ok(ops.db.ok)}</b>
            <small>
              {ops.db.name} · 응답 {ops.db.pingMs}ms
            </small>
          </div>
          <div className={s.tile}>
            <span>YES24</span>
            <b className={s.small}>{ok(ops.yes24.key)}</b>
            <small>{q && q.remaining != null ? `오늘 남은 호출 ${q.remaining.toLocaleString()}${q.limit ? ` / ${q.limit.toLocaleString()}` : ""} (${fmtDate(q.at)})` : ops.yes24.key ? "아직 호출 기록 없음" : "키 없음 — 샘플 모드"}</small>
          </div>
          <div className={s.tile}>
            <span>구글 로그인</span>
            <b className={s.small}>{ok(ops.google)}</b>
            <small>{ops.appUrl ?? "APP_URL 없음 (들어온 주소로)"}</small>
          </div>
          <div className={s.tile}>
            <span>관리자 지정</span>
            <b className={s.small}>{ok(ops.adminConfigured)}</b>
            <small>{ops.adminConfigured ? "ADMIN_EMAILS · ADMIN_HANDLES" : "개발 중 '나' 계정만"}</small>
          </div>
          <div className={s.tile}>
            <span>서버</span>
            <b className={s.small}>{ops.node}</b>
            <small>켜진 지 {ops.uptimeMin.toLocaleString()}분</small>
          </div>
        </div>
      )}
      {ops && (
        <section className={s.card}>
          <h3>쌓인 데이터</h3>
          <div className={s.counts}>
            {Object.entries(ops.counts).map(([k, v]) => (
              <span key={k}>
                {COUNT_LABEL[k] ?? k} <b>{v.toLocaleString()}</b>
              </span>
            ))}
          </div>
        </section>
      )}
      <section className={s.card}>
        <h3>공지 띄우기</h3>
        <p className={s.muted}>한 번에 하나만 — 새로 띄우면 전 공지는 꺼져요. 홈 위쪽에 보이고, 회원이 닫을 수 있어요.</p>
        <textarea className={s.textarea} value={text} maxLength={120} onChange={(e) => setText(e.target.value)} placeholder="예: 11월 20일 새벽 2시~3시 점검이 있어요" aria-label="공지 내용" />
        <div className={s.inline}>
          {(Object.keys(LEVEL) as Notice["level"][]).map((l) => (
            <button key={l} type="button" className={`${s.chip} ${level === l ? s.chipOn : ""}`} onClick={() => setLevel(l)} aria-pressed={level === l}>
              {LEVEL[l]}
            </button>
          ))}
          <span className={s.muted}>{text.length}/120</span>
          <button type="button" className={s.btn} disabled={text.trim().length < 2} onClick={() => void post()}>
            띄우기
          </button>
        </div>
        <div className={s.list} style={{ marginTop: 12 }}>
          {notices.map((n) => (
            <div key={n.id} className={s.noticeRow}>
              <span className={n.active ? s.badgeOn : s.badge}>{n.active ? "켜짐" : "꺼짐"}</span>
              <span className={s.badge}>{LEVEL[n.level]}</span>
              <span className={s.noticeText}>{n.text}</span>
              <small className={s.muted}>{fmtDate(n.at)}</small>
              <button type="button" className={s.btnGhost} onClick={() => void act(n.id, n.active ? "off" : "on")}>
                {n.active ? "끄기" : "켜기"}
              </button>
              <button type="button" className={s.btnDanger} onClick={() => void act(n.id, "del")}>
                지우기
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/** 비용 — 쓴 돈 기록(scripts/gpt-image.mjs·voice.mts 가 저절로 덧붙인다) · 기능별 예상 비용 · 사진이 밖으로 나갈 때 할 일 */
function Costs() {
  const t = costTotals();
  const rows = [...COST_LOG].reverse();
  return (
    <>
      <div className={s.tiles}>
        <div className={s.tile}>
          <b>${t.usd.toFixed(2)}</b>
          <span>그림(GPT)에 쓴 돈</span>
          <small>약 {t.krw.toLocaleString()}원 (1달러 {KRW_PER_USD.toLocaleString()}원)</small>
        </div>
        {Object.entries(t.credits).map(([tool, n]) => (
          <div key={tool} className={s.tile}>
            <b>{n.toLocaleString()}</b>
            <span>{tool} 크레딧</span>
            <small>월 구독 안에서</small>
          </div>
        ))}
        <div className={s.tile}>
          <b>{COST_LOG.length}</b>
          <span>기록</span>
          <small>만들 때마다 한 줄</small>
        </div>
      </div>

      <section className={s.card}>
        <h3>쓴 비용</h3>
        <div className={s.tableWrap}>
          <table className={s.costTable}>
            <thead>
              <tr>
                <th>날짜</th>
                <th>무엇</th>
                <th>도구</th>
                <th>비용</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td data-label="날짜">{r.date.slice(5).replace("-", "/")}</td>
                  <td data-main="">
                    {r.what}
                    {r.note ? <small className={s.muted}> · {r.note}</small> : null}
                  </td>
                  <td data-label="도구">{r.tool}</td>
                  <td data-label="비용" className={s.num}>
                    {r.unit === "usd" ? "$" + r.amount.toFixed(3) : `${r.amount.toLocaleString()} 크레딧`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={s.muted} style={{ marginTop: 8 }}>
          앱이 돌아가는 동안 회원 수만큼 드는 비용은 없어요 — 목소리·아이콘·그림은 미리 만든 파일, YES24 검색은 무료
        </p>
      </section>

      <section className={s.card} style={{ marginTop: 10 }}>
        <h3>내 얼굴로 캐릭터 만들기 — 방법별 예상 비용</h3>
        <div className={s.tableWrap}>
          <table className={s.costTable}>
            <thead>
              <tr>
                <th>방법</th>
                <th>결과</th>
                <th>1번</th>
                <th>1,000명 × 2번</th>
              </tr>
            </thead>
            <tbody>
              {ESTIMATES.map((e) => (
                <tr key={e.name}>
                  <td data-main="">
                    {e.name}
                    {e.photoOut && <span className={s.badgeWarn}>사진이 밖으로</span>}
                    {e.note ? <small className={s.muted}> · {e.note}</small> : null}
                  </td>
                  <td data-label="결과">{e.result}</td>
                  <td data-label="1번" className={s.num}>
                    {e.once}
                  </td>
                  <td data-label="1,000명 × 2번" className={s.num}>
                    {e.thousand}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={s.muted} style={{ marginTop: 8 }}>
          진짜 3D 캐릭터: {MODEL_3D_NOTE}
        </p>
      </section>

      <section className={s.card} style={{ marginTop: 10 }}>
        <h3>사진이 외부 AI 로 나가는 방법(②·③·④)을 열기 전에 꼭 할 것</h3>
        <ol className={s.rank}>
          {PHOTO_OUT_RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </section>
    </>
  );
}

export default function Admin() {
  const [me, setMe] = useState<{ nickname: string; admin?: boolean } | null>(null);
  const [tab, setTab] = useState<Tab>("dash");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api<{ nickname: string; admin?: boolean }>("/api/me")
      .then((m) => {
        if (!alive) return;
        setMe(m);
        const h = window.location.hash.slice(1); // 새로 고쳐도 보던 메뉴 그대로
        if (isTab(h)) setTab(h);
      })
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, []);

  function go(t: Tab) {
    setTab(t);
    window.history.replaceState(null, "", `#${t}`);
  }
  const cur = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <div className={s.shell}>
      <aside className={s.side}>
        <Link href="/" className={s.logo}>
          bookbook <small>관리자</small>
        </Link>
        {me?.admin && (
          <nav className={s.sideNav} aria-label="관리자 메뉴">
            {TABS.map((t) => (
              <button key={t.id} type="button" className={`${s.sideItem} ${tab === t.id ? s.sideOn : ""}`} onClick={() => go(t.id)} aria-current={tab === t.id ? "page" : undefined}>
                <t.Icon size={22} />
                {t.label}
              </button>
            ))}
          </nav>
        )}
        <div className={s.sideFoot}>
          {me && <span className={s.muted}>{me.nickname} 로그인</span>}
          <Link href="/" className={s.muted}>
            앱으로 돌아가기 ›
          </Link>
        </div>
      </aside>
      <main className={s.content}>
        {me?.admin && (
          <div className={s.pageHead}>
            <h1>{cur.label}</h1>
            <p className={s.muted}>{cur.sub}</p>
          </div>
        )}
      {err && <p className={s.err}>{err}</p>}
      {me && !me.admin && (
        <section className={s.card}>
          <h3>관리자만 볼 수 있어요</h3>
          <p className={s.muted}>관리자 계정으로 로그인해 주세요.</p>
          <Link href="/" className={s.btn}>
            도서관으로
          </Link>
        </section>
      )}
      {me?.admin && tab === "dash" && <Dashboard />}
      {me?.admin && tab === "users" && <Users />}
      {me?.admin && tab === "posts" && <Posts />}
      {me?.admin && tab === "ops" && <OpsTab />}
      {me?.admin && tab === "costs" && <Costs />}
      </main>
    </div>
  );
}
