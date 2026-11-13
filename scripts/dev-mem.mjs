// 임시 Mongo(이 PC 메모리)를 띄우고 그 주소로 next dev 를 켠다. 끄면 데이터도 사라진다.
//   npm run dev:mem   (포트 7000)
// 실제 Mongo 로 시험하려면 .env.local 에 MONGODB_URI 를 넣고 npm run dev.
// YES24_API_KEY 는 .env.local 에 있으면 Next 가 그대로 읽는다 (없으면 샘플 모드).
import { spawn } from "node:child_process";
import { MongoMemoryServer } from "mongodb-memory-server";

const mongod = await MongoMemoryServer.create({ instance: { dbName: "bookbook" } });
const uri = mongod.getUri();
console.log(`임시 Mongo 켜짐: ${uri}`);

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", process.env.PORT || "7000"], {
  stdio: "inherit",
  // 빈 값이 아니라 임시 주소를 넣어야 Next 가 .env.local 의 진짜 MONGODB_URI 로 채우지 않는다
  env: { ...process.env, MONGODB_URI: uri, MONGODB_DB: "bookbook", DEV_LOGIN: "1" },
});

// --seed: 서버가 뜨면 시험 데이터(나·지민·현우·엄마 책장, 책장 친구)를 넣는다
if (process.argv.includes("--seed")) {
  const base = `http://localhost:${process.env.PORT || "7000"}`;
  (async () => {
    for (let i = 0; i < 90; i++) {
      const ok = await fetch(`${base}/api/health`).then((r) => r.ok).catch(() => false);
      if (ok) break;
      await new Promise((r) => setTimeout(r, 1000)); // 서버가 뜰 때까지 1초마다 확인
    }
    spawn(process.execPath, ["scripts/seed-dev.mjs"], { stdio: "inherit", env: { ...process.env, SEED_BASE: base } });
  })();
}

let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  child.kill();
  await mongod.stop();
  process.exit(code);
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
child.on("exit", (c) => stop(c ?? 0));
