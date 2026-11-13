# 북적북적 분석 + 책 데이터 출처 조사 (1차)

- 조사일: 2026-11-12
- 목적: 클라이언트가 빠져 있는 '북적북적'과 비슷한 독서 기록 앱 + 멀티버스 느낌 연동
- 다음 단계: 멀티버스 방향(A/B/C) 확정 → 화면 흐름·데이터 구조(2차)

---

## 1. 북적북적 한눈에

| 항목 | 내용 | 출처 |
|---|---|---|
| 정식 이름 | 북적북적 - 독서 기록 앱 (부제: 귀여운 북적이와 책읽는 습관 만들기) | App Store |
| 개발 | 북적스튜디오(Bustle Studio), 대표 박성은. 같은 개발자 계정에 '꾸주니 - 30일 챌린지' | App Store, studiobustles.com |
| 출시 | 2019년경 추정 (App Store id1472538417, 노출 리뷰 2020-04부터) | 추정 |
| 평가 | iOS 4.8 (평가 2.2만), 도서 무료 차트 15위(조회 시점) / Android 4.3 (리뷰 3.7천), 50만+ 다운로드 | App Store, Google Play |
| 플랫폼 | iOS·iPadOS·macOS(M1)·visionOS, Android `com.studiobustle.bookjuk` | |
| 서버·분석 | Google Cloud(Firebase) + Google Analytics (처리위탁 목록) | 개인정보처리방침 2023-08-25 |
| 로그인 | Apple·Google·Facebook 식별자 | 개인정보처리방침 |
| 앱 크기 | 168.7MB (캐릭터 에셋이 많은 것으로 보임) | App Store |

### 핵심 루프
기록 → '읽은 책'의 쪽수만큼 책탑이 높아짐 → 높이에 따라 캐릭터 획득(60여 종, 캐릭터마다 스토리) → 옷장 아이템으로 꾸미기 → 다시 기록

- 목표를 '100권'이 아니라 **'100cm 읽기'**로 제시 ("같은 책 1권이라도 높이는 제각각이니까")

### 기능 목록
- 독서 상태 4종: 읽은 / 읽고 있는 / 읽고 싶은 / 중단한
- 별점·한줄평·메모(500자 제한), 메모 사진(Pro)
- 보기 3종: 캘린더 / 리스트 / 책탑
- 월별 독서량 통계, 1년 흐름
- 독서 기록 내보내기(백업)
- 컬러·폰트 설정, 다크 모드, 테마 컬러
- ISBN 바코드 스캔, 표지 이미지 직접 업로드 (카메라·사진 권한은 선택)
- 다른 사람의 한줄평·별점 보기
- 홈 화면 위젯 (+ 위젯에서 바코드 검색)
- 검색에 없는 책 직접 등록, 책 정보(쪽수) 직접 수정

### 업데이트 흐름 (App Store 버전 기록)
- 2025-02~03 (1.21.x) 북적 Pro 멤버십 출시: 광고 제거, 메모 사진 업로드
- 2025-04~05 (1.22.x) 다른 사람 한줄평·별점 보기
- 2025-06 (1.23.x) 마이페이지 캘린더
- 2025-07~12 (1.24.x) 테마 컬러 추가
- 2026-08-28 (1.25.0) 위젯, 2026-09-28 (1.25.2) 위젯 바코드 검색
- 2026-10-22 (1.25.4) 버그 수정 ← 알라딘 API 종료(10-30) 8일 전

### 수익 구조
- 광고 (무료 사용자)
- 북적 Pro 구독: 월 2,500원 / 연 19,900원
- 코인: 100개 1,800원 / 150개 2,500원 / 300개 4,800원
  - 무료 코인: '기록하기' 1일 1코인(새 책·메모 저장·수정), 광고 시청 게이지 채우면 1코인
  - 유료 코인이 먼저 소진, 계정 삭제 시 소멸
- 캐릭터 단계 해금(3·4·5·6단계, 레벨2) 각 1,500원
- 책 구매 링크 제휴 수익: 확인 못 함

### 사용자 반응 (App Store 노출 리뷰)
- 칭찬: 캐릭터·디자인 귀여움 / 캘린더·리스트·책탑 3가지 보기 / 광고가 거슬리지 않음 / 상태별 분류 편함 / 습관 형성
- 불만·요청: 장르별 분류·통계 없음 / 친구 맺기·책 추천 보내기 없음 / 독서 목표 달성 보상 / 캐릭터 업데이트 느림 / 메모 500자 / 연도별 정렬

→ 우리 차별화 후보: 장르 통계, 친구·연결(멀티버스), 실제 책등 이미지로 쌓기, 추천

---

