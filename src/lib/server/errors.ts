// 서버에서 던지고 API 가 HTTP 상태로 바꾸는 오류들

export class AuthError extends Error {
  constructor(message = "로그인이 필요해요") {
    super(message);
  }
}

export class NotFoundError extends Error {
  constructor(message = "찾을 수 없어요") {
    super(message);
  }
}

export class BadRequestError extends Error {}
