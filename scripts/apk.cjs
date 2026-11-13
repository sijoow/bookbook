/* eslint-disable @typescript-eslint/no-require-imports -- 빌드 도구(bubblewrap)를 경로로 불러오는 CommonJS 스크립트 */
// bookbook 안드로이드 앱(APK) — TWA: 배포한 사이트를 크롬으로 띄우는 껍데기 (구글 로그인·입체 화면이 크롬 그대로 돈다).
// 11-13 사용자: "최종 5시 전후로 apk 파일까지 만드는 게 오늘 목표"
// 도구는 이 PC 의 maeum-android 것(JDK 17 · 안드로이드 SDK · @bubblewrap/core 1.27)을 빌려 쓴다 — 거기 서명 키(keys/)는 건드리지 않는다.
//   node scripts/apk.cjs key              서명 키를 (처음 한 번) 만들고 SHA-256 지문을 보여 준다 → src/app/.well-known/assetlinks.json/route.ts
//   node scripts/apk.cjs https://<주소>   그 사이트의 웹 매니페스트로 release/bookbook.apk (+ .zip — 카톡으로 보낼 때)
//   node scripts/apk.cjs http://<PC IP>:7000 --test   같은 와이파이 폰에서 미리 보기 (주소창이 보이고, 구글 로그인은 안 됨)
// 서명 키·비밀번호(keys.json)는 저장소 밖 KEYDIR 에만 — 화면에 찍지 않는다. 키를 잃으면 다음 APK 가 기존 앱 위에 안 깔린다(백업할 것).
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const TOOLS = "C:/Users/YOGIBO~1/maeum-android";
const { Config, JdkHelper, AndroidSdkTools, TwaManifest, TwaGenerator, KeyTool, GradleWrapper, ConsoleLog } = require(path.join(TOOLS, "node_modules", "@bubblewrap", "core"));

// 윈도우: Bubblewrap 은 실행 경로 키를 "Path" 로 쓴다 — "PATH" 와 갈라지면 keytool 을 못 찾는다
if (process.platform === "win32") {
  const p = process.env.PATH || process.env.Path || "";
  delete process.env.PATH;
  process.env.Path = p;
}

// 경로에 띄어쓰기("Yogibo Design")가 있으면 안드로이드 도구(zipalign·apksigner)가 깨진다 — 짧은 경로(YOGIBO~1)
const KEYDIR = "C:/Users/YOGIBO~1/bookbook-apk"; // 서명 키 (오래 남는 곳)
const B = "C:/Users/YOGIBO~1/bookbook-apk/build"; // gradle 프로젝트 (지워져도 됨)
const PACKAGE_ID = "kr.bookbook.app";
const ALIAS = "bookbook";
const KEYSTORE = path.join(KEYDIR, "bookbook.keystore");
const KEYS_JSON = path.join(KEYDIR, "keys.json");
const PROJECT = path.join(B, "project");
const OUT = path.join(B, "out");
const RELEASE = path.join(__dirname, "..", "release");
const VERSION = { code: 3, name: "0.1.2-beta" }; // 11-13 오후: 가로 화면 허용 (다시 깔 때 번호를 올린다)

const randomPassword = () => crypto.randomBytes(18).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 20);

