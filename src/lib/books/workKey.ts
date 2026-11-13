// 판본이 달라도 '같은 책'인지 가르는 키 — 평행 우주의 통로 판정에 쓴다 (docs/02 2-2).
// workKey = 정규화(제목) + "|" + 정규화(첫 저자)
// 리커버·큰글자·개정판·양장 같은 판본 표기와 부제는 지우고, 권 번호(1, 2 …)는 남긴다.
// 세트(전집)는 1권과 다른 책이라 판본 표기로 보지 않는다.

const EDITION =
  /리커버|에디션|edition|개정|증보|특별판|한정판|기념|양장|반양장|무선|큰\s*글자|합본|스페셜|special|일러스트|전자책|e-?book|오디오북|미니북|포켓|보급판|완역|완전판|무삭제|신판|초판|복간|디럭스|deluxe|리미티드|limited|소장판|특장판|컬렉터|collector/i;

// NFKC 로 전각 괄호(［（ 등)는 반각으로 바뀐 뒤에 쓴다
const OPEN = "\\[【〔(<〈《「『";
const CLOSE = "\\]】〕)>〉》」』";
const BRACKET = new RegExp(`[${OPEN}][^${OPEN}${CLOSE}]*[${CLOSE}]`, "g");
const LEADING_TAGS = new RegExp(`^(?:\\s*[${OPEN}][^${OPEN}${CLOSE}]*[${CLOSE}])+`);
const SUBTITLE = /\s*:\s*|\s+[-~]\s+|\s*[–—]\s*/;
const TRAILING_EDITION =
  /\s+(?:리커버|개정판|개정증보판|특별판|한정판|기념판|양장본?|큰글자(?:도서|책)?|합본|스페셜|보급판|완역본|완전판|무선판?)(?:\s*에디션)?$/i;
// 역할 표기는 이름 뒤에 한 칸 띄고 붙는다 ("헤르만 헤세 저", "손원평 지음") — 띄어쓰기 없는 글자는 이름일 수 있어 건드리지 않는다
const ROLE =
  /\s+(?:글\s*[·∙・]\s*그림|글그림|지은이|지음|저자|저|글|그림|엮음|엮은이|편저|편역|편|옮김|옮긴이|역자|역|번역|감수|원작|기획|외\s*\d*\s*명?)$/;

function squash(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export function normalizeTitle(title: string): string {
  const original = title.normalize("NFKC").trim();
  let t = original.replace(LEADING_TAGS, " "); // [큰글자도서] 데미안 → 데미안
  t = t.replace(BRACKET, (m) => (EDITION.test(m) ? " " : m)); // 데미안(리커버 에디션) → 데미안, 토지 (1) 은 그대로
  const main = t.split(SUBTITLE)[0]; // 데미안 - 에밀 싱클레어의 … → 데미안
  if (main && main.trim()) t = main;
  for (let i = 0; i < 3 && TRAILING_EDITION.test(t.trim()); i++) t = t.trim().replace(TRAILING_EDITION, "");
  return squash(t) || squash(original);
}

/** "헤르만 헤세 저/전영애 역" → "헤르만헤세". 여러 명이면 첫 사람. */
export function normalizeFirstAuthor(author: string | null | undefined): string {
  if (!author) return "";
  let a = author.normalize("NFKC").replace(BRACKET, " "); // 헤르만 헤세(Hermann Hesse) → 헤르만 헤세
  a = a.split(/[\/,、;|·∙・]/).map((x) => x.trim()).find((x) => x.length > 0) ?? "";
  for (let i = 0; i < 3 && ROLE.test(a); i++) a = a.replace(ROLE, "").trim();
  return squash(a);
}

export function workKey(title: string, author?: string | null): string {
  return `${normalizeTitle(title)}|${normalizeFirstAuthor(author)}`;
}
