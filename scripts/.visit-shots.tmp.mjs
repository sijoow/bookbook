// 친구 집 세 곳 (화면 가득) + 지민이 책 보여 주기 — 데이터는 안 바뀐다 (놀러 온 기록만 3시간에 한 번)
import puppeteer from "puppeteer-core";
import fs from "node:fs";
const out = "shots/visit2";
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true, args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--use-angle=swiftshader", "--enable-webgl"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.setCookie({ name: "bb_dev", value: "dev", url: "http://localhost:7000" });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
for (const who of ["jimin", "hyunwoo", "mom"]) {
  await page.goto(`http://localhost:7000/u/${who}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => !!window.__library3d, { timeout: 90000 });
  await page.waitForFunction(() => window.__library3d.debugState().running === 0, { timeout: 60000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 4000));
  await page.screenshot({ path: `${out}/${who}.png` });
  console.log(who, JSON.stringify({ house: (await page.evaluate(() => window.__library3d.debugState())).house }));
}
// 지민 — 책 하나 누르면 지민이 꺼내 와 보여 준다 → 카드
await page.goto(`http://localhost:7000/u/jimin`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForFunction(() => !!window.__library3d, { timeout: 90000 });
await page.waitForFunction(() => window.__library3d.debugState().running === 0, { timeout: 60000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 2500));
const id = await page.evaluate(() => window.__library3d.debugState().books[0]);
const pt = await page.evaluate((bid) => { const p = window.__library3d.debugBookPoint(bid); const r = document.querySelector("canvas").getBoundingClientRect(); return p && { x: r.left + p.x, y: r.top + p.y }; }, id);
await page.touchscreen.tap(pt.x, pt.y);
await page.waitForFunction(() => window.__library3d.debugState().running === 0 && window.__library3d.debugState().held, { timeout: 60000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: `${out}/jimin-show.png` });
console.log(errs.length ? errs.join("\n") : "오류 없음");
await browser.close();
