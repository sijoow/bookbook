// 개발용 시험 데이터 — 나·지민·현우·엄마의 책장, 읽은 기록(시간·쪽), 책장 친구.
// 실제 API 로 넣는다 (화면과 같은 규칙을 거친다). 친구는 '나'가 초대 링크를 만들고 셋이 수락.
//   npm run dev:seed   임시 Mongo + 서버를 켜면서 채우기
//   npm run seed       dev 서버가 이미 켜져 있을 때 (이미 책이 있는 계정은 건너뜀)
// 책 정보는 YES24 에서 그때그때 찾는다 (키가 없으면 샘플 모드라 몇 권만 들어간다).

const B = process.env.SEED_BASE ?? "http://localhost:7000";

async function call(who, method, path, body) {
  const r = await fetch(B + path, {
    method,
    headers: { Cookie: `bb_dev=${who}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  const json = t ? JSON.parse(t) : null;
  if (!r.ok) throw new Error(`${who} ${method} ${path} → ${r.status} ${json?.message ?? t.slice(0, 120)}`);
  return json;
}

const daysAgo = (d, h = 21) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(h, 0, 0, 0);
  return t.toISOString();
};

// read: 다 읽은 책 (min = 걸린 분, ago = 며칠 전에 다 읽었나) · reading: 읽는 중 (to = 몇 쪽까지) · want: 읽고 싶은
const PLAN = {
  dev: [
    { isbn: "9788937460449", st: "read", min: 280, ago: 40, rating: 5, one: "알을 깨고 나오는 이야기. 스무 살에 다시 읽기" },
    { isbn: "9788936434120", st: "read", min: 250, ago: 33, rating: 5 },
    { q: "프로젝트 헤일메리", st: "read", min: 760, ago: 25, rating: 4 },
    { q: "이방인 카뮈", st: "read", min: 200, ago: 18 },
    { q: "싯다르타 헤르만 헤세", st: "read", min: 210, ago: 12, rating: 4 },
    { q: "모순 양귀자", st: "read", min: 330, ago: 8 },
    { q: "급류 정대건", st: "read", min: 290, ago: 4, rating: 5 },
    { q: "안녕이라 그랬어 김애란", st: "reading", sessions: [[70, 60, 2], [132, 75, 0]] }, // [몇 쪽까지, 분, 며칠 전]
    { q: "가호 무라카미 하루키", st: "want" },
  ],
  jimin: [
    { isbn: "9788937460449", st: "read", min: 240, ago: 50, rating: 4, one: "다시 읽어도 새롭다" },
    { isbn: "9788936434120", st: "read", min: 200, ago: 20, rating: 5, one: "끝까지 붙잡고 읽었다" },
    { q: "아몬드 손원평", st: "read", min: 180, ago: 9, rating: 5 },
    { q: "불편한 편의점 김호연", st: "read", min: 260, ago: 3, rating: 4 },
    { q: "이방인 카뮈", st: "reading", sessions: [[90, 70, 1]] },
    { q: "모순 양귀자", st: "want" },
  ],
  hyunwoo: [
    { q: "프로젝트 헤일메리", st: "read", min: 620, ago: 30, rating: 5, one: "로키 때문에 울었다" },
    { isbn: "9788937460449", st: "read", min: 300, ago: 22 },
    { q: "싯다르타 헤르만 헤세", st: "read", min: 190, ago: 14, rating: 4 },
    { q: "급류 정대건", st: "read", min: 250, ago: 6, rating: 4, one: "여름 냄새가 나는 소설" },
    { q: "코스모스 칼 세이건", st: "reading", sessions: [[180, 160, 2]] },
    { q: "가호 무라카미 하루키", st: "reading", sessions: [[120, 110, 0]] },
  ],
  mom: [
    { isbn: "9788936434120", st: "read", min: 230, ago: 15, rating: 5, one: "마음이 아팠다" },
    { q: "불편한 편의점 김호연", st: "read", min: 210, ago: 7, rating: 4 },
    { q: "급류 정대건", st: "reading", sessions: [[100, 90, 1]] },
  ],
};

// 나만의 아바타 — 계정마다 다르게 (새로 채우는 계정만, 이미 고친 아바타는 건드리지 않는다)
const AVATARS = {
  dev: { hair: "bun", hairColor: "choco", skin: "light", outfit: "coral", glasses: false },
  jimin: { hair: "pigtails", hairColor: "black", skin: "light", outfit: "sky", glasses: false, eyes: "sparkle", brows: "soft", mouth: "smile", cheeks: "blush", sticker: "heart", gender: "girl", pet: "rabbit" },
  hyunwoo: { hair: "short", hairColor: "brown", skin: "tan", outfit: "mint", glasses: true, eyes: "dot", brows: "bold", mouth: "cat", cheeks: "freckles", sticker: "none", gender: "boy", pet: "dog" },
  mom: { hair: "bob", hairColor: "caramel", skin: "light", outfit: "butter", glasses: false, eyes: "lash", brows: "soft", mouth: "smile", cheeks: "both", sticker: "mole", gender: "girl", pet: "hamster" },
};

async function findBook(who, p) {
  if (p.isbn) return { isbn13: p.isbn };
  const r = await call(who, "GET", `/api/books/search?q=${encodeURIComponent(p.q)}`);
  const first = r.items?.find((x) => x.isbn13 || x.itemId > 0);
  return first ? { isbn13: first.isbn13 ?? undefined, itemId: first.itemId > 0 ? first.itemId : undefined } : null;
}

async function fill(who) {
  const lib = await call(who, "GET", "/api/library");
  if (lib.books.length) {
    console.log(`  ${who}: 이미 책 ${lib.books.length}권 — 건너뜀`);
    return;
  }
  if (AVATARS[who]) await call(who, "PATCH", "/api/me", { avatar: AVATARS[who] });
  for (const p of PLAN[who]) {
    const ref = await findBook(who, p);
    if (!ref) {
      console.log(`  ✖ ${who}: '${p.q}' 를 못 찾음`);
      continue;
    }
    // 다 읽은 책도 '읽는 중'으로 넣고 끝 쪽까지 읽은 기록을 남긴다 → 읽는 속도·걸린 시간이 실제처럼 쌓인다
    const { book } = await call(who, "POST", "/api/library", { ...ref, status: p.st === "want" ? "want" : "reading" });
    if (p.st === "read") {
      // 며칠에 나눠 읽은 것처럼 (한 번 기록은 12시간까지) — 하루 4시간 안쪽씩, 마지막 날 끝 쪽
      const pages = book.pages ?? 300;
      const n = Math.max(1, Math.ceil(p.min / 240));
      for (let i = 1; i <= n; i++) {
        await call(who, "POST", `/api/library/${book.id}/sessions`, {
          toPage: Math.round((pages * i) / n),
          minutes: Math.round(p.min / n),
          finished: i === n,
          endedAt: daysAgo(p.ago + (n - i)),
        });
      }
    }
    for (const [to, min, ago] of p.sessions ?? []) {
      await call(who, "POST", `/api/library/${book.id}/sessions`, { toPage: to, minutes: min, endedAt: daysAgo(ago, 22) });
    }
    if (p.rating || p.one) await call(who, "PATCH", `/api/library/${book.id}`, { rating: p.rating ?? null, oneLiner: p.one ?? null });
    console.log(`  ${who}: ${p.st.padEnd(7)} ${book.title}`);
  }
}

const health = await fetch(`${B}/api/health`).then((r) => r.json()).catch(() => null);
if (!health?.ok) {
  console.error(`서버가 안 켜졌어요 (${B}/api/health). npm run dev:mem 이나 npm run dev:seed 로 켜 주세요.`);
  process.exit(1);
}
console.log(`시험 데이터 넣는 중 — ${B} (YES24: ${health.yes24})`);
for (const who of Object.keys(PLAN)) await fill(who);

// 친구: '나'가 초대 링크를 만들고 셋이 수락 (이미 친구면 그대로)
const { code } = await call("dev", "POST", "/api/invites");
for (const who of ["jimin", "hyunwoo", "mom"]) await call(who, "POST", `/api/invites/${code}`);
// 친구 집은 저마다 다르게 — 집(벽·바닥·창·구도·러그 색) · 아바타 소품 · 놓은 물건. 베타에서 꾸미기가 얼마나 다양한지 친구 집에서 보이게 (11-13 사용자)
// 모자라는 포인트는 관리자('나')가 '시험 데이터'로 채워 주고, 상점에서 사서 배달 상자를 열고, 하고/놓을 것만 켠다. '나'는 직접 사 보게 남겨 둔다
const LOOK = {
  jimin: { house: "attic", worn: ["flowers", "dots"], placed: ["lights", "frame", "plant"] }, // 다락방 — 꽃 화관·땡땡이 원피스, 줄 전구·액자·화분
  hyunwoo: { house: "cabin", worn: ["scarf", "bag", "sweater"], placed: ["table", "lamp", "cat"] }, // 오두막 — 목도리·책가방·니트 스웨터, 탁자와 머그·스탠드·고양이
  mom: { house: "sunny", worn: ["crown", "raincoat"], placed: ["plant", "table", "lights", "frame"] }, // 창가 원룸 — 왕관·노란 우비, 화분·탁자·줄 전구·액자
};
for (const [who, look] of Object.entries(LOOK)) {
  await call(who, "PATCH", "/api/me", { house: look.house });
  const shop = await call(who, "GET", "/api/shop");
  const item = (id) => shop.items.find((x) => x.id === id);
  const need = [...look.worn, ...look.placed].filter((id) => item(id) && !item(id).owned && !item(id).coming);
  const cost = need.reduce((t, id) => t + item(id).price, 0);
  if (cost > shop.points) await call("dev", "PATCH", `/api/admin/users/${who}`, { points: { delta: cost - shop.points, note: "시험 데이터 — 친구 집 꾸미기" } });
  for (const id of need) await call(who, "POST", "/api/shop", { id });
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`${B}/api/me/gift`, { method: "POST", headers: { Cookie: `bb_dev=${who}` } });
    if (!r.ok) break;
  }
  await call(who, "PATCH", "/api/me", { deco: { worn: look.worn, placed: look.placed } });
  console.log(`  ${who}: ${look.house} · 소품 ${look.worn.join("·")} · 놓은 것 ${look.placed.join("·")}${need.length ? ` (새로 산 것 ${need.join("·")})` : ""}`);
}
const me = await call("dev", "GET", "/api/me");
console.log(`'나' 포인트 ${me.points} · 배달 상자 ${me.pending}개 (꾸미기 · 상점에서 사면 상자로 와요)`);
const { friends } = await call("dev", "GET", "/api/friends");
console.log("책장 친구:", friends.map((f) => `${f.nickname}(열린 통로 ${f.open}·희미 ${f.faint})`).join(", "));
