// 샘플 모드 데이터 — YES24_API_KEY 가 없을 때(개발 중에만) 화면을 만들어 보려고 쓴다.
// 데미안(민음사)·소년이 온다(창비)의 쪽수·크기는 11-12 실측값, 나머지는 화면 시험용으로 넣은 값이라 믿으면 안 된다.
// 크기 필드 뜻은 YES24 와 같게: width = 가로, height = 두께, length = 세로.
// 같은 책 다른 판본(데미안 두 권)을 넣어 workKey 묶음을 눈으로 확인할 수 있게 했다.

export const MOCK_ITEMS: Array<Record<string, unknown>> = [
  {
    itemId: -1,
    title: "데미안",
    author: "헤르만 헤세 저/전영애 역",
    publisher: "민음사",
    isbn13: "9788937460449",
    publishDate: "20001220",
    goodsType: "도서",
    goodsSortNm: "국내도서-소설/시/희곡",
    pages: 239,
    width: 132,
    height: 20,
    length: 225,
    weight: 327,
  },
  {
    itemId: -2,
    title: "데미안 (리커버 에디션)",
    author: "헤르만 헤세 저/샘플 역",
    publisher: "샘플출판",
    goodsType: "도서",
    goodsSortNm: "국내도서-소설/시/희곡",
    pages: 280,
  },
  {
    itemId: -3,
    title: "소년이 온다",
    author: "한강 저",
    publisher: "창비",
    isbn13: "9788936434120",
    goodsType: "도서",
    goodsSortNm: "국내도서-소설/시/희곡",
    pages: 216,
    width: 153,
    height: 20,
    length: 224,
    weight: 301,
  },
  {
    itemId: -4,
    title: "아몬드",
    author: "손원평 저",
    publisher: "샘플출판",
    goodsType: "도서",
    goodsSortNm: "국내도서-소설/시/희곡",
    pages: 264,
  },
  {
    itemId: -5,
    title: "해리 포터와 마법사의 돌 1",
    author: "J.K. 롤링 저/샘플 역",
    publisher: "샘플출판",
    goodsType: "도서",
    goodsSortNm: "국내도서-어린이",
  },
];

export function mockSearch(query: string): Array<Record<string, unknown>> {
  const q = query.replace(/\s/g, "").toLowerCase();
  const hit = MOCK_ITEMS.filter((it) =>
    `${it.title}${it.author}`.replace(/\s/g, "").toLowerCase().includes(q),
  );
  return hit.length ? hit : MOCK_ITEMS;
}

/** 모르는 ISBN 도 바코드 흐름을 시험할 수 있게 쪽수 없는 샘플 책을 돌려준다 → 화면은 쪽수를 물어봐야 한다. */
export function mockDetail(isbn13: string): Record<string, unknown> {
  return (
    MOCK_ITEMS.find((it) => it.isbn13 === isbn13) ?? {
      itemId: -99,
      title: `샘플 책 (${isbn13})`,
      author: "샘플 저자",
      publisher: "샘플출판",
      isbn13,
    }
  );
}
