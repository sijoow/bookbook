// 베타 계정(fe) 채우기 — 11-13 사용자: "fe 계정은 베타니깐 멀티버스 친구들까지도 이미 다 연결되어서, 내가 여기서 쓸 수 있는 것들이 다 들어가 있어야"
// + "최대한 이쁘게, 아기자기하게". 실제 API 로 넣는다 (화면과 같은 규칙: 포인트·배달 상자·통로).
//
// 서버가 베타 모드(BETA_USER=fe)여야 한다 — 쿠키 없이 부르면 fe. 친구(지민·현우·엄마)는 개발 서버의 시험 계정 쿠키로 (개발 모드에서만).
//   1) 친구 셋이 먼저:  node scripts/seed-dev.mjs --only=jimin,hyunwoo,mom   (이미 책이 있으면 건너뜀)
//   2) node scripts/seed-beta.mjs                                          (여러 번 돌려도 된다 — 있는 건 건너뛰고 모자란 것만)
//   배포 DB(bookbook)에 넣을 땐 이 PC 의 개발 서버를 MONGODB_DB=bookbook·BETA_USER=fe 로 잠깐 켜고 같은 순서로 (CLAUDE.md).

const B = process.env.SEED_BASE ?? "http://localhost:7000";
const FE = (process.env.BETA_USER ?? "fe").toLowerCase();

