// YES24 응답 일시 캐시 — 같은 검색어·ISBN 을 24시간 안에 다시 부르지 않는다 (일 2만 회 한도 아끼기).
// Mongo 가 있으면 apiCache(TTL 인덱스), 없거나 잠깐 안 되면 이 프로세스 메모리. 약관상 '일시 저장'만 허용이라 24시간이 상한.
// 오류는 캐시하지 않는다. 샘플 모드는 부르는 쪽에서 캐시를 건너뛴다.

import "server-only";
import type { Collection } from "mongodb";
import { CACHE_TTL_SEC, getDb, hasDb, type ApiCacheDoc } from "./db";

const MEM_MAX = 500;
const mem = new Map<string, { body: unknown; exp: number }>();

function memGet(key: string): unknown | undefined {
  const hit = mem.get(key);
  if (!hit) return undefined;
  if (hit.exp < Date.now()) {
    mem.delete(key);
    return undefined;
  }
  return hit.body;
}

function memSet(key: string, body: unknown, ttlMs = CACHE_TTL_SEC * 1000): void {
  if (mem.size >= MEM_MAX) mem.delete(mem.keys().next().value!);
  mem.set(key, { body, exp: Date.now() + ttlMs });
}

export async function cached<T>(key: string, load: () => Promise<T>): Promise<{ value: T; hit: boolean }> {
  const fromMem = memGet(key);
  if (fromMem !== undefined) return { value: fromMem as T, hit: true };

  let col: Collection<ApiCacheDoc> | null = null;
  if (hasDb()) {
    try {
      col = (await getDb()).collection<ApiCacheDoc>("apiCache");
      const doc = await col.findOne({ _id: key });
      const age = doc ? Date.now() - doc.createdAt.getTime() : Infinity;
      // TTL 인덱스는 1분 간격으로 지우므로 만료 직후 문서가 남아 있을 수 있다 → 나이를 직접 확인
      if (doc && age < CACHE_TTL_SEC * 1000) {
        memSet(key, doc.body, CACHE_TTL_SEC * 1000 - age);
        return { value: doc.body as T, hit: true };
      }
    } catch (e) {
      col = null;
      console.warn("[cache] DB 캐시를 못 써서 메모리로만:", e instanceof Error ? e.message.split("\n")[0] : e);
    }
  }

  const value = await load();
  memSet(key, value);
  if (col) {
    await col
      .updateOne({ _id: key }, { $set: { body: value, createdAt: new Date() } }, { upsert: true })
      .catch((e) => console.warn("[cache] DB 캐시 저장 실패:", e instanceof Error ? e.message.split("\n")[0] : e));
  }
  return { value, hit: false };
}
