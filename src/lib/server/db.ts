// Mongo 연결과 컬렉션 모양 (docs/02 4장). DB 이름 기본값 bookbook.
// 개발 중에는 `npm run dev:mem` 이 임시 Mongo 를 띄워 MONGODB_URI 를 넣어 준다.
// YES24 약관(체계적 DB 축적 금지) 때문에 전역 책 카탈로그는 두지 않는다 — 책 정보는 userBooks 에 기록용 최소 필드만.

import "server-only";
import { MongoClient, type Db, type ObjectId } from "mongodb";
import type { ThicknessSource } from "@/lib/books/thickness";
import type { AvatarConfig } from "@/lib/avatar/config";
import type { BookStatus } from "@/lib/books/types";
import type { Deco } from "@/lib/deco/items";
import type { HouseId } from "@/lib/house/houses";

export class NoDbError extends Error {
  constructor() {
    super("MONGODB_URI 가 없어요");
  }
}

export type { BookStatus };

export type UserDoc = {
  _id: ObjectId;
  nickname: string;
  handle: string; // 초대·검색용 아이디 (unique)
  avatarUrl?: string | null;
  deco?: Deco; // 꾸미기 — 가진 물건·배달 상자·하고 있는 소품·놓은 물건 (lib/deco/items, 옛 문서는 opened 수)
  points?: number; // 포인트 잔액 (pointLog 의 합 — 바뀔 때마다 $inc)
  readingNow?: { bookId: string; title: string; coverUrl: string | null; since: Date } | null; // 지금 읽는 책 (책마을 — 친구에게 '읽는 중', 3시간 지나면 끈 것으로)
  pointsInit?: boolean; // 옛 계정 포인트 채우기(다 읽은 책)를 마쳤나
  house?: HouseId; // 내가 살 집 (lib/house/houses, 없으면 모눈 방)
  passwordHash?: string; // 일반 회원 비밀번호 — scrypt 로 바꾼 것만 (lib/auth/password)
  loginLock?: { fails: number; until: Date | null }; // 비밀번호 5번 틀리면 15분 잠금
  googleSub?: string; // 구글 계정 고유 번호 (unique) — 로그인 열쇠
  email?: string; // 구글 이메일 (본인·관리자만 본다)
  lastSeenAt?: Date; // 마지막 접속 (한 시간에 한 번 고침)
  suspendedAt?: Date | null; // 관리자가 정지 — 로그인·API 막힘
  suspendReason?: string;
  avatar?: AvatarConfig; // 나만의 아바타 (없으면 아이디로 정한 기본값 — lib/avatar/config readAvatar)
  universeName: string; // 예: "지민의 우주"
  goalCm: number; // 기본 100
  visibility: "friends" | "private";
  auth: Array<{ provider: string; providerId: string }>; // 개발용 로그인은 { provider: "dev" }
  bio?: string; // 한 줄 소개 (마이페이지)
  onboarded?: boolean; // 처음 가입(약관·14세·닉네임)을 마쳤나 — 없으면 옛 계정이라 마친 것으로 본다
  agreedAt?: Date; // 약관 동의한 때
  createdAt: Date;
};

export type UserBookDoc = {
  _id: ObjectId;
  userId: ObjectId;
  isbn13: string | null; // 반드시 저장 — 출처가 바뀌어도 다시 찾는 열쇠
  workKey: string; // 판본 무관 같은 책 판정 (lib/books/workKey)
  yes24ItemId: number | null;
  title: string;
  author: string | null;
  publisher: string | null;
  pages: number | null;
  currentPage: number | null; // 읽는 중일 때 어디까지 읽었나
  thicknessMm: number | null; // 탑에서 한 층의 높이
  thicknessSource: ThicknessSource | null;
  lengthMm: number | null; // 책 세로(YES24 length) — 탑에서 한 층의 너비
  coverUrl: string | null; // YES24 URL 그대로
  sideCoverUrl: string | null; // '이미지 준비중' 대체 그림이면 null → 화면이 책등을 그린다
  category: string | null; // goodsSortNm
  status: BookStatus;
  rating: number | null; // 0.5 단위
  oneLiner: string | null;
  oneLinerHidden?: boolean; // 관리자가 숨김 — 친구에게 안 보인다 (본인은 그대로)
  startedAt: Date | null;
  finishedAt: Date | null;
  readMinutes?: number; // 세션 시간 합 (책장에서 꺼내 읽은 시간)
  shelfOrder?: number; // 책장에서의 자리 (작을수록 앞). 새 책은 Date.now() 라 맨 끝, 순서를 바꾸면 0,1,2…
  addedFrom: { type: "search" | "barcode" | "manual" | "friend"; friendId?: ObjectId };
  createdAt: Date;
  updatedAt: Date;
};

