import { describe, expect, it } from "vitest";
import { AVATAR, approach, ease, facing, grabY, jumpFor, riseTime, turnDelta, walkTime } from "./motion";

describe("점프 계획", () => {
  it("아래 줄 책은 서서 닿고, 위 줄은 뛰어야 한다", () => {
    expect(jumpFor({ y: 6, h: 22 })).toBe(0);
    expect(jumpFor({ y: 36, h: 22 })).toBeGreaterThan(15);
    expect(jumpFor({ y: 66, h: 22 })).toBeGreaterThan(jumpFor({ y: 36, h: 22 }));
  });
  it("잡는 곳은 책등 아래쪽 (큰 책도 너무 높지 않게)", () => {
    expect(grabY({ y: 6, h: 20 })).toBe(15);
    expect(grabY({ y: 6, h: 32 })).toBe(17);
  });
  it("올라가는 시간은 높이에 따라", () => {
    expect(riseTime(0)).toBe(0);
    expect(riseTime(40)).toBeGreaterThan(riseTime(10));
    expect(riseTime(AVATAR.height)).toBeLessThan(0.4);
  });
});

describe("걷기·방향", () => {
  it("걷는 시간은 짧게 끊기지도, 늘어지지도 않는다", () => {
    expect(walkTime(0)).toBe(0.22);
    expect(walkTime(40)).toBeCloseTo(0.5, 5);
    expect(walkTime(10000)).toBe(2.4);
  });
  it("+z 쪽이 0, +x 쪽이 90도", () => {
    expect(facing(0, 1)).toBe(0);
    expect(facing(1, 0)).toBeCloseTo(Math.PI / 2, 5);
    expect(Math.abs(facing(0, -1))).toBeCloseTo(Math.PI, 5);
  });
  it("도는 각은 가장 짧은 쪽으로", () => {
    expect(turnDelta(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2, 5);
    expect(turnDelta(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2, 5);
    expect(turnDelta(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(-0.2, 5);
  });
  it("부드럽게 따라가기는 프레임을 나눠도 결과가 같다", () => {
    const once = approach(0, 10, 8, 0.2);
    let v = 0;
    for (let i = 0; i < 4; i++) v = approach(v, 10, 8, 0.05);
    expect(v).toBeCloseTo(once, 6);
  });
  it("바운스는 넘쳤다 돌아온다", () => {
    expect(ease.outBack(0)).toBeCloseTo(0, 6);
    expect(ease.outBack(1)).toBeCloseTo(1, 6);
    expect(Math.max(...[0.6, 0.7, 0.8].map(ease.outBack))).toBeGreaterThan(1);
  });
});
