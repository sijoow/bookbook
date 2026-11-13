// 입체 도서관 캡처 + 손 시험 — 390px 휴대폰, 헤드리스 Edge(소프트웨어 WebGL)
//   node scripts/shot-3d.mjs [base] [출력폴더] [--account=dev] [--only=idle]
// 책을 손가락으로 눌러 → 아바타가 꺼내 오는 장면 → 읽기 화면 → '책 덮기' → '기록 없이 꽂기'(데이터 안 바뀜) → 다시 앉기
// 책 자리는 개발 모드에서만 열리는 window.__library3d 에 묻는다.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flag = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const base = args[0] || "http://localhost:7000";
const out = args[1] || "shots/3d";
const account = flag("account", "dev");
const only = flag("only", "");
fs.mkdirSync(out, { recursive: true });

const edge = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
if (!edge) throw new Error("Edge 를 못 찾았어요");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: edge,
  headless: true,
  args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--use-angle=swiftshader", "--enable-webgl"],
});
const errors = [];
let n = 0;
const shot = async (page, name) => {
  const file = path.join(out, `${String(++n).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file });
  return file;
};
const state = (page) => page.evaluate(() => window.__library3d?.debugState());

const scene = flag("scene", "home");
const canvasPoint = (page, fn, arg) =>
  page.evaluate(
    (fnSrc, a) => {
      const w = window.__library3d;
      const p = fnSrc === "avatar" ? w.debugAvatarPoint() : w.debugBookPoint(a);
      const r = document.querySelector("canvas").getBoundingClientRect();
      return p && { x: r.left + p.x, y: r.top + p.y };
    },
    fn,
    arg,
  );
const clickText = (page, text) => page.evaluate((t) => [...document.querySelectorAll("button")].find((b) => b.textContent?.includes(t))?.click(), text);

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(`[${m.type()}] ${m.text()}`));
  await page.setCookie({ name: "bb_dev", value: account, url: base });

  if (scene === "guest") {
    // 친구 도서관에 손님으로 — 걸어 들어와 앉기 · 발도장 남기기 → 집주인 홈 '놀러 온 친구'에 보이나 (시험 기록은 끝나고 지운다)
    const friend = flag("friend", "hyunwoo");
    await page.goto(`${base}/u/${friend}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction(() => !!window.__library3d, { timeout: 90000 });
    await sleep(1200);
    await shot(page, "guest-enter");
    await sleep(1800);
    await shot(page, "guest-hello");
    await page.waitForFunction(() => window.__library3d.debugState().running === 0, { timeout: 30000 });
    await sleep(500);
    await shot(page, "guest-sat");
    // 11-13: 친구 집도 화면 가득 — 아래 메뉴 '발도장'을 눌러 창을 연다 (2D 화면이면 바로 보인다)
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "발도장")?.click());
    await page.waitForSelector('input[aria-label="한마디"]', { timeout: 10000 });
    await page.evaluate(() => [...document.querySelectorAll('button[role="radio"]')].find((b) => b.textContent?.includes("별"))?.click());
    await page.click('input[aria-label="한마디"]');
    await page.keyboard.type("책장 멋지다!");
    await clickText(page, "꾹 남기기");
    await sleep(700);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    await shot(page, "guest-stamp");
    // 집주인 쪽에서 보이나
    const host = await browser.newPage();
    await host.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await host.setCookie({ name: "bb_dev", value: friend, url: base });
    await host.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await host.waitForFunction(() => document.body.innerText.includes("놀러 온 친구"), { timeout: 60000 });
    const g = await host.evaluate(async () => (await (await fetch("/api/visits")).json()).guests);
    console.log("집주인이 보는 놀러 온 친구:", JSON.stringify(g.map((x) => ({ who: x.nickname, stamp: x.stamp?.kind, note: x.stamp?.note }))));
    await host.evaluate(() => {
      const el = [...document.querySelectorAll("section")].find((s) => s.textContent?.includes("놀러 온 친구"));
      el?.scrollIntoView({ block: "center" });
    });
    await sleep(600);
    await host.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-host-guests.png`) });
    await host.close();
    console.log(`캡처 ${n}장 → ${out}/`);
  } else if (scene === "arrange") {
    // 방 물건 옮기기 (11-13) — 정리 → '물건 자리' → 화분(책장 위→바닥, 마우스) · 탁자(바닥, 손가락) · 액자(벽, 마우스)
    // → 저장 확인 → 친구('나')가 놀러 가면 그 자리 그대로 → '처음 자리로' → 원래 저장값으로 되돌림. 물건이 놓인 계정으로: --account=mom
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction(() => !!window.__library3d, { timeout: 90000 });
    await sleep(3500);
    const deco0 = await page.evaluate(async () => (await (await fetch("/api/me")).json()).deco);
    console.log("놓은 물건:", deco0.placed.join(","), "· 옮긴 자리(처음):", JSON.stringify(deco0.pos));
    await clickText(page, "정리");
    await sleep(400);
    await clickText(page, "물건 자리"); // 책이 둘 이상이면 탭이 보인다 (처음엔 '책 순서')
    await page.waitForFunction(() => window.__library3d.debugState().arranging, { timeout: 10000 });
    await sleep(3000); // 카메라가 방 전체로 물러나는 동안
    await shot(page, "arrange-start");
    const toPage = (fnName, args) =>
      page.evaluate(
        (f, a) => {
          const p = window.__library3d[f](...a);
          const r = document.querySelector("canvas").getBoundingClientRect();
          return p && { x: r.left + p.x, y: r.top + p.y };
        },
        fnName,
        args,
      );
    const savedPos = async (id, ok) => {
      for (let k = 0; k < 40; k++) {
        const p = await page.evaluate(async (i) => (await (await fetch("/api/me")).json()).deco.pos[i] ?? null, id);
        if (ok(p)) return p;
        await sleep(500);
      }
      return null;
    };
    // 물건 밑면을 target(방 좌표)에 놓으려면 — 잡은 곳(그림 가운데)과 밑면의 화면 거리만큼 더해서 끈다
    const dragItem = async (id, target, how, label) => {
      const st = await state(page);
      const s = st.spots[id];
      const grab = await toPage("debugItemPoint", [id]);
      const base0 = await toPage("debugRoomPoint", [s.x, s.y, s.z]);
      const goal = await toPage("debugRoomPoint", target);
      const end = { x: goal.x + (grab.x - base0.x), y: goal.y + (grab.y - base0.y) };
      if (how === "mouse") {
        await page.mouse.move(grab.x, grab.y);
        await page.mouse.down();
        for (let i = 1; i <= 12; i++) {
          await page.mouse.move(grab.x + ((end.x - grab.x) * i) / 12, grab.y + ((end.y - grab.y) * i) / 12);
          await sleep(45);
          if (i === 8) await shot(page, `${label}-dragging`);
        }
        await page.mouse.up();
      } else {
        await page.touchscreen.touchStart(grab.x, grab.y);
        for (let i = 1; i <= 12; i++) {
          await page.touchscreen.touchMove(grab.x + ((end.x - grab.x) * i) / 12, grab.y + ((end.y - grab.y) * i) / 12);
          await sleep(45);
          if (i === 8) await shot(page, `${label}-dragging`);
        }
        await page.touchscreen.touchEnd();
      }
      await sleep(500);
      const after = (await state(page)).spots[id];
      console.log(`${label}: ${s.s}(${s.x.toFixed(1)}, ${s.y.toFixed(1)}, ${s.z.toFixed(1)}) → ${after.s}(${after.x.toFixed(1)}, ${after.y.toFixed(1)}, ${after.z.toFixed(1)}) · 바란 곳 (${target.map((v) => v.toFixed(1)).join(", ")})`);
      return after;
    };
    const st0 = await state(page);
    const c0 = st0.cases[0];
    const left = c0.x - c0.width / 2;
    const cu = st0.cushion;
    const placed = st0.placed;
    if (placed.includes("plant")) {
      const a = await dragItem("plant", [left - 14, 0, -12], "mouse", "plant-floor");
      const p = await savedPos("plant", (v) => v?.s === "floor");
      console.log(a.s === "floor" && p ? `✓ 화분이 바닥으로 · 저장 ${JSON.stringify(p)}` : "✗ 화분 바닥 옮기기");
    }
    if (placed.includes("table")) {
      const before = st0.spots.table;
      const a = await dragItem("table", [cu.x - 46, 0, cu.z - 12], "touch", "table-touch");
      const p = await savedPos("table", (v) => v?.s === "floor");
      console.log(Math.hypot(a.x - before.x, a.z - before.z) > 10 && p ? `✓ 탁자를 손가락으로 옮김 · 저장 ${JSON.stringify(p)}` : "✗ 탁자 옮기기");
    }
    if (placed.includes("frame")) {
      const a = await dragItem("frame", [left - 18, 45, st0.wallZ + 0.6], "mouse", "frame-wall");
      const p = await savedPos("frame", (v) => v?.s === "wall");
      console.log(a.s === "wall" && p ? `✓ 액자를 벽 다른 곳으로 · 저장 ${JSON.stringify(p)}` : "✗ 액자 옮기기");
    }
    if (placed.includes("cat")) {
      const a = await dragItem("cat", [left - 16, 0, 2], "touch", "cat-touch");
      const p = await savedPos("cat", (v) => v?.s === "floor");
      console.log(p ? `✓ 고양이 옮김 (${a.x.toFixed(1)}, ${a.z.toFixed(1)})` : "✗ 고양이 옮기기");
    }
    await sleep(400);
    await shot(page, "arrange-moved");
    await clickText(page, "다 됐어요");
    await page.waitForFunction(() => !window.__library3d.debugState().arranging, { timeout: 10000 });
    await sleep(3000);
    await shot(page, "room-after");
    // 친구('나')가 놀러 가면 옮긴 자리 그대로
    const friendView = await browser.newPage();
    await friendView.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await friendView.setCookie({ name: "bb_dev", value: "dev", url: base });
    await friendView.goto(`${base}/u/${account}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await friendView.waitForFunction(() => !!window.__library3d, { timeout: 90000 });
    await sleep(4000);
    const fv = await friendView.evaluate(() => window.__library3d.debugState().spots);
    const mine = (await state(page)).spots;
    const same = Object.keys(mine).every((k) => fv[k] && fv[k].s === mine[k].s && Math.abs(fv[k].x - mine[k].x) < 0.2 && Math.abs(fv[k].z - mine[k].z) < 0.2);
    console.log(same ? "✓ 친구 집에서도 같은 자리" : `✗ 친구 집 자리 다름 ${JSON.stringify(fv)}`);
    await friendView.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-friend-sees.png`) });
    await friendView.close();
    // '처음 자리로' 단추 → 모두 처음 자리 → 원래 저장값으로 되돌림
    await clickText(page, "정리");
    await sleep(400);
    await clickText(page, "물건 자리");
    await page.waitForFunction(() => window.__library3d.debugState().arranging, { timeout: 10000 });
    await sleep(600);
    await clickText(page, "처음 자리로");
    const cleared = await page.evaluate(async () => {
      for (let k = 0; k < 40; k++) {
        const p = (await (await fetch("/api/me")).json()).deco.pos;
        if (Object.keys(p).length === 0) return true;
        await new Promise((r) => setTimeout(r, 500));
      }
      return false;
    });
    const back = (await state(page)).spots;
    console.log(cleared && (!back.plant || back.plant.s === "top") ? "✓ 처음 자리로 (저장값 비움)" : "✗ 처음 자리로");
    await clickText(page, "다 됐어요");
    await sleep(800);
    if (Object.keys(deco0.pos).length) {
      await page.evaluate(async (pos) => fetch("/api/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ deco: { pos } }) }), deco0.pos);
      console.log("원래 옮긴 자리로 되돌림");
    }
    console.log(`캡처 ${n}장 → ${out}/`);
  } else if (scene === "shelf") {
    // 책장 크게 보기 · 끌어서 순서 바꾸기(마우스·손가락) · 한 번에 정렬 — 끝나면 처음 순서로 되돌린다
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction(() => !!window.__library3d, { timeout: 90000 });
    await sleep(3500);
    const original = await page.evaluate(async () => (await (await fetch("/api/library")).json()).books.map((b) => b.id));
    const titles = await page.evaluate(async () => Object.fromEntries((await (await fetch("/api/library")).json()).books.map((b) => [b.id, b.title])));
    const show = (ids) => ids.map((id) => titles[id]).join(" · ");
    console.log("처음 순서:", show(original));
    await shot(page, "room");
    await clickText(page, "크게 보기");
    await sleep(1500);
    await shot(page, "shelf-view");
    await clickText(page, "방 보기");
    await sleep(1200);
    // 책장 정리 → 끌기
    await clickText(page, "책장 정리");
    await sleep(1600);
    await shot(page, "edit");
    const pt = (id) => canvasPoint(page, "book", id);
    const savedOrder = async () => page.evaluate(async () => (await (await fetch("/api/library")).json()).books.map((b) => b.id));
    // 저장이 늦게 끝날 수 있다(서버가 바쁠 때 몇 초) → 화면 순서와 같아질 때까지 기다린다
    const settled = async () => {
      const want = (await state(page)).order;
      for (let k = 0; k < 40; k++) {
        const o = await savedOrder();
        if (o.join() === want.join()) return o;
        await sleep(750);
      }
      return savedOrder();
    };
    // 1) 마우스: 첫 책을 마지막 책 뒤로 — 누르고, 여러 걸음 움직이고, 뗀다
    {
      const a = await pt(original[0]);
      const z = await pt(original[original.length - 1]);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      for (let i = 1; i <= 10; i++) {
        await page.mouse.move(a.x + ((z.x + 14 - a.x) * i) / 10, a.y + ((z.y - a.y) * i) / 10);
        await sleep(40);
        if (i === 6) await shot(page, "drag-mouse");
      }
      await page.mouse.up();
      await sleep(600);
      const o = await settled();
      console.log("마우스로 옮긴 뒤:", show(o), o[o.length - 1] === original[0] ? "✓ 첫 책이 맨 뒤로" : "✗");
      await shot(page, "after-mouse");
    }
    // 2) 손가락: 맨 뒤로 간 책을 다시 맨 앞으로
    {
      const now = await savedOrder();
      const a = await pt(now[now.length - 1]);
      const z = await pt(now[0]);
      await page.touchscreen.touchStart(a.x, a.y);
      for (let i = 1; i <= 10; i++) {
        await page.touchscreen.touchMove(a.x + ((z.x - 14 - a.x) * i) / 10, a.y + ((z.y - a.y) * i) / 10);
        await sleep(40);
      }
      await page.touchscreen.touchEnd();
      await sleep(600);
      const o = await settled();
      console.log("손가락으로 옮긴 뒤:", show(o), o.join() === original.join() ? "✓ 처음 순서로 돌아옴" : "✗");
    }
    // 3) 한 번에 정렬 — 제목 가나다
    await clickText(page, "제목 가나다");
    await sleep(250);
    await shot(page, "sorting");
    await sleep(600);
    const sorted = await settled();
    console.log("제목 가나다:", show(sorted));
    await shot(page, "sorted");
    // 되돌리기 — 화면을 닫아 남은 저장이 없게 한 뒤
    await clickText(page, "다 됐어요");
    await page.goto("about:blank");
    await sleep(1500);
    const p3 = await browser.newPage();
    await p3.setCookie({ name: "bb_dev", value: account, url: base });
    await p3.goto(`${base}/api/health`);
    await p3.evaluate(async (ids) => {
      await fetch("/api/library/order", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    }, original);
    await sleep(3000);
    const back = await p3.evaluate(async () => (await (await fetch("/api/library")).json()).books.map((b) => b.id));
    await p3.close();
    console.log("되돌림:", back.join() === original.join() ? "처음 순서 그대로" : `다름 ${show(back)}`);
    console.log(`캡처 ${n}장 → ${out}/`);
  } else if (scene === "member") {
    // 마이페이지(얼굴 꾸미기) — 고른 뒤 원래 얼굴로 되돌린다
    await page.goto(`${base}/me`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction(() => !!window.__library3d, { timeout: 90000 });
    const before = await page.evaluate(async () => (await (await fetch("/api/me")).json()).avatar);
    await sleep(1800);
    await shot(page, "me-top");
    // 꾸미기 창 (11-13) — 탭마다 그림 칸: 눈 '반짝' · 눈썹 '동글' · 입 '고양이' · 볼 '둘 다' · 스티커 '하트' → 결정
    await clickText(page, "나의 모습 꾸미기");
    await page.waitForSelector('[role="dialog"][aria-label="나의 모습 꾸미기"]', { timeout: 20000 });
    await sleep(2500);
    const tabTo = (label) => page.evaluate((l) => document.querySelector(`[role="tab"][aria-label="${l}"]`)?.click(), label);
    const tileTo = (label) => page.evaluate((l) => [...document.querySelectorAll(`[role="dialog"] button[aria-label="${l}"]`)].at(-1)?.click(), label); // 같은 이름(눈 '동글'·눈썹 '동글')은 뒤 칸
    await tabTo("눈");
    await sleep(1500);
    await tileTo("반짝");
    await tileTo("동글");
    await sleep(900);
    await shot(page, "maker-eyes");
    await tabTo("입");
    await sleep(1000);
    await tileTo("고양이");
    await sleep(900);
    await shot(page, "maker-mouth");
    await tabTo("얼굴");
    await sleep(1000);
    await tileTo("둘 다");
    await tileTo("하트");
    await sleep(1000);
    await shot(page, "maker-face");
    await tabTo("추천");
    await sleep(6000);
    await shot(page, "maker-presets");
    await clickText(page, "결정");
    await sleep(1800);
    const saved = await page.evaluate(async () => (await (await fetch("/api/me")).json()).avatar);
    console.log("꾸미기 창 결정:", JSON.stringify({ eyes: saved.eyes, brows: saved.brows, mouth: saved.mouth, cheeks: saved.cheeks, sticker: saved.sticker }), saved.eyes === "sparkle" && saved.brows === "soft" && saved.mouth === "cat" && saved.cheeks === "both" && saved.sticker === "heart" ? "✓" : "✗");
    await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-me-full.png`), fullPage: true });
    // 화면이 보낸 저장이 다 끝난 뒤에 되돌린다 (먼저 되돌리면 늦게 끝난 저장이 이긴다 — 11-12 실제로 겪음)
    await page.goto("about:blank");
    await sleep(1500);
    let after = null;
    for (let k = 0; k < 3; k++) {
      const p3 = await browser.newPage();
      await p3.setCookie({ name: "bb_dev", value: account, url: base });
      await p3.goto(`${base}/api/health`);
      after = await p3.evaluate(async (a) => {
        await fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avatar: a }) });
        return (await (await fetch("/api/me")).json()).avatar;
      }, before);
      await p3.close();
      if (JSON.stringify(after) === JSON.stringify(before)) break;
      await sleep(2000);
    }
    console.log("얼굴 되돌림:", JSON.stringify(after) === JSON.stringify(before) ? "같음" : `다름 ${JSON.stringify(after)}`);

    // 새로 가입해 보기 — 쿠키 없는 새 창: 로그인 화면 → 가입 화면 → 도서관 → 탈퇴(남기지 않는다)
    const ctx = await browser.createBrowserContext();
    const p2 = await ctx.newPage();
    await p2.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    p2.on("pageerror", (e) => errors.push(String(e)));
    await p2.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await p2.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent?.includes("새로 가입해 보기") && Object.keys(b).some((k) => k.startsWith("__reactProps"))), { timeout: 30000 });
    await sleep(600);
    await shot(p2, "login");
    await p2.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("카카오로 시작하기"))?.click());
    await sleep(300);
    await shot(p2, "login-kakao-note");
    await p2.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("새로 가입해 보기"))?.click());
    await p2.waitForFunction(() => location.pathname === "/welcome" && !!document.querySelector('input[aria-label="닉네임"]'), { timeout: 30000 });
    await sleep(1500);
    await shot(p2, "welcome");
    await p2.click('input[aria-label="닉네임"]');
    await p2.keyboard.type("책벌레");
    await p2.evaluate(() => [...document.querySelectorAll("label")].find((l) => l.textContent?.includes("모두 동의해요"))?.querySelector("input")?.click());
    await sleep(400);
    await p2.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("다음 — 나의 모습"))?.click());
    await p2.waitForSelector('[role="tab"][aria-label="추천"]', { timeout: 30000 });
    await sleep(6000); // 추천 그림 칸 (입체로 찍는다)
    await shot(p2, "welcome-maker");
    await p2.evaluate(() => document.querySelector('button[aria-label="책벌레 똥머리"]')?.click());
    await sleep(900);
    await p2.evaluate(() => document.querySelector('[role="tab"][aria-label="눈"]')?.click());
    await sleep(1200);
    await p2.evaluate(() => document.querySelector('button[aria-label="졸린"]')?.click());
    await sleep(900);
    await shot(p2, "welcome-maker-picked");
    await p2.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("결정"))?.click());
    await p2.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent?.includes("도서관 들어가기")), { timeout: 20000 });
    await sleep(1500);
    await shot(p2, "welcome-house");
    await p2.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("도서관 들어가기"))?.click());
    await p2.waitForFunction(() => location.pathname === "/", { timeout: 30000 });
    await p2.waitForFunction(() => !!window.__library3d, { timeout: 90000 });
    await sleep(2500);
    await shot(p2, "new-home");
    const meNew = await p2.evaluate(async () => (await (await fetch("/api/me")).json()));
    console.log("새 계정:", JSON.stringify({ handle: meNew.handle, nickname: meNew.nickname, onboarded: meNew.onboarded, eyes: meNew.avatar?.eyes, skin: meNew.avatar?.skin, hairColor: meNew.avatar?.hairColor, hair: meNew.avatar?.hair }));
    const del = await p2.evaluate(async () => (await (await fetch("/api/me", { method: "DELETE" })).json()));
    console.log("새 계정 탈퇴:", JSON.stringify(del.removed));
    await p2.goto(`${base}/terms`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await sleep(500);
    await p2.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-terms.png`), fullPage: true });
    await ctx.close();
    console.log(`캡처 ${n}장 → ${out}/`);
  } else if (scene === "gift") {
    // 선물 상자 열기 — 상자를 손가락으로 눌러 두 번 연다 (도서관 물건 하나 + 아바타 소품 하나)
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction(() => !!window.__library3d && window.__library3d.debugGiftPoint(), { timeout: 90000 });
    await sleep(3500);
    await shot(page, "gift-idle");
    for (let k = 0; k < Number(flag("open", "2")); k++) {
      const gp = await page.evaluate(() => {
        const p = window.__library3d.debugGiftPoint();
        const r = document.querySelector("canvas").getBoundingClientRect();
        return p && { x: r.left + p.x, y: r.top + p.y };
      });
      if (!gp) break;
      await page.touchscreen.tap(gp.x, gp.y);
      for (let i = 0; i < 8; i++) {
        await sleep(450);
        if (k === 0 || i % 2 === 1) await shot(page, `open${k + 1}-${i}`);
      }
      await page.waitForFunction(() => window.__library3d.debugState().running === 0, { timeout: 20000 });
      await sleep(400);
      await shot(page, `opened${k + 1}`);
      console.log("state:", JSON.stringify(await state(page)));
    }
    await page.goto(`${base}/decorate`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction(() => !!window.__library3d, { timeout: 90000 });
    await sleep(3000);
    await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-decorate.png`), fullPage: true });
    console.log(`캡처 ${n}장 → ${out}/`);
  } else if (scene === "visit") {
    // 친구 도서관 — 반짝이는 책(나도 가진 책)을 눌러 친구 아바타가 꺼내 보여 주게
    const friend = flag("friend", "hyunwoo");
    await page.goto(`${base}/u/${friend}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction(() => !!window.__library3d, { timeout: 90000 });
    await sleep(3500);
    await shot(page, "visit-idle");
    const data = await page.evaluate(async (h) => (await (await fetch(`/api/universe/${h}`)).json()), friend);
    const target = data.portals[0]?.theirs.id ?? data.books[0].id;
    const pt = await canvasPoint(page, "book", target);
    await page.touchscreen.tap(pt.x, pt.y);
    for (let i = 0; i < 7; i++) {
      await sleep(500);
      await shot(page, `visit-${i}`);
    }
    await page.waitForFunction(() => window.__library3d.debugState().running === 0, { timeout: 15000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    await shot(page, "visit-show");
    await clickText(page, "돌려주기");
    await page.waitForFunction(() => window.__library3d.debugState().running === 0, { timeout: 15000 });
    await sleep(400);
    await shot(page, "visit-after");
    console.log("state:", JSON.stringify(await state(page)));
    console.log(`캡처 ${n}장 → ${out}/`);
    process.exitCode = 0;
  } else if (scene === "admin") {
    const J = (m, p, body, cookie) => fetch(base + p, { method: m, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    // 지난 시험이 남긴 시험 회원 지우기
    const left = await (await J("GET", "/api/admin/users?q=admin-test%40example.com", null, "bb_dev=dev")).json();
    for (const u of left.users ?? []) await J("DELETE", `/api/admin/users/${u.handle}?confirm=${u.handle}`, null, "bb_dev=dev");
    if (left.users?.length) console.log("남은 시험 회원 지움:", left.users.length);
    // 시험 회원 (가짜 구글) — 끝에 관리자 화면에서 탈퇴 처리한다
    const r0 = await J("POST", "/api/dev/login", { google: { sub: `admin-test-${Date.now()}`, email: "admin-test@example.com" } });
    const guestCookie = "bb_session=" + ((r0.headers.get("set-cookie") || "").match(/bb_session=([^;]+)/) || [])[1];
    const victim = (await r0.json()).current;
    console.log("시험 회원:", victim);
    await page.setViewport({ width: 1100, height: 900, deviceScaleFactor: 1 });
    await page.goto(`${base}/admin`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent?.includes("대시보드")), { timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes("가입한 사람"), { timeout: 60000 });
    await sleep(800);
    await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-admin-dash.png`), fullPage: true });
    const tab = (t) => page.evaluate((x) => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === x)?.click(), t);
    const btnIn = (handle, t) => page.evaluate((h, x) => {
      const card = [...document.querySelectorAll("article")].find((a) => a.textContent?.includes("@" + h));
      [...(card?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.trim() === x)?.click();
    }, handle, t);
    const typeIn = async (handle, label, text) => {
      const sel = await page.evaluateHandle((h, l) => [...document.querySelectorAll("article")].find((a) => a.textContent?.includes("@" + h))?.querySelector(`input[aria-label="${l}"]`), handle, label);
      await sel.asElement().click();
      await page.keyboard.down("Control");
      await page.keyboard.press("KeyA");
      await page.keyboard.up("Control");
      await page.keyboard.press("Backspace");
      await sel.asElement().type(text);
    };
    // 회원 — 찾아서 포인트 +50 → 정지 → (시험 회원 401) → 해제
    await tab("회원");
    await page.waitForSelector('input[aria-label="회원 찾기"]', { timeout: 20000 });
    await page.type('input[aria-label="회원 찾기"]', victim);
    await page.waitForFunction((h) => document.body.innerText.includes("@" + h), { timeout: 20000 }, victim);
    await btnIn(victim, "포인트");
    await sleep(300);
    await typeIn(victim, "포인트 (빼려면 -)", "50");
    await typeIn(victim, "이유", "관리자 시험");
    await btnIn(victim, "주기");
    await page.waitForFunction(() => document.body.innerText.includes("포인트 +50"), { timeout: 20000 });
    console.log("포인트 준 뒤:", (await (await J("GET", "/api/me", null, guestCookie)).json()).points);
    await btnIn(victim, "정지");
    await sleep(300);
    await typeIn(victim, "정지 이유", "시험 정지");
    await btnIn(victim, "정지하기");
    await page.waitForFunction(() => document.body.innerText.includes("정지했어요"), { timeout: 20000 });
    await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-admin-users.png`) });
    const r1 = await J("GET", "/api/me", null, guestCookie + "; bb_out=1");
    console.log("정지된 회원의 요청:", r1.status, (await r1.json()).message);
    await btnIn(victim, "정지 해제");
    await page.waitForFunction(() => document.body.innerText.includes("정지를 풀었어요"), { timeout: 20000 });
    // 글 — 첫 글 숨기기 → 되돌리기
    await tab("글");
    await page.waitForFunction(() => document.querySelectorAll("article").length > 0 || document.body.innerText.includes("아직 글이 없어요"), { timeout: 20000 });
    const firstPost = await page.evaluate(() => document.querySelector("article p")?.textContent ?? null);
    if (firstPost) {
      await page.evaluate(() => [...document.querySelector("article").querySelectorAll("button")].find((b) => b.textContent?.trim() === "숨기기")?.click());
      await page.waitForFunction(() => document.querySelector("article")?.textContent?.includes("숨김"), { timeout: 20000 });
      await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-admin-posts.png`) });
      await page.evaluate(() => [...document.querySelector("article").querySelectorAll("button")].find((b) => b.textContent?.trim() === "다시 보이기")?.click());
      await page.waitForFunction(() => !document.querySelector("article")?.textContent?.includes("숨김"), { timeout: 20000 });
      console.log("글 숨김→되돌림:", firstPost.slice(0, 30));
    } else console.log("글: 아직 없음");
    // 운영 · 공지 — 띄우고 홈에서 확인 → 지우기
    await tab("운영 · 공지");
    await page.waitForSelector('textarea[aria-label="공지 내용"]', { timeout: 20000 });
    await page.type('textarea[aria-label="공지 내용"]', "시험 공지 — 곧 지워져요");
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "띄우기")?.click());
    await page.waitForFunction(() => document.body.innerText.includes("공지를 띄웠어요"), { timeout: 20000 });
    await sleep(500);
    await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-admin-ops.png`), fullPage: true });
    console.log("앱 공지:", JSON.stringify((await (await J("GET", "/api/notice")).json()).notice?.text));
    const p2 = await browser.newPage();
    await p2.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p2.setCookie({ name: "bb_dev", value: "dev", url: base });
    await p2.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await p2.waitForFunction(() => !!window.__library3d, { timeout: 90000 });
    await p2.waitForFunction(() => document.body.innerText.includes("시험 공지"), { timeout: 30000 }).catch(() => {});
    await sleep(2500);
    await shot(p2, "home-notice");
    await p2.close();
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "지우기")?.click());
    await sleep(1500);
    console.log("공지 지운 뒤:", JSON.stringify((await (await J("GET", "/api/notice")).json()).notice));
    // 시험 회원 탈퇴 처리 (화면에서 아이디를 쳐서 확인)
    await tab("회원");
    await page.waitForSelector('input[aria-label="회원 찾기"]', { timeout: 20000 });
    await page.type('input[aria-label="회원 찾기"]', victim);
    await page.waitForFunction((h) => document.body.innerText.includes("@" + h), { timeout: 20000 }, victim);
    await btnIn(victim, "탈퇴 처리");
    await sleep(300);
    await typeIn(victim, "확인용 아이디", victim);
    await btnIn(victim, "모두 지우기");
    await page.waitForFunction(() => document.body.innerText.includes("탈퇴 처리했어요"), { timeout: 20000 });
    const gone = await J("GET", "/api/me", null, guestCookie + "; bb_out=1");
    console.log("탈퇴 처리 뒤 시험 회원:", gone.status);
    // 관리자가 아니면 404
    const notAdmin = await J("GET", "/api/admin/stats", null, "bb_dev=jimin");
    console.log("관리자 아닌 사람(지민) /api/admin/stats:", notAdmin.status);
    console.log(`캡처 ${n}장 → ${out}/`);
  } else if (scene === "econ") {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    p.on("pageerror", (e) => errors.push(String(e)));
    p.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(`[${m.type()}] ${m.text()}`));
    const btn = (t) => p.evaluate((x) => [...document.querySelectorAll("button")].find((b) => b.textContent?.replace(/\s+/g, " ").includes(x))?.click(), t);
    const me = () => p.evaluate(async () => (await (await fetch("/api/me")).json()));
    await p.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await p.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent?.includes("새로 가입해 보기") && Object.keys(b).some((k) => k.startsWith("__reactProps"))), { timeout: 30000 });
    await btn("새로 가입해 보기");
    await p.waitForFunction(() => location.pathname === "/welcome" && !!document.querySelector('input[aria-label="닉네임"]'), { timeout: 30000 });
    await sleep(800);
    // ① 가입
    await p.click('input[aria-label="닉네임"]');
    await p.keyboard.type("책먹는곰");
    await p.evaluate(() => [...document.querySelectorAll("label")].find((l) => l.textContent?.includes("모두 동의해요"))?.querySelector("input")?.click());
    await sleep(300);
    await shot(p, "econ-1-join");
    await btn("다음 — 나의 모습");
    await p.waitForFunction(() => !!window.__library3d, { timeout: 90000 });
    await sleep(1500);
    await p.waitForSelector('[role="tab"][aria-label="옷"]', { timeout: 30000 });
    await p.evaluate(() => document.querySelector('[role="tab"][aria-label="옷"]')?.click());
    await sleep(1500);
    await p.evaluate(() => document.querySelector('button[aria-label="남자아이"]')?.click());
    await sleep(1200);
    await shot(p, "econ-2-look");
    // ③ 내가 살 집 — 다락방 (꾸미기 창의 '결정')
    await btn("결정");
    await sleep(2500);
    await btn("다락방");
    await sleep(2500);
    await shot(p, "econ-3-house");
    console.log("집 고르기 3D:", JSON.stringify(await p.evaluate(() => window.__library3d?.debugState().house)));
    await btn("도서관 들어가기");
    await p.waitForFunction(() => location.pathname === "/", { timeout: 30000 });
    await p.waitForFunction(() => !!window.__library3d, { timeout: 90000 });
    await sleep(2500);
    const toast1 = await p.evaluate(() => [...document.querySelectorAll('[role="status"]')].map((e) => e.textContent?.trim()).filter(Boolean));
    console.log("홈 알림:", JSON.stringify(toast1));
    await shot(p, "econ-4-home");
    const m1 = await me();
    console.log("가입 뒤:", JSON.stringify({ handle: m1.handle, points: m1.points, house: m1.house, gender: m1.avatar?.gender, onboarded: m1.onboarded }));
    // 상점 — 리본 사기 → 배달 상자 → 열기
    await p.goto(`${base}/decorate`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await p.waitForFunction(() => !!window.__library3d, { timeout: 90000 });
    await sleep(2500);
    await p.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label")?.startsWith("리본 "))?.click());
    await sleep(500);
    await shot(p, "econ-5-ask");
    await btn("살게요");
    await p.waitForFunction(() => window.__library3d?.debugState().gifts > 0, { timeout: 20000 });
    await sleep(1500);
    await shot(p, "econ-6-box");
    const m2 = await me();
    console.log("산 뒤:", JSON.stringify({ points: m2.points, boxes: m2.deco.boxes, pending: m2.pending }));
    await btn("배달 상자 열기");
    await p.waitForFunction(() => window.__library3d?.debugState().gifts === 0, { timeout: 30000 });
    await sleep(2500);
    await shot(p, "econ-7-opened");
    const m3 = await me();
    console.log("연 뒤:", JSON.stringify({ points: m3.points, owned: m3.deco.owned, worn: m3.deco.worn, pending: m3.pending }));
    // 탈퇴 (시험 계정을 남기지 않는다)
    const del = await p.evaluate(async () => (await (await fetch("/api/me", { method: "DELETE" })).json()));
    console.log("시험 계정 탈퇴:", JSON.stringify(del.removed));
    await ctx.close();
    console.log(`캡처 ${n}장 → ${out}/`);
  } else if (scene === "hud") {
    // 입체 홈 — 옆 탭 → 옆 서랍(밀어서 닫기) · 크게 보기 ↔ 방 보기 · 정리 → 다 됐어요. 데이터는 안 바뀐다
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction(() => !!window.__library3d, { timeout: 90000 });
    await sleep(3500);
    await shot(page, "hud-idle");
    const center = (sel) =>
      page.$eval(sel, (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
    const tapAt = async (p) => page.touchscreen.tap(p.x, p.y);
    const byText = (text) =>
      page.evaluate((t) => {
        const el = [...document.querySelectorAll("button, a")].find((b) => b.textContent?.replace(/\s+/g, " ").trim().includes(t));
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, text);
    const noScroll = await page.evaluate(() => document.scrollingElement.scrollHeight <= window.innerHeight + 1);
    console.log("화면이 안 내려감:", noScroll);

    // 옆 탭 → 서랍
    await tapAt(await center('[aria-controls="home-drawer"]'));
    await sleep(700);
    const open1 = await page.$eval("#home-drawer", (el) => el.closest("[data-open]")?.getAttribute("data-open"));
    console.log("옆 탭 누름 → 서랍:", open1 === "1" ? "열림" : "안 열림!");
    await shot(page, "hud-drawer");
    const drawerText = await page.$eval("#home-drawer", (el) => el.innerText.replace(/\s+/g, " ").slice(0, 300));
    console.log("서랍 내용:", drawerText);
    // 왼쪽으로 밀어 닫기 (손가락)
    const d = await page.$eval("#home-drawer", (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width * 0.7, y: r.top + 300 };
    });
    const t = await page.touchscreen.touchStart(d.x, d.y);
    for (let i = 1; i <= 6; i++) {
      await t.move(d.x - i * 22, d.y + i);
      await sleep(25);
    }
    await t.end();
    await sleep(600);
    const open2 = await page.$eval("#home-drawer", (el) => el.closest("[data-open]")?.getAttribute("data-open"));
    console.log("왼쪽으로 밀기 → 서랍:", open2 === "0" ? "닫힘" : "안 닫힘!");

    // 크게 보기 ↔ 방 보기
    await tapAt(await byText("크게 보기"));
    await sleep(1600);
    console.log("크게 보기:", (await state(page)).shelfView ? "책장만" : "그대로!");
    await shot(page, "hud-shelf");
    await tapAt(await byText("방 보기"));
    await sleep(1400);
    console.log("방 보기:", (await state(page)).shelfView ? "그대로!" : "방으로");

    // 정리 → 다 됐어요 (순서는 안 바꾼다)
    await tapAt(await byText("정리"));
    await sleep(1400);
    console.log("정리:", (await state(page)).editing ? "정리 중" : "안 됨!");
    await shot(page, "hud-edit");
    await tapAt(await byText("다 됐어요"));
    await sleep(1200);
    console.log("다 됐어요:", (await state(page)).editing ? "안 끝남!" : "끝");
    await shot(page, "hud-after");
    console.log(`캡처 ${n}장 → ${out}/`);
  } else if (scene === "photo") {
    console.log("사진으로 아바타 만들기는 11-13 숨김 (src/lib/features.ts photoAvatar: false) — 켜면 꾸미기 창 '추천' 탭 맨 위에 나온다. 장면 없음");
  } else if (scene === "me") {
    // 아바타 꾸미기 — 고른 뒤 원래대로 되돌린다
    await page.goto(`${base}/me`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction(() => !!window.__library3d, { timeout: 90000 });
    const before = await page.evaluate(async () => (await (await fetch("/api/me")).json()).avatar);
    await sleep(1500);
    await shot(page, "me-idle");
    await clickText(page, "나의 모습 꾸미기");
    await page.waitForSelector('[role="dialog"][aria-label="나의 모습 꾸미기"]', { timeout: 20000 });
    await sleep(2500);
    for (const [tab, tile] of [
      ["머리", "털모자"],
      ["옷", "하늘"],
      ["옷", "안경"],
    ]) {
      await page.evaluate((l) => document.querySelector(`[role="tab"][aria-label="${l}"]`)?.click(), tab);
      await sleep(1500);
      await page.evaluate((l) => [...document.querySelectorAll(`[role="dialog"] button[aria-label="${l}"]`)].at(-1)?.click(), tile);
      await sleep(1200);
      await shot(page, `me-${tile}`);
    }
    await clickText(page, "그만두기");
    await sleep(800);
    await page.evaluate(async (a) => {
      await fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avatar: a }) });
    }, before);
    const after = await page.evaluate(async () => (await (await fetch("/api/me")).json()).avatar);
    console.log("되돌림:", JSON.stringify(after) === JSON.stringify(before) ? "같음" : `다름 ${JSON.stringify(after)}`);
    console.log(`캡처 ${n}장 → ${out}/`);
  }
  if (scene !== "home") throw new Error("__done__");

  await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
  const gl = await page.evaluate(() => !!document.createElement("canvas").getContext("webgl2"));
  console.log("webgl2:", gl);
  await page.waitForFunction(() => !!window.__library3d, { timeout: 90000 });
  await sleep(3500); // 책등 그림
  await shot(page, "idle");
  console.log("state:", JSON.stringify(await state(page)));
  if (only === "idle") process.exit(0);

  // 읽는 중인 책 하나 (없으면 첫 책)
  const lib = await page.evaluate(async () => (await (await fetch("/api/library")).json()).books.map((b) => ({ id: b.id, title: b.title, status: b.status })));
  const target = lib.find((b) => b.status === "reading") ?? lib[0];
  const pt = await page.evaluate((id) => {
    const p = window.__library3d.debugBookPoint(id);
    const r = document.querySelector("canvas").getBoundingClientRect();
    return p && { x: r.left + p.x, y: r.top + p.y };
  }, target.id);
  console.log("누를 책:", target.title, pt);
  await page.touchscreen.tap(pt.x, pt.y);
  for (let i = 0; i < 9; i++) {
    await sleep(420);
    await shot(page, `fetch-${i}`);
  }
  // 11-13: 읽는 동안엔 창 없이 — 펼친 책 + 머리 위 타이머 + 아래 작은 줄
  await page.waitForFunction(() => !!window.__library3d.debugState().reading, { timeout: 30000 });
  await sleep(900);
  await shot(page, "reading");
  console.log("펼친 책:", (await state(page)).openBook ? "폈음" : "안 폈음!");
  for (let i = 0; i < 6; i++) {
    await sleep(700);
    await shot(page, `reading-${i}`); // 한 장 넘김 (2.5~4.5초 뒤 첫 넘김)
  }
  console.log("state:", JSON.stringify(await state(page)));

  // 11-13: 읽는 동안엔 퀵메뉴가 아래로 숨고 ^ 손잡이만 — 누르면 읽기 줄(제목·책 덮기)
  const handle = await page.$eval('button[aria-label^="읽기 메뉴 열기"]', (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.touchscreen.tap(handle.x, handle.y);
  await sleep(700);
  await shot(page, "reading-bar");
  // 책 덮기 → 아바타 한마디 + 쪽 기록 칸
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "책 덮기")?.click());
  await sleep(500);
  await shot(page, "closing");

  // 기록 없이 꽂기 (데이터를 바꾸지 않는다)
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("기록 없이 꽂기"))?.click());
  for (let i = 0; i < 9; i++) {
    await sleep(450);
    await shot(page, `back-${i}`);
  }
  await page.waitForFunction(() => window.__library3d.debugState().running === 0, { timeout: 15000 });
  await sleep(500);
  await shot(page, "after");
  console.log("state:", JSON.stringify(await state(page)));

  // 아바타를 눌러 인사
  const ap = await page.evaluate(() => {
    const p = window.__library3d.debugAvatarPoint();
    const r = document.querySelector("canvas").getBoundingClientRect();
    return p && { x: r.left + p.x, y: r.top + p.y };
  });
  await page.touchscreen.tap(ap.x, ap.y);
  await sleep(450);
  await shot(page, "greet");
  console.log(`캡처 ${n}장 → ${out}/`);
} catch (e) {
  if (e.message !== "__done__") throw e;
} finally {
  await browser.close();
}
if (errors.length) {
  console.log("브라우저 오류·경고:");
  for (const e of [...new Set(errors)]) console.log(" -", e.slice(0, 300));
}
