// YES24 Open API 호출 — 서버에서만. 키(YES24_API_KEY)가 브라우저 번들로 새면 안 된다 (약관·FAQ).
// 키가 없으면: 개발 중엔 샘플 모드(fixtures), 운영에선 오류.
// 캐시는 YES24 '원본 응답'을 24시간 — 변환(BookCandidate)은 꺼낼 때마다 해서, 변환 코드를 고치면 바로 반영된다.
// 레퍼런스: https://github.com/yes24-AX/yes24-openapi-samples/blob/main/docs/api-reference.md

import "server-only";
import { cached } from "@/lib/server/cache";
import { getDb } from "@/lib/server/db";
import { applySpine, fromYes24Item, isReadable, itemsOf, rankByTitle, type BookCandidate, type BookSource } from "./candidate";
import { mockDetail, mockSearch } from "./fixtures";
import { probeSpine } from "./spine";

const BASE = "https://apis.yes24.com/v1";
const TIMEOUT_MS = 8000;
const CACHE_VER = "v1"; // 원본 응답 모양을 다르게 저장하게 되면 올린다

export type Yes24ErrorCode = "NO_KEY" | "AUTH" | "RATE_LIMIT" | "BAD_REQUEST" | "UPSTREAM" | "NETWORK";

export class Yes24Error extends Error {
  constructor(
    public code: Yes24ErrorCode,
    message: string,
    public retryAfterSec?: number,
  ) {
    super(message);
  }
}

export function yes24Mode(): BookSource {
  if (process.env.YES24_API_KEY?.trim()) return "yes24";
  if (process.env.NODE_ENV === "production") throw new Yes24Error("NO_KEY", "YES24_API_KEY 가 없어요");
  return "mock";
}

// 검색 못 함·상품 없음은 오류가 아니라 '0건'
const NOT_FOUND = new Set(["SEARCH_001", "GOODS_001", "GOODS_002"]);

let quotaAt = 0;
/** 하루 한도·남은 수 (x-ratelimit-*-day) — 관리자 화면용. 1분에 한 번만 쓴다, 실패해도 그냥 둔다 */
function noteQuota(h: Headers) {
  const limit = Number(h.get("x-ratelimit-limit-day"));
  const remaining = Number(h.get("x-ratelimit-remaining-day"));
  if (!Number.isFinite(remaining) || Date.now() - quotaAt < 60_000) return;
  quotaAt = Date.now();
  void getDb()
    .then((db) =>
      db
        .collection<{ _id: string; limit: number | null; remaining: number; at: Date }>("meta")
        .updateOne({ _id: "yes24Quota" }, { $set: { limit: Number.isFinite(limit) ? limit : null, remaining, at: new Date() } }, { upsert: true }),
    )
    .catch(() => {});
}

async function call(path: string, params: Record<string, string>): Promise<unknown | null> {
  const url = `${BASE}${path}?${new URLSearchParams(params)}`; // 한글 검색어는 반드시 퍼센트 인코딩 (URLSearchParams 가 해 준다)
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "X-Api-Key": process.env.YES24_API_KEY!.trim(), Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    throw new Yes24Error("NETWORK", `YES24 연결 실패: ${e instanceof Error ? e.message : e}`);
  }

  noteQuota(res.headers);
  if (res.status === 429) {
    const ra = Number(res.headers.get("retry-after"));
    throw new Yes24Error("RATE_LIMIT", "YES24 호출 한도를 넘었어요", Number.isFinite(ra) ? ra : undefined);
  }
  if (res.status === 401) throw new Yes24Error("AUTH", "YES24 키가 없거나 틀렸어요");

  let body: { success?: boolean; data?: unknown; errorCode?: string | null; message?: string } | null = null;
  try {
    body = await res.json();
  } catch {
    // 본문이 JSON 이 아니면 아래 상태 코드로 판단
  }
  if (body?.errorCode && NOT_FOUND.has(body.errorCode)) return null;
  if (res.status === 404) return null;
  if (res.status === 400) throw new Yes24Error("BAD_REQUEST", body?.message || "YES24 요청 값이 틀렸어요");
  if (!res.ok || body?.success === false) {
    throw new Yes24Error("UPSTREAM", `YES24 오류 ${res.status} ${body?.errorCode ?? ""} ${body?.message ?? ""}`.trim());
  }
  return body?.data ?? null;
}

