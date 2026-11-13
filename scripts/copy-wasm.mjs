// 바코드 판독기(zxing-wasm)의 .wasm 파일을 public/wasm 으로 복사 — 외부 CDN 없이 우리 앱이 직접 준다.
// npm run dev / dev:mem / build 전에 자동으로 돈다 (package.json 의 pre 스크립트). public/wasm 은 git 에 안 올린다.
import { copyFileSync, mkdirSync, statSync } from "node:fs";

const from = "node_modules/zxing-wasm/dist/reader/zxing_reader.wasm";
const to = "public/wasm/zxing_reader.wasm";
mkdirSync("public/wasm", { recursive: true });
copyFileSync(from, to);
console.log(`바코드 판독기 준비: ${to} (${Math.round(statSync(to).size / 1024)}KB)`);
