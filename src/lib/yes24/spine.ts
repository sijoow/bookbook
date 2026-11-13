// 책등 이미지의 픽셀 크기를 잰다 — 대체 그림('이미지 준비중', 280×400) 가려내기 + 비율로 두께 계산.
// 책을 고를 때(상세 조회) 한 장만. 이미지는 저장하지 않고 크기만 24시간 캐시한다.
// 실패해도 상세 조회는 그대로 성공해야 하므로 오류는 null 로 삼킨다.

import "server-only";
import { imageSize, type ImageSize } from "@/lib/books/imageSize";
import { cached } from "@/lib/server/cache";

const TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024;

export async function probeSpine(url: string): Promise<ImageSize | null> {
  try {
    const { value } = await cached<ImageSize | null>(`spine:${url}`, async () => {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
      if (!res.ok) return null;
      const buf = new Uint8Array(await res.arrayBuffer());
      return buf.byteLength > MAX_BYTES ? null : imageSize(buf);
    });
    return value;
  } catch (e) {
    console.warn("[spine] 책등 이미지를 못 쟀어요:", e instanceof Error ? e.message : e);
    return null;
  }
}
