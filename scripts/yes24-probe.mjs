// YES24 키를 받으면 한 번 돌려서 확인할 것 (docs/02 6장, Phase 0 실측):
//  1) detail=Y 크기 필드(width/height/length) 중 두께가 어느 것인지
//  2) 책등(sideCover)·뒷표지가 없을 때 오는 대체 이미지의 모양 — 여러 책에서 크기·해시가 같으면 대체 이미지
//  3) 호출 한도 헤더(X-RateLimit-*)와 응답에 실제로 오는 필드 이름
//
//   npm run yes24:probe                      (기본: 민음사 데미안, 창비 소년이 온다)
//   npm run yes24:probe -- 9788937460449 …   (ISBN 을 직접 지정)
// 한 번 돌 때 상세 1회 + 이미지 최대 3장 / ISBN — 호출 한도(일 2만)에 비하면 아주 적다.
import crypto from "node:crypto";

const key = process.env.YES24_API_KEY?.trim();
if (!key) {
  console.error("YES24_API_KEY 가 .env.local 에 없어요 (developers.yes24.com 에서 발급)");
  process.exit(1);
}

const isbns = process.argv.slice(2).length ? process.argv.slice(2) : ["9788937460449", "9788936434120"];

for (const isbn of isbns) {
  const url = `https://apis.yes24.com/v1/goods/itemDetail?${new URLSearchParams({ searchType: "ISBN13", query: isbn, detail: "Y" })}`;
  const res = await fetch(url, { headers: { "X-Api-Key": key, Accept: "application/json" } });
  const limits = Object.fromEntries([...res.headers].filter(([k]) => /^x-ratelimit|^retry-after$/i.test(k)));
  const body = await res.json().catch(() => null);
  const d = body?.data;
  const item = (Array.isArray(d?.items) && d.items[0]) || (Array.isArray(d?.data) ? d.data[0] : d?.data) || null;

  console.log(`\n== ${isbn} → HTTP ${res.status} ${body?.errorCode ?? ""}`);
  console.log("한도 헤더:", limits);
  if (!item) {
    console.log("응답:", JSON.stringify(body)?.slice(0, 600));
    continue;
  }
  const { title, author, pages, width, height, length, weight, itemFormat, goodsSortNm } = item;
  console.log({ title, author, pages, width, height, length, weight, itemFormat, goodsSortNm });

  for (const k of ["cover", "sideCover", "backCover"]) {
    const u = item[k];
    if (!u) {
      console.log(`${k}: 없음`);
      continue;
    }
    try {
      const img = await fetch(u);
      const buf = Buffer.from(await img.arrayBuffer());
      const sha = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 12);
      console.log(`${k}: ${img.status} ${img.headers.get("content-type")} ${buf.length}B sha1:${sha}  ${u}`);
    } catch (e) {
      console.log(`${k}: 못 받음 (${e instanceof Error ? e.message : e})  ${u}`);
    }
  }
  console.log("응답 필드:", Object.keys(item).join(", "));
}
