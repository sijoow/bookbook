import { describe, expect, it } from "vitest";
import {
  estimateThicknessMm,
  isPlaceholderSpine,
  parsePages,
  resolveThickness,
  thicknessFromDims,
  thicknessFromSpine,
} from "./thickness";

describe("thickness", () => {
  it("책등 이미지 비율: 세로 225mm × 19/400px = 10.7mm (민음사 데미안 실측)", () => {
    expect(thicknessFromSpine({ w: 19, h: 400 }, 225)).toBe(10.7);
    expect(thicknessFromSpine({ w: 68, h: 400 }, 209)).toBe(35.5); // 692쪽 벽돌책
  });

  it("'이미지 준비중' 대체 그림(280×400)은 책등이 아니다", () => {
    expect(isPlaceholderSpine({ w: 280, h: 400 })).toBe(true);
    expect(isPlaceholderSpine({ w: 19, h: 400 })).toBe(false);
    expect(thicknessFromSpine({ w: 280, h: 400 }, 225)).toBeNull();
  });

  it("세로 길이를 모르면 책등 비율로 못 잰다", () => {
    expect(thicknessFromSpine({ w: 19, h: 400 }, null)).toBeNull();
  });

  it("크기 세 값이 다 있으면 가장 작은 값 (YES24 는 height 가 두께)", () => {
    expect(thicknessFromDims([132, 20, 225])).toBe(20);
    expect(thicknessFromDims([132, 225, null])).toBeNull();
    expect(thicknessFromDims([])).toBeNull();
  });

  it("쪽수로 추정: 300쪽 = 15mm + 표지 2mm", () => {
    expect(estimateThicknessMm(300)).toBe(17);
    expect(estimateThicknessMm(0)).toBeNull();
    expect(estimateThicknessMm(null)).toBeNull();
  });

  it("책등 없이 정할 때: 쪽수 추정이 YES24 크기보다 먼저 (YES24 두께는 반올림이 많다)", () => {
    expect(resolveThickness({ dims: [132, 20, 225], pages: 248 })).toEqual({ mm: 14.4, source: "estimate" });
    expect(resolveThickness({ dims: [132, 20, 225], pages: null })).toEqual({ mm: 20, source: "yes24" });
    expect(resolveThickness({ pages: null })).toBeNull();
  });

  it.each([
    [332, 332],
    ["784 p.", 784],
    ["xiii, 345 p.", 345],
    ["252, 64 p.", 252],
    ["[130] p.", 130],
    ["230페이지 내외", 230],
    ["", null],
    [null, null],
  ])("쪽수 표기 %s → %s", (raw, want) => {
    expect(parsePages(raw)).toBe(want);
  });
});
