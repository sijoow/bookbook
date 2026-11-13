// ISBN 정리·검사. 바코드(EAN-13)는 978·979로 시작해야 책이다.

/** 하이픈·공백을 빼고 대문자 X 로 맞춘다. */
export function cleanIsbn(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidIsbn13(s: string): boolean {
  if (!/^97[89]\d{10}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(s[12]);
}

export function isValidIsbn10(s: string): boolean {
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += (s[i] === "X" ? 10 : Number(s[i])) * (10 - i);
  return sum % 11 === 0;
}

/** ISBN-10 이나 ISBN-13 을 받아 올바른 ISBN-13 으로. 틀리면 null. */
export function toIsbn13(raw: string): string | null {
  const s = cleanIsbn(raw);
  if (isValidIsbn13(s)) return s;
  if (!isValidIsbn10(s)) return null;
  const body = "978" + s.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  return body + ((10 - (sum % 10)) % 10);
}
