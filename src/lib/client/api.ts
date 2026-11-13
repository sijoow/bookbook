// 화면에서 우리 API 부르기 — 오류는 서버가 준 한국어 message 로. 로그인이 풀렸으면(401) 로그인 화면으로

/** 로그인이 풀렸다고 알린다 — 앱 틀의 AuthWatch 가 로그인 화면으로 옮긴다 */
function toLogin() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("bookbook:auth"));
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init?: { method?: string; json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? (init?.json !== undefined ? "POST" : "GET"),
    headers: init?.json !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  if (res.status === 401) toLogin();
  if (!res.ok) throw new ApiError(body.message || `요청이 실패했어요 (${res.status})`, res.status, body.error);
  return body as T;
}