export type MemoDoc = {
  _id: ObjectId;
  userId: ObjectId;
  userBookId: ObjectId;
  text: string;
  page: number | null;
  isPublic: boolean; // 기본 false — 친구에게는 공개로 바꾼 것만
  createdAt: Date;
};

// 친구 한 쌍 = 문서 하나. a < b 로 정렬해서 저장 (배열 pair 에 unique 를 걸면 Mongo 가 원소마다 unique 로 봐서 친구를 한 명밖에 못 맺는다)
export type FriendshipDoc = { _id: ObjectId; a: ObjectId; b: ObjectId; createdAt: Date };
export type InviteDoc = { _id: ObjectId; code: string; inviterId: ObjectId; createdAt: Date; expiresAt: Date };
export type VisitDoc = { _id: ObjectId; visitorId: ObjectId; hostId: ObjectId; viaWorkKey: string | null; createdAt: Date };
// 발도장 — 친구 도서관에 남기는 스티커 (+ 짧은 한마디). 책 한 권에 남기면 userBookId, 도서관에 남기면 null
export type StampDoc = {
  _id: ObjectId;
  fromUserId: ObjectId;
  toUserId: ObjectId;
  userBookId: ObjectId | null;
  kind: string;
  note?: string | null;
  noteHidden?: boolean; // 관리자가 숨김 — 집주인에게 한마디가 안 보인다
  createdAt: Date;
};
export type NotificationDoc = {
  _id: ObjectId;
  userId: ObjectId;
  type: "portal_opened" | "visited" | "stamped" | "friend_joined";
  payload: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
};
/** 포인트 장부 — 받고 쓴 것 하나하나. (userId, reason, ref) 가 같으면 한 번만 (두 번 눌러도 두 번 안 받게) */
export type PointLogDoc = {
  _id: ObjectId;
  userId: ObjectId;
  reason: "welcome" | "finish" | "shelve" | "read" | "buy" | "admin" | "mission"; // mission = 오늘의 미션·이번 주 도장 (ref = 날짜:미션)
  ref: string; // 무엇 때문에 — 책 id · 기록 id · 물건 id …
  delta: number; // + 받음 / - 씀
  day: string; // 한국 날짜 (하루 한도 세기)
  note?: string; // 관리자가 준 이유 등
  createdAt: Date;
};
/** 로그인 세션 — 쿠키에는 토큰, 여기에는 토큰의 해시만 (DB 가 새도 쿠키를 만들 수 없게). 60일, 쓰면 늘어난다 */
export type LoginDoc = { _id: ObjectId; tokenHash: string; userId: ObjectId; createdAt: Date; lastSeenAt: Date; expiresAt: Date; ua: string | null };
/** 하루에 한 번이라도 들어온 사람 (관리자 통계 — 하루 사용자) */
export type ActiveDayDoc = { _id: ObjectId; userId: ObjectId; day: string; at: Date };
/** 책마을 — 친구 둘만의 이야기 (pair = 두 아이디를 정렬해 이은 것). book = 책 추천, gift = 선물 물건 id */
export type ChatDoc = {
  _id: ObjectId;
  pair: string;
  from: ObjectId;
  to: ObjectId;
  text: string;
  book?: { title: string; author: string | null; coverUrl: string | null; isbn13: string | null; itemId: number | null } | null;
  gift?: string | null;
  createdAt: Date;
  readAt: Date | null;
};
export type ApiCacheDoc = { _id: string; body: unknown; createdAt: Date }; // TTL 24시간

/** 책장에서 꺼내 읽고 덮을 때마다 하나 — 읽는 속도·남은 시간·한 권 평균의 재료 */
export type ReadingSessionDoc = {
  _id: ObjectId;
  userId: ObjectId;
  userBookId: ObjectId;
  startedAt: Date | null; // 타이머로 읽었으면 시작 시각, 직접 적었으면 null
  endedAt: Date;
  minutes: number;
  fromPage: number;
  toPage: number;
  pagesRead: number;
};