## 2. 북적북적의 책 데이터

- FAQ(error-search): **알라딘 데이터베이스 사용**. 검색 안 되면 홈 > 책 검색 > 우측 상단 + > 책 정보 직접 입력하기
- FAQ(error-height): 쌓아보기 높이는 **'읽은 책'으로 저장된 책의 페이지 수 기준**. 쪽수가 틀리면 책 상세 하단 '책 정보 수정'. cm 환산식은 공개 안 됨
- 알라딘 API는 쪽수(`subInfo.itemPage`)를 줬기 때문에 이 구조가 가능했음 (카카오·네이버는 쪽수 없음)
- **알라딘 Open API 종료(2026-10-30) 이후 무엇으로 바꿨는지는 확인 못 함.** 11-12 현재 FAQ는 여전히 알라딘 표기

---

## 3. 국내 책 데이터 API 현황 (2026-11 기준)

| 출처 | 상태 | 쪽수 | 표지 | 분류 | 하루 한도 | 핵심 조건 |
|---|---|---|---|---|---|---|
| YES24 Open API | ✅ 무료·즉시 발급 (2026-07 공개) | ✅ `pages` + 크기(mm)·무게 | 앞표지·책등·뒷표지 | 2단계 | 2만 (초 10) | 화면에 출처+상품 링크 의무, 키 서버 전용, DB 축적 금지 |
| 카카오 책 검색 | ✅ | ❌ | ✅ | ❌ | 3만 | AI 입력·재판매 금지, 영구 저장 금지 (데브톡 답변) |
| 국립중앙도서관 ISBN 서지정보 | ✅ 승인제 | △ 형식 제각각 | 드묾 | KDC | 비공개 | 제목 검색 정렬 약함 → ISBN 조회용 |
| 도서관 정보나루 | ✅ 승인제 | ❌ | ✅ | KDC | 500 → IP 등록 3만 (2차 자료) | 연관 도서·추천·키워드 |
| 알라딘 Open API | ❌ 2026-10-30 종료 | | | | | 이후 `code=999` |
| 네이버 책 검색 | ❌ 2026-07-31 종료 | | | | | API HUB로 이관 안 됨, 대체 없음 |
| Google Books | 보조 | ✅ | ✅ | | 키 필요 | 키 없이 호출 시 공용 쿼터 429 (11-12 직접 확인), 국내 판본 중심 아님 |
| Open Library | 부적합 | 일부 | | | | 국내 ISBN 3건 중 2건, 로마자 제목 |

### 3-1. YES24 Open API (1순위)
- Base `https://apis.yes24.com/v1`, 헤더 `X-Api-Key`, 응답 camelCase, 래퍼 `{success, message, data, errorCode}`
- 발급: 예스24 회원 로그인 → 즉시 발급, **계정당 키 1개**, 법인은 법인회원 권장
- 상품(Goods)
  - `GET /goods/itemList` — query, category(`ALL|BOOK|FOREIGN|EBOOK|MUSIC|DVD`), sort(`DEFAULT` 인기 | `RELATION` 정확도 | `RECENT` | `REG_DTS`), page, pageSize, detail
  - `GET /goods/itemDetail` — searchType(`ISBN13|ItemId`), query, detail=Y
  - `GET /goods/content` — 목차
  - `GET /goods/author` — 작가 정보(authorId, 생몰, 데뷔작, 소개)
- 카테고리(Category)
  - `/category/list`, `/category/bestseller`(sex `A|M|F`, age `255|10~60`), `bestsellerRealtime`(상위 100), `bestsellerDaily`, `bestsellerMonthly`, `bestsellerDeal`, `bestsellerSteady`, `newproduct`, `newproductAttention`, 각 `/export`(xlsx)
- 필드 (detail=N): itemId, title, author, goodsType, `goodsSortNm`(예 `국내도서-소설/시/희곡`), adultYn, publisher, isbn10, isbn13, shopPrice, salePrice, publishDate(`yyyyMMdd`), itemStatus, cover, link, contentDetail(소개)
- 필드 (detail=Y 추가): subTitle, originalTitle, **pages**, **weight(g)·width·height·length(mm)**, itemFormat(판형), starScore, salePoint, series[], mobileLink, ebookId, `addOnLink`(애드온 신청 시) / 2026-10-01부터 **sideCover(책등)**·backCover
  - 책등·뒷표지는 이미지가 없어도 대체 이미지 URL이 와서 응답만으로 유무 구분 불가
  - width/height/length 중 무엇이 두께인지는 키 받아 실측 필요
