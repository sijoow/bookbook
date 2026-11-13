// 한국어 조사 고르기 — 책 제목처럼 바뀌는 낱말 뒤에 '을/를', '이/가', '은/는', '과/와'
// (11-12: '『코스모스』을' 처럼 받침 없는 제목에 '을'이 붙은 일)

/** 끝 글자에 받침이 있나. 한글이 아니면 숫자는 읽는 소리로, 그 밖(영어 등)은 모름(null) */
export function hasBatchim(word: string): boolean | null {
  const ch = word.trim().replace(/[\s)\]』」'"’”.!?…]+$/u, "").slice(-1);
  if (!ch) return null;
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/[0-9]/.test(ch)) return "013678".includes(ch); // 영·일·삼·육·칠·팔 = 받침, 이·사·오·구 = 없음
  return null;
}

/** 낱말 + 알맞은 조사. 모르면 '을(를)'처럼 둘 다 */
export function josa(word: string, withBatchim: string, without: string): string {
  const b = hasBatchim(word);
  return b == null ? `${withBatchim}(${without})` : b ? withBatchim : without;
}