(async () => {
  const log = new ConsoleLog("apk");
  const config = new Config(path.join(TOOLS, "jdk"), path.join(TOOLS, "sdk"));
  const jdk = new JdkHelper(process, config);
  const keyTool = new KeyTool(jdk, log);

  fs.mkdirSync(KEYDIR, { recursive: true });
  if (!fs.existsSync(KEYS_JSON)) {
    const pass = randomPassword(); // PKCS12 는 키 비밀번호가 저장소 비밀번호와 같아야 한다
    fs.writeFileSync(KEYS_JSON, JSON.stringify({ storePass: pass, keyPass: pass }, null, 2));
  }
  const { storePass, keyPass } = JSON.parse(fs.readFileSync(KEYS_JSON, "utf8"));
  if (!fs.existsSync(KEYSTORE)) {
    await keyTool.createSigningKey({
      path: KEYSTORE,
      alias: ALIAS,
      password: storePass,
      keypassword: keyPass,
      fullName: "bookbook",
      organizationalUnit: "bookbook",
      organization: "bookbook",
      country: "KR",
    });
  }
  const info = await keyTool.keyInfo({ path: KEYSTORE, alias: ALIAS, password: storePass, keypassword: keyPass });
  const sha256 = info.fingerprints.get("SHA256");
  if (process.argv[2] === "key") {
    console.log("KEY", PACKAGE_ID, sha256);
    return;
  }

  const SITE = (process.argv[2] || "").replace(/\/$/, "");
  const test = process.argv.includes("--test");
  if (!/^https:\/\//.test(SITE) && !(test && /^http:\/\//.test(SITE))) throw new Error("쓰는 법: node scripts/apk.cjs https://<사이트>  (미리 보기: http://<PC IP>:7000 --test)");
  const sdk = await AndroidSdkTools.create(process, config, jdk, log);
  if (!(await sdk.checkBuildTools())) throw new Error("build-tools 가 없다");

  const twa = await TwaManifest.fromWebManifest(`${SITE}/manifest.webmanifest`);
  twa.packageId = PACKAGE_ID;
  twa.launcherName = "bookbook";
  twa.startUrl = "/";
  twa.signingKey = { path: KEYSTORE, alias: ALIAS };
  twa.appVersionCode = VERSION.code;
  twa.appVersionName = test ? `${VERSION.name}-test` : VERSION.name;
  twa.orientation = "any"; // 11-13 사용자: 가로로도 (세로·가로 돌리는 대로)
  twa.display = "fullscreen"; // 11-13 사용자: 시계(상태 표시줄)도 안 보이게 전체 화면
  twa.fallbackType = "customtabs";
  twa.enableNotifications = false;
  twa.minSdkVersion = 24;
  twa.generatorApp = "bubblewrap-core-script";
  const problem = twa.validate();
  if (problem) throw new Error(`twa-manifest: ${problem}`);
  console.log("TWA", JSON.stringify({ name: twa.name, launcherName: twa.launcherName, iconUrl: twa.iconUrl, host: twa.host }));

  fs.rmSync(PROJECT, { recursive: true, force: true });
  await new TwaGenerator().createTwaProject(PROJECT, twa, log);
  await twa.saveToFile(path.join(PROJECT, "twa-manifest.json"));
  require("./apk-launcher.cjs")(path.join(PROJECT, "app", "src", "main", "java", ...PACKAGE_ID.split("."), "LauncherActivity.java"));
  fs.appendFileSync(path.join(PROJECT, "gradle.properties"), "\norg.gradle.daemon=false\n");
  if (process.platform === "win32") process.env.Path = PROJECT + ";" + process.env.Path;

  const gradle = new GradleWrapper(process, sdk, PROJECT);
  await gradle.assembleRelease();
  fs.mkdirSync(OUT, { recursive: true });
  const unsigned = path.join(PROJECT, "app", "build", "outputs", "apk", "release", "app-release-unsigned.apk");
  const aligned = path.join(OUT, "app-release-unsigned-aligned.apk");
  const name = test ? "bookbook-test.apk" : "bookbook.apk";
  const apk = path.join(OUT, name);
  await sdk.zipalign(unsigned, aligned);
  await sdk.apksigner(KEYSTORE, storePass, ALIAS, keyPass, aligned, apk);
  fs.rmSync(aligned, { force: true });
  // 저장소 release/ 로 (+ zip: 갤럭시 '내 파일'은 카톡으로 받은 .apk 를 '파일이 없습니다'로만 보여 준다 — 압축해서 보낸다)
  fs.mkdirSync(RELEASE, { recursive: true });
  const dest = path.join(RELEASE, name);
  fs.copyFileSync(apk, dest);
  const zip = dest.replace(/\.apk$/, ".zip");
  fs.rmSync(zip, { force: true });
  execFileSync("tar", ["-a", "-cf", path.basename(zip), name], { cwd: RELEASE });
  console.log("DONE", dest, PACKAGE_ID, sha256, SITE);
})().catch((e) => {
  console.error("FAILED", e && e.stack ? e.stack : e);
  process.exit(1);
});