- 한도: Basic 일 20,000 / 초 10 (2026-08-13 상향, 앞으로도 무료 예정), Partner 10만/초 20, Enterprise 50만/초 50 (유료화 예정, 가격 미정). 초과 시 429 + `Retry-After`. 계정 단위인지 키 단위인지 문서끼리 다름
  - GitHub 레퍼런스는 예전 수치(일 5,000)로 남아 있음
- 조건 (약관·FAQ)
  - 상업적 이용: 광고·인앱·구독 서비스도 **사전 승인 없이 가능**
  - **화면에 YES24 출처 표기 + 상품 상세 페이지 링크 의무** (약관 6조 ③4). 다른 판매처 버튼 병기는 허용(판매처 구분 표기)
  - 캐싱: 서비스에 필요한 범위의 **일시 저장만**. 대량·체계적 수집으로 별도 DB 구축, 왜곡 가공, 제3자 제공·재배포 금지. 가격 등 변동 정보는 갱신 의무
  - **키를 앱·브라우저에 넣으면 안 됨** → 백엔드 경유
  - 애드온: 신청 시 `addOnLink`로 구매 발생하면 수익 귀속 (수수료율·정산 미확인, 신청 후 해제 불가)
  - AI 학습·생성형 AI 입력: 조항 없음 → 1:1 문의 필요
  - 표지 이미지: 응답 URL을 그대로 쓰는 방식 안내. 다운로드 저장 허용 여부 미확인
  - 무료 API 결과의 정확성·지속성 보증 안 함 (약관 12조)

### 3-2. 카카오(Daum) 책 검색 (검색 보조)
- `GET https://dapi.kakao.com/v3/search/book`, `Authorization: KakaoAK {REST_API_KEY}`
- query, sort(`accuracy|latest`), page(1~50), size(1~50), target(`title|isbn|publisher|person`)
- 필드: title, contents(중간에 잘려 옴), url, isbn(10·13 공백 구분), datetime(ISO 8601), authors, publisher, translators, price, sale_price, thumbnail, status — **쪽수·분류 없음**
- 한도 일 3만, 증설 계획 없음 (데브톡 답변 2026-07)
- 데브톡 답변 기준(공식 약관 아님): 상업 서비스 가능, **응답 재판매·AI 입력 불가**(2026-10-06), DB 영구 저장·장기 하드캐싱 불가·최신화 필요(2026-07-20), 출처 표기 강제 안 함, 프록시 서버 경유 허용
- 다른 팀 실측(2026-10-08): '데미안·불편한 편의점·아몬드·트렌드 코리아·소년이' 모두 1위가 기대한 책, 판본 구분, 25건 전부 표지·ISBN13

### 3-3. 국립중앙도서관 ISBN 서지정보 (쪽수 보완)
- `https://www.nl.go.kr/seoji/SearchApi.do` — 필수 cert_key, result_style(json), page_no, page_size / 선택 isbn, title, author, publisher, ebook_yn, cip_yn, 발행예정일 범위, sort(정확도 정렬 없음)
- 필드 40개: TITLE, AUTHOR, EA_ISBN, SET_ISBN, PUBLISHER, **PAGE**, **BOOK_SIZE**, KDC, DDC, SUBJECT, TITLE_URL(표지), PUBLISH_PREDATE, EBOOK_YN, BOOK_INTRODUCTION, BOOK_SUMMARY, BOOK_TB_CNT(목차), RELATED_ISBN 등 (목차·소개 파일 URL은 2021-02까지 데이터)
- 다른 팀 실측(2026-10-08): PAGE 25건 중 18건 있음, 형식 제각각(`332`, `784 p.`, `[130] p.`, `252, 64 p.`, `xiii, 345 p.`, `230페이지 내외`) → 숫자 파싱 필요. 2015년 이전 도서·일부 유명 도서 비어 있음. 표지 50건 중 9건. `ebook_yn=N`으로 전자책 걸러 냄
- 인증키: 회원가입 → 신청 → 담당자 승인. 한도 비공개 → 디지털정보기획과 02-590-0548

### 3-4. 도서관 정보나루 (멀티버스 연결선)
- `https://data4library.kr/api/...`, authKey, 회원가입 → 인증키 신청 → 승인(보통 익일, 2차 자료)
- 한도: 기본 일 500, 마이페이지에 서버 IP 등록 시 일 30,000 (2차 자료)
- 연결에 쓸 엔드포인트
  - `recommandList` type=`mania`(마니아 추천) / `reader`(다독자 추천), isbn13 여러 개 `;`, 최대 200건
  - `usageAnalysisList` isbn13 — 대출 정보, 키워드, 함께 대출된 도서
  - `keywordList` isbn13 — 핵심 키워드 + 가중치
  - `loanItemSrch` — 기간·성별·연령·지역·KDC별 인기대출
  - `hotTrend` — 대출 급상승, `srchDtlList` — 도서 상세(표지·소개)