async function call(who, method, path, body) {
  const headers = { ...(who ? { Cookie: `bb_dev=${who}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) };
  const r = await fetch(B + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  const json = t ? JSON.parse(t) : null;
  if (!r.ok) throw new Error(`${who ?? FE} ${method} ${path} → ${r.status} ${json?.message ?? t.slice(0, 120)}`);
  return json;
}
const fe = (method, path, body) => call(null, method, path, body); // 쿠키 없음 = 베타 계정

const daysAgo = (d, h = 21) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(h, 0, 0, 0);
  return t.toISOString();
};

// 책 13권 — 친구들과 같은 책이 많아 통로가 열린다 (데미안·아몬드·불편한 편의점 = 지민 / 헤일메리·싯다르타·코스모스 = 현우 / 급류·불편한 편의점 = 엄마)
const PLAN = [
  { isbn: "9788937460449", st: "read", min: 260, ago: 35, rating: 5, one: "알을 깨고 나오는 새처럼" },
  { isbn: "9788936434120", st: "read", min: 240, ago: 28, rating: 5, one: "잊지 않겠다는 마음으로" }, // 소년이 온다
  { q: "어린 왕자", st: "read", min: 90, ago: 42, rating: 5, one: "어른이 되어 다시 만난 어린 왕자" },
  { q: "프로젝트 헤일메리", st: "read", min: 700, ago: 20, rating: 5, one: "로키랑 친구 하고 싶다" },
  { q: "아몬드 손원평", st: "read", min: 190, ago: 14, rating: 4 },
  { q: "불편한 편의점 김호연", st: "read", min: 240, ago: 9, rating: 4, one: "따뜻한 컵라면 같은 책" },
  { q: "급류 정대건", st: "read", min: 270, ago: 5, rating: 5 },
  { q: "싯다르타 헤르만 헤세", st: "reading", sessions: [[80, 70, 3], [150, 80, 1]] }, // [몇 쪽까지, 분, 며칠 전]
  { q: "코스모스 칼 세이건", st: "reading", sessions: [[120, 100, 2]] },
  { q: "이방인 카뮈", st: "reading", sessions: [[60, 50, 0]] },
  { q: "모순 양귀자", st: "want" },
  { q: "가호 무라카미 하루키", st: "want" },
  { q: "작별인사 김영하", st: "want" },
];

// 나 (베타 계정) — 아기자기하게: 똥머리·가디건·치마, 반짝 눈, 병아리 친구. 모눈 방 + 버터색 책장
const AVATAR = {
  gender: "girl", hair: "bun", hairColor: "choco", skin: "light", outfit: "butter", top: "cardigan", bottom: "skirt", shoes: "flats",
  glasses: false, eyes: "sparkle", eyeColor: "brown", brows: "soft", mouth: "smile", nose: "dot", cheeks: "blush", sticker: "heart", pet: "chick",
};
const LOOK = {
  house: "grid",
  worn: ["ribbon", "overalls"], // 리본 + 멜빵바지
  placed: ["plant", "lamp", "window", "lights", "frame", "table", "cat", "ladder", "paint"],
  paint: "butter",
  box: "crown", // 안 연 배달 상자 하나 — 열어 보는 재미
  points: 600, // 남겨 둘 포인트 (상점에서 직접 사 보게)
};
const STAMPS = {
  jimin: { kind: "heart", note: "책장 너무 귀엽다! 데미안 같이 읽어서 반가워" },
  hyunwoo: { kind: "star", note: "헤일메리 통로 열렸다! 로키 최고" },
  mom: { kind: "flower", note: "오늘도 한 쪽씩, 화이팅" },
};

async function findBook(p) {
  if (p.isbn) return { isbn13: p.isbn };
  const r = await fe("GET", `/api/books/search?q=${encodeURIComponent(p.q)}`);
  const first = r.items?.find((x) => x.isbn13 || x.itemId > 0);
  return first ? { isbn13: first.isbn13 ?? undefined, itemId: first.itemId > 0 ? first.itemId : undefined } : null;
}

const health = await fetch(`${B}/api/health`).then((r) => r.json()).catch(() => null);
if (!health?.ok) {
  console.error(`서버가 안 켜졌어요 (${B}/api/health)`);
  process.exit(1);
}
const me0 = await fe("GET", "/api/me");
if (me0.handle !== FE) {
  console.error(`쿠키 없이 부르면 '${FE}' 가 아니라 '${me0.handle}' 예요 — 서버를 BETA_USER=${FE} 로 켜 주세요`);
  process.exit(1);
}
console.log(`베타 계정 '${FE}' 채우는 중 — ${B} (YES24: ${health.yes24})`);

// 1) 모습 · 집 · 이름
await fe("PATCH", "/api/me", { avatar: AVATAR, house: LOOK.house, ...(me0.nickname === "운영자" ? { profile: { nickname: "나", bio: "잠들기 전 30분, 한 쪽씩" } } : {}) });

// 2) 책 (이미 있으면 건너뜀)
const lib = await fe("GET", "/api/library");
if (lib.books.length) console.log(`  책: 이미 ${lib.books.length}권 — 건너뜀`);
else {
  for (const p of PLAN) {
    const ref = await findBook(p);
    if (!ref) {
      console.log(`  ✖ '${p.q}' 를 못 찾음`);
      continue;
    }
    const { book } = await fe("POST", "/api/library", { ...ref, status: p.st === "want" ? "want" : "reading" });
    if (p.st === "read") {
      const pages = book.pages ?? 300;
      const n = Math.max(1, Math.ceil(p.min / 240));
      for (let i = 1; i <= n; i++) {
        await fe("POST", `/api/library/${book.id}/sessions`, { toPage: Math.round((pages * i) / n), minutes: Math.round(p.min / n), finished: i === n, endedAt: daysAgo(p.ago + (n - i)) });
      }
    }
    for (const [to, min, ago] of p.sessions ?? []) await fe("POST", `/api/library/${book.id}/sessions`, { toPage: to, minutes: min, endedAt: daysAgo(ago, 22) });
    if (p.rating || p.one) await fe("PATCH", `/api/library/${book.id}`, { rating: p.rating ?? null, oneLiner: p.one ?? null });
    console.log(`  ${p.st.padEnd(7)} ${book.title}`);
  }
}

// 3) 친구 — 베타 계정이 초대 링크를 만들고 셋이 수락 (이미 친구면 그대로)
const { code } = await fe("POST", "/api/invites");
for (const who of ["jimin", "hyunwoo", "mom"]) {
  try {
    await call(who, "POST", `/api/invites/${code}`);
  } catch (e) {
    console.log(`  (친구 ${who}: ${e.message.split("→")[1]?.trim() ?? e.message})`);
  }
}

// 4) 꾸미기 — 모자란 포인트는 관리자(개발 중 '나')가 '시험 데이터'로 채우고, 상점에서 사서 배달 상자를 연다
const shop = await fe("GET", "/api/shop");
const item = (id) => shop.items.find((x) => x.id === id);
const want = [...LOOK.worn, ...LOOK.placed].filter((id) => item(id) && !item(id).owned && !item(id).coming);
const boxNeed = item(LOOK.box) && !item(LOOK.box).owned && !item(LOOK.box).coming ? item(LOOK.box).price : 0;
const cost = want.reduce((t, id) => t + item(id).price, 0) + boxNeed + LOOK.points;
if (cost > shop.points) await call("dev", "PATCH", `/api/admin/users/${FE}`, { points: { delta: cost - shop.points, note: "시험 데이터 — 베타 계정 꾸미기" } });
for (const id of want) await fe("POST", "/api/shop", { id });
for (let i = 0; i < 30; i++) {
  const r = await fetch(`${B}/api/me/gift`, { method: "POST" });
  if (!r.ok) break;
}
await fe("PATCH", "/api/me", { deco: { worn: LOOK.worn, placed: LOOK.placed, paint: LOOK.paint } });
if (boxNeed) await fe("POST", "/api/shop", { id: LOOK.box }); // 안 연 상자 하나 남기기
console.log(`  꾸미기: ${LOOK.house} · 소품 ${LOOK.worn.join("·")} · 놓은 것 ${LOOK.placed.join("·")} · 책장 ${LOOK.paint}${want.length ? ` (새로 산 것 ${want.join("·")})` : ""}`);

// 5) 친구들이 놀러 와 발도장
for (const [who, s] of Object.entries(STAMPS)) {
  try {
    await call(who, "POST", `/api/universe/${FE}/visit`);
    await call(who, "POST", `/api/universe/${FE}/stamp`, s);
  } catch (e) {
    console.log(`  (발도장 ${who}: ${e.message.split("→")[1]?.trim() ?? e.message})`);
  }
}

const me = await fe("GET", "/api/me");
const { friends } = await fe("GET", "/api/friends");
console.log(`'${FE}' 포인트 ${me.points} · 배달 상자 ${me.pending}개 · 책장 친구: ${friends.map((f) => `${f.nickname}(열린 통로 ${f.open}·희미 ${f.faint})`).join(", ")}`);