/** 원본 응답 24시간 캐시. 오류는 캐시하지 않는다. */
function callCached(path: string, params: Record<string, string>) {
  return cached(`yes24:${CACHE_VER}:${path}?${new URLSearchParams(params)}`, () => call(path, params));
}

export type SearchResult = { source: BookSource; items: BookCandidate[]; totalCount: number | null; cached: boolean };

/** sort: RELATION = 정확도순(검색창) · DEFAULT = 인기순(같은 작가의 다른 책 추천 — 대표작이 먼저) */
export async function searchBooks(query: string, page = 1, pageSize = 20, sort: "RELATION" | "DEFAULT" = "RELATION"): Promise<SearchResult> {
  const source = yes24Mode();
  if (source === "mock") {
    const items = mockSearch(query)
      .map((r) => fromYes24Item(r, "mock"))
      .filter((b): b is BookCandidate => b !== null);
    return { source, items, totalCount: items.length, cached: false };
  }
  const { value: data, hit } = await callCached("/goods/itemList", {
    query,
    category: "BOOK", // 국내도서
    sort,
    page: String(page),
    pageSize: String(pageSize),
    detail: "N", // 목록은 가볍게, 쪽수·크기·책등은 고를 때 상세로
  });
  const items = itemsOf(data)
    .map((r) => fromYes24Item(r))
    .filter((b): b is BookCandidate => b !== null && isReadable(b)); // 클래스24 같은 책 아닌 상품 빼기
  const total = data && typeof data === "object" ? Number((data as { totalCount?: unknown }).totalCount) : NaN;
  // 정확도순 1위가 딴 책일 때가 있어 제목이 맞는 책을 위로 (예: '이방인 카뮈' → 『필사의 힘』이 1위)
  return { source, items: sort === "RELATION" ? rankByTitle(items, query) : items, totalCount: Number.isFinite(total) ? total : null, cached: hit };
}

export type DetailResult = { source: BookSource; item: BookCandidate | null; cached: boolean };

async function detailBy(searchType: "ISBN13" | "ItemId", query: string): Promise<{ item: BookCandidate | null; cached: boolean }> {
  const { value: data, hit } = await callCached("/goods/itemDetail", { searchType, query, detail: "Y" });
  const first = itemsOf(data)[0];
  const item = first ? fromYes24Item(first) : null;
  // 책등 한 장을 재서 대체 그림을 가려내고, 진짜면 비율로 두께를 바꾼다 (검색 목록에서는 안 함 — 20장씩 받게 되므로)
  if (!item?.sideCoverUrl) return { item, cached: hit };
  return { item: applySpine(item, await probeSpine(item.sideCoverUrl)), cached: hit };
}

export async function getBookByIsbn(isbn13: string): Promise<DetailResult> {
  const source = yes24Mode();
  if (source === "mock") return { source, item: fromYes24Item(mockDetail(isbn13), "mock"), cached: false };
  return { source, ...(await detailBy("ISBN13", isbn13)) };
}

/** 검색 결과의 ISBN 이 상세에서 안 나오는 책이 있어서(예: 9780319841099) 상품 번호로 다시 찾을 때 */
export async function getBookByItemId(itemId: number): Promise<DetailResult> {
  const source = yes24Mode();
  if (source === "mock") {
    return { source, item: null, cached: false };
  }
  return { source, ...(await detailBy("ItemId", String(itemId))) };
}