- 쪽수 없음. 상업적 이용 조건 미확인

---

## 4. 우리 앱 데이터 설계 초안

- **검색**: YES24 `itemList`(category=BOOK, sort=RELATION). 결과 품질이 부족하면 카카오를 검색 전용으로 병행
- **등록·바코드**: ISBN13 → YES24 `itemDetail` detail=Y → 쪽수·크기·책등
- **쪽수 빈칸**: 국립중앙도서관 PAGE 파싱 → 그래도 없으면 사용자 입력 (항상 수정 가능)
- **높이**: YES24 크기 필드에 두께가 있으면 실제 mm 사용. 없으면 쪽수 × 0.05mm + 표지 2mm (우리 추정식, 300쪽 ≈ 1.7cm, 100cm ≈ 300쪽 책 59권)
- **연결(멀티버스)**: 정보나루(함께 대출·마니아/다독자 추천·키워드) + YES24(작가·시리즈·분류)
- **저장 원칙(제안)**: 사용자 기록에는 ISBN13·제목·저자·쪽수·표지 URL 정도만, 소개·가격·평점은 매번 조회. 경계는 YES24 1:1 문의로 확인
  - **ISBN13은 반드시 저장** — 출처가 바뀔 때 다시 찾는 열쇠 (알라딘 종료 때 다른 팀이 ISBN 미저장으로 표지 깨짐 문제를 겪음)
- **키**: 전부 우리 서버에서 호출 (YES24 명시)
- **책 상세 화면**: YES24 출처 + 상품 링크 (애드온 신청 시 수익)
- **AI 기능을 넣는다면**: 카카오 응답은 넣지 않는다. YES24는 문의 후 결정. 정보나루 키워드처럼 공공 데이터 쪽을 우선 검토

---

## 5. 멀티버스 — 방향 확인 필요

- **A. 책 우주**: 읽은 책 = 별. 같은 작가·분야·함께 대출된 책끼리 선으로 이어져 은하가 됨. 위로 쌓기(북적북적) → 옆으로 넓어지는 우주. 데이터: YES24 + 정보나루. 가장 간단
- **B. 평행 우주(친구)**: 사람마다 자기 우주, 같은 책을 읽은 지점이 통로. 북적북적 리뷰의 친구 기능 요청을 채움. 데이터: 우리 DB(ISBN 기준)
- **C. 책 속 세계 여행**: 캐릭터가 책마다 다른 세계(장르 테마)에 들어가 아이템 수집. 책 내용·등장인물을 AI로 재창작하면 저작권·약관 문제 → 장르·키워드 기반 테마까지만

주의: 쌓기·수집 같은 구조는 참고하되 이름·'북적이' 캐릭터·화면을 닮게 만들지 않는다.

---

## 출처

- App Store: https://apps.apple.com/kr/app/id1472538417
- Google Play: https://play.google.com/store/apps/details?id=com.studiobustle.bookjuk
- 개발사: https://studiobustles.com/ · FAQ https://studiobustles.com/faq/error-search · https://studiobustles.com/faq/error-height · https://studiobustles.com/faq/guide-coin · 개인정보 https://studiobustles.com/privacy · 약관 https://studiobustles.com/terms
- 알라딘 종료 공지: https://blog.aladin.co.kr/cscenter/17483675 · https://blog.aladin.co.kr/openapi/popup/6695306
- 네이버 책 검색 종료: https://newsway.co.kr/news/view?ud=2026090215314059117 · https://waffleboard.io/blog/naver-search-api-hub-migration-guide
- YES24: https://developers.yes24.com/ · https://developers.yes24.com/support/faq · https://developers.yes24.com/support/terms · https://developers.yes24.com/docs/addon · https://github.com/yes24-AX/yes24-openapi-samples/blob/main/docs/api-reference.md
- 카카오: https://developers.kakao.com/docs/latest/ko/daum-search/dev-guide · https://devtalk.kakao.com/t/daum-api/151936 · https://devtalk.kakao.com/t/api-ios/152056 · https://devtalk.kakao.com/t/api-daum-search/150751
- 국립중앙도서관: https://www.nl.go.kr/NL/contents/N31101030500.do
- 정보나루: https://www.data4library.kr/apiUtilization · 한도(2차) https://lobehub.com/pl/mcp/isnow890-data4library-mcp
- 다른 팀의 알라딘 대체 기록: https://github.com/DeveloperAcademy-POSTECH/2024-MacC-A6-Five-Guys/issues/212 · https://github.com/SeungJo-02/shelfeed_BackEnd_Advancement/issues/67
