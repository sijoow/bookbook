// API 응답에서 오류를 HTTP 상태로 바꾼다.

import "server-only";
import { ZodError } from "zod";
import { Yes24Error } from "@/lib/yes24/client";
import { NoDbError } from "./db";
import { AuthError, BadRequestError, NotFoundError } from "./errors";

const YES24_STATUS: Record<Yes24Error["code"], number> = {
  NO_KEY: 503,
  AUTH: 503,
  RATE_LIMIT: 429,
  BAD_REQUEST: 400,
  UPSTREAM: 502,
  NETWORK: 502,
};

export function errorResponse(e: unknown): Response {
  if (e instanceof Yes24Error) {
    const headers: HeadersInit = e.retryAfterSec ? { "Retry-After": String(e.retryAfterSec) } : {};
    return Response.json({ error: e.code, message: e.message }, { status: YES24_STATUS[e.code], headers });
  }
  if (e instanceof ZodError) return Response.json({ error: "BAD_INPUT", message: e.issues[0]?.message ?? "입력이 틀렸어요" }, { status: 400 });
  if (e instanceof BadRequestError) return Response.json({ error: "BAD_INPUT", message: e.message }, { status: 400 });
  if (e instanceof AuthError) return Response.json({ error: "AUTH", message: e.message }, { status: 401 });
  if (e instanceof NotFoundError) return Response.json({ error: "NOT_FOUND", message: e.message }, { status: 404 });
  if (e instanceof NoDbError) {
    return Response.json({ error: "NO_DB", message: "DB 가 연결되지 않았어요 (개발 중엔 npm run dev:mem)" }, { status: 503 });
  }
  console.error("[api]", e);
  return Response.json({ error: "INTERNAL", message: "서버 오류가 났어요" }, { status: 500 });
}
