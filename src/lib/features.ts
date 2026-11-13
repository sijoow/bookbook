// 기능 켜고 끄기 — 지우지 않고 숨겨 둔 기능 (true 로 바꾸면 다시 보인다)

export const FEATURES = {
  /**
   * 내 사진으로 아바타 만들기 (폰 안에서만 색을 읽음, 11-13 오전에 만듦).
   * 11-13 오후 사용자: 예시 모습 여러 개로 고르는 방식으로 바꾸며 "숨김 처리해 줘 일단은" → 꺼 둠.
   * true 면 꾸미기 창 '추천' 탭 맨 위에 '내 사진으로 만들기'가 나온다 (components/PhotoAvatar · lib/avatar/fromPhoto).
   */
  photoAvatar: false,
} as const;
