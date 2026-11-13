// 390px 휴대폰 화면 캡처 (설치된 Edge 사용). 화면을 바꾸면 이걸로 확인한다.
//   npm run shot            (dev 서버가 7000 에 떠 있어야 한다)
//   node scripts/shot.mjs [url] [출력폴더]
// 지금(Phase 0)은 개발 확인 화면: 검색 → 상세 → 모르는 ISBN 순서로 누르고 찍는다.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const base = process.argv[2] || "http://localhost:7000";
const out = process.argv[3] || "shots";
fs.mkdirSync(out, { recursive: true });

const edge = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find((p) => fs.existsSync(p));
if (!edge) throw new Error("Edge 를 못 찾았어요");

const browser = await puppeteer.launch({ executablePath: edge, headless: true });
const errors = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  // dev 서버는 HMR 연결이 계속 열려 있어 networkidle 이 오지 않는다 → load 뒤 React 가 버튼에 붙었는지(하이드레이션) 확인하고 누른다
  await page.goto(base + "/dev/books", { waitUntil: "load" });
  await page.waitForFunction(() => {
    const b = document.querySelector("form button");
    return !!b && Object.keys(b).some((k) => k.startsWith("__reactProps"));
  });

  // 1) 검색 (기본 검색어 데미안)
  await page.click("form:nth-of-type(1) button");
  await page.waitForSelector("ul li");
  await page.screenshot({ path: path.join(out, "p0-01-search.png"), fullPage: true });

  // 2) 첫 결과 상세 (쪽수·두께·크기)
  await page.click("ul li button");
  await page.waitForFunction(() => document.body.innerText.includes("두께"));
  await page.screenshot({ path: path.join(out, "p0-02-detail.png"), fullPage: true });

  // 3) 모르는 ISBN (바코드로 찍은 책이 쪽수 없이 오는 경우)
  await page.click("form:nth-of-type(2) input"); // 사람처럼: 칸을 누르고 Ctrl+A 로 지우고 입력
  await page.keyboard.down("Control");
  await page.keyboard.press("a");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("9780306406157");
  await page.click("form:nth-of-type(2) button");
  await page.waitForFunction(() => document.body.innerText.includes("사용자에게 묻기"));
  await page.screenshot({ path: path.join(out, "p0-03-unknown-isbn.png"), fullPage: true });

  console.log(`캡처 3장 → ${out}/`);
} finally {
  await browser.close();
}
if (errors.length) {
  console.log("브라우저 오류:");
  for (const e of errors) console.log(" -", e);
  process.exitCode = 1;
}
