// 아바타 움직임 계산 — 걷는 시간·점프 높이·방향·부드럽게 따라가기. 순수 함수 (three.js 없이 시험).
// 단위 cm·초. 아바타는 rotation.y = 0 일 때 +z(화면 쪽)를 본다.

export const AVATAR = {
  height: 36, // 서 있을 때 키 (머리가 큰 아기 비율)
  handUp: 24, // 팔을 쭉 올렸을 때 손 높이 — 그보다 높은 책은 깡충 뛰어서
  walkSpeed: 80, // cm/s
  gravity: 980, // 만화처럼 가볍게
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 책을 잡는 높이 — 책등 아래쪽 가운데 */
export function grabY(slot: { y: number; h: number }): number {
  return slot.y + Math.min(slot.h * 0.45, 11);
}

/** 그 책을 잡으려면 몇 cm 뛰어야 하나 (0 = 서서 닿음) */
export function jumpFor(slot: { y: number; h: number }): number {
  return Math.max(0, Math.round(grabY(slot) - AVATAR.handUp));
}

/** 그 높이까지 올라가는 시간(초) */
export function riseTime(h: number): number {
  return h <= 0 ? 0 : Math.sqrt((2 * h) / AVATAR.gravity);
}

/** 거리만큼 걷는 시간 — 너무 짧거나 길지 않게 */
export function walkTime(dist: number): number {
  return clamp(dist / AVATAR.walkSpeed, 0.22, 2.4);
}

/** 그쪽으로 가려면 몸을 어느 각도로 (rotation.y) */
export function facing(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

/** a 에서 b 로 도는 가장 짧은 각 */
export function turnDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** 목표값으로 부드럽게 (프레임 빠르기와 상관없이 같은 느낌) */
export function approach(cur: number, target: number, rate: number, dt: number): number {
  return target + (cur - target) * Math.exp(-rate * dt);
}

export const ease = {
  inOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  out: (t: number) => 1 - (1 - t) ** 3,
  in: (t: number) => t * t * t,
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  linear: (t: number) => t,
};
