// YES24 응답 한 건 → 우리 앱의 '책 후보'(BookCandidate). 서버·클라이언트 어디서나 쓰는 순수 함수.
// 응답 모양은 11-12 실측 기준(docs/01 3-1)이지만, 필드가 빠지거나 타입이 바뀌어도 죽지 않게 하나씩 꺼낸다.

import { toIsbn13 } from "../books/isbn";
import type { ImageSize } from "../books/imageSize";
import { isPlaceholderSpine, resolveThickness, thicknessFromSpine, type ThicknessSource } from "../books/thickness";
import { normalizeTitle, workKey } from "../books/workKey";

export type BookSource = "yes24" | "mock";

export type BookCandidate = {
  source: BookSource;
  itemId: number | null; // YES24 상품 번호
  isbn13: string | null;
  workKey: string;
  title: string;
  subTitle: string | null;
  author: string | null;
  publisher: string | null;
  publishDate: string | null; // YYYY-MM-DD
  pages: number | null;
  thicknessMm: number | null;
  thicknessSource: ThicknessSource | null;
  // YES24 원래 값. width = 가로, height = 두께(반올림 많음), length = 세로 — 필드 이름과 뜻이 다르다
  dims: { width: number | null; height: number | null; length: number | null; weight: number | null };
  coverUrl: string | null;
  sideCoverUrl: string | null; // 책등 — 상세 조회에서 '이미지 준비중' 대체 그림이면 null 로 바꾼다
  spinePx: ImageSize | null; // 진짜 책등 이미지의 픽셀 크기 (탑 그릴 때 비율)
  backCoverUrl: string | null;
  category: string | null; // goodsSortNm, 예: 국내도서-소설/시/희곡
  goodsType: string | null; // 도서 · 만화 · 잡지 …
  yes24Rating: number | null; // YES24 회원 별점 (10점 만점)
  link: string | null; // YES24 상품 상세 (애드온이면 addOnLink) — 화면에 꼭 보여 줘야 한다
  intro: string | null; // 책 소개 (저장하지 않고 보여 주기만)
};

type Raw = Record<string, unknown>;

const str = (v: unknown): string | null => {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
};

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** yyyyMMdd · yyyy-MM-dd · yyyy.MM.dd → YYYY-MM-DD */
export function toIsoDate(v: unknown): string | null {
  const s = str(v)?.replace(/[.\/]/g, "-");
  if (!s) return null;
  const m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function fromYes24Item(raw: Raw, source: BookSource = "yes24"): BookCandidate | null {
  const title = str(raw.title);
  if (!title) return null;
  const author = str(raw.author);
  const pages = num(raw.pages);
  const dims = {
    width: num(raw.width),
    height: num(raw.height),
    length: num(raw.length),
    weight: num(raw.weight),
  };
  const thick = resolveThickness({ dims: [dims.width, dims.height, dims.length], pages });
  const detail = (raw.contentDetail && typeof raw.contentDetail === "object" ? raw.contentDetail : {}) as Raw;
  const isbn13 = toIsbn13(str(raw.isbn13) ?? "") ?? toIsbn13(str(raw.isbn10) ?? "");

  return {
    source,
    itemId: num(raw.itemId),
    isbn13,
    workKey: workKey(title, author),
    title,
    subTitle: str(raw.subTitle),
    author,
    publisher: str(raw.publisher),
    publishDate: toIsoDate(raw.publishDate),
    pages,
    thicknessMm: thick?.mm ?? null,
    thicknessSource: thick?.source ?? null,
    dims,
    coverUrl: str(raw.cover),
    sideCoverUrl: str(raw.sideCover),
    spinePx: null,
    backCoverUrl: str(raw.backCover),
    category: str(raw.goodsSortNm),
    goodsType: str(raw.goodsType),
    yes24Rating: num(raw.starScore),
    link: str(raw.addOnLink) ?? str(raw.mobileLink) ?? str(raw.link), // 애드온 미신청이면 addOnLink 는 ""
    intro: str(detail.bookIntroduction) ?? str(detail.bookSummary),
  };
}

/** 책등 이미지를 잰 결과를 반영: 대체 그림이면 책등을 지우고, 진짜면 비율로 두께를 바꾼다. 못 쟀으면(null) 그대로. */
export function applySpine(b: BookCandidate, px: ImageSize | null): BookCandidate {
  if (!b.sideCoverUrl || !px) return b;
  if (isPlaceholderSpine(px)) return { ...b, sideCoverUrl: null, spinePx: null };
  const mm = thicknessFromSpine(px, b.dims.length);
  return mm != null ? { ...b, spinePx: px, thicknessMm: mm, thicknessSource: "spine" } : { ...b, spinePx: px };
}

/**
 * 검색어와 제목이 맞는 책을 위로 (안정 정렬). YES24 정확도순 1위가 딴 책일 때가 있어서
 * ('이방인 카뮈' → 『필사의 힘: 카뮈 이방인 따라쓰기』). 0 = 제목이 검색어와 같음, 1 = 검색어 안에 제목이 통째로 있음, 2 = 나머지
 */
export function rankByTitle<T extends { workKey: string }>(items: T[], query: string): T[] {
  const q = normalizeTitle(query);
  const rank = (b: T) => {
    const t = b.workKey.split("|")[0];
    if (!t) return 2;
    if (t === q) return 0;
    return q.includes(t) ? 1 : 2;
  };
  return items
    .map((b, i) => ({ b, i, r: rank(b) }))
    .sort((x, y) => x.r - y.r || x.i - y.i)
    .map((x) => x.b);
}

// 국내도서로 검색해도 섞여 오는 책 아닌 상품
const NOT_BOOK = new Set(["클래스24", "도서관련"]);
export const isReadable = (b: BookCandidate) => !b.goodsType || !NOT_BOOK.has(b.goodsType);

/** 응답의 data 에서 상품 배열을 꺼낸다 — 목록·상세 모두 data.items (실측), 단건 래퍼는 data.data */
export function itemsOf(data: unknown): Raw[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Raw;
  if (Array.isArray(d.items)) return d.items as Raw[];
  if (Array.isArray(d.data)) return d.data as Raw[];
  if (d.data && typeof d.data === "object") return [d.data as Raw];
  return [];
}

export const ATTRIBUTION = { text: "도서 정보·이미지 제공: YES24", url: "https://www.yes24.com" } as const;