export const CACHE_TTL_SEC = 60 * 60 * 24;

type G = { _bbMongo?: Promise<MongoClient>; _bbIndexes4?: Promise<void> };
const g = globalThis as G; // dev 의 핫 리로드에도 연결 하나만

export function hasDb(): boolean {
  return Boolean(process.env.MONGODB_URI?.trim());
}

export async function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new NoDbError();
  g._bbMongo ??= MongoClient.connect(uri, { serverSelectionTimeoutMS: 8000 });
  let client: MongoClient;
  try {
    client = await g._bbMongo;
  } catch (e) {
    g._bbMongo = undefined; // 다음 요청에서 다시 시도
    throw e;
  }
  const db = client.db(process.env.MONGODB_DB?.trim() || "bookbook");
  g._bbIndexes4 ??= ensureIndexes(db).catch((e) => {
    g._bbIndexes4 = undefined;
    throw e;
  });
  await g._bbIndexes4; // 이름 끝 숫자 = 인덱스 판 (새 인덱스를 넣으면 올린다 — 켜 둔 dev 서버도 다시 만든다)
  return db;
}

async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection<UserDoc>("users").createIndex({ handle: 1 }, { unique: true }),
    db.collection<UserBookDoc>("userBooks").createIndex({ userId: 1, status: 1 }),
    db.collection<UserBookDoc>("userBooks").createIndex({ workKey: 1, userId: 1 }),
    db.collection<UserBookDoc>("userBooks").createIndex({ userId: 1, isbn13: 1 }),
    db.collection<MemoDoc>("memos").createIndex({ userBookId: 1, createdAt: -1 }),
    db.collection<FriendshipDoc>("friendships").createIndex({ a: 1, b: 1 }, { unique: true }), // 내 친구 = {a: 나} ∪ {b: 나}
    db.collection<FriendshipDoc>("friendships").createIndex({ b: 1 }),
    db.collection<InviteDoc>("invites").createIndex({ code: 1 }, { unique: true }),
    db.collection<VisitDoc>("visits").createIndex({ hostId: 1, createdAt: -1 }),
    db.collection<StampDoc>("stamps").createIndex({ userBookId: 1 }),
    db.collection<StampDoc>("stamps").createIndex({ toUserId: 1, createdAt: -1 }),
    db.collection<VisitDoc>("visits").createIndex({ visitorId: 1, hostId: 1, createdAt: -1 }),
    db.collection<NotificationDoc>("notifications").createIndex({ userId: 1, createdAt: -1 }),
    db.collection<ApiCacheDoc>("apiCache").createIndex({ createdAt: 1 }, { expireAfterSeconds: CACHE_TTL_SEC }),
    db.collection<ReadingSessionDoc>("sessions").createIndex({ userId: 1, endedAt: -1 }),
    db.collection<ReadingSessionDoc>("sessions").createIndex({ userBookId: 1 }),
    db.collection<PointLogDoc>("pointLog").createIndex({ userId: 1, reason: 1, ref: 1 }, { unique: true }),
    db.collection<PointLogDoc>("pointLog").createIndex({ userId: 1, day: 1, reason: 1 }),
    db.collection<PointLogDoc>("pointLog").createIndex({ createdAt: -1 }),
    db.collection<UserDoc>("users").createIndex({ googleSub: 1 }, { unique: true, partialFilterExpression: { googleSub: { $type: "string" } } }),
    db.collection<UserDoc>("users").createIndex({ createdAt: -1 }),
    db.collection<LoginDoc>("logins").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection<LoginDoc>("logins").createIndex({ userId: 1 }),
    db.collection<LoginDoc>("logins").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection<ActiveDayDoc>("activeDays").createIndex({ day: 1, userId: 1 }, { unique: true }),
    db.collection<ActiveDayDoc>("activeDays").createIndex({ userId: 1 }),
    db.collection<ChatDoc>("chats").createIndex({ pair: 1, createdAt: -1 }),
    db.collection<ChatDoc>("chats").createIndex({ to: 1, readAt: 1, createdAt: -1 }),
  ]);
}
