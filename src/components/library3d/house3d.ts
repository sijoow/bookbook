// 내가 살 집 — 방 껍데기(벽·바닥·천장·창)와 보는 구도. 11-13 사용자: "방도 여러 개 구도가 있었으면" + "내가 살 집 선택하기"
// 책장·방석·러그·아바타 자리는 집과 상관없이 같다 (걷기·꺼내기 연출이 그대로 돌게). 집이 바꾸는 건 껍데기와 카메라뿐.
// 창은 꾸미기 물건(창문·액자 = 책장 위쪽)과 겹치지 않게 책장 옆에 둔다.

import * as THREE from "three";
import type { HouseId } from "@/lib/house/houses";
import { PAL, floorTexture, gridTexture, wallTexture, windowViewTexture, type FloorTone } from "./textures";

export type ShellCtx = {
  wallZ: number; // 뒷벽 z
  caseX: number; // 첫 책장 가운데 x
  caseHalf: number; // 첫 책장 반 폭
  caseTop: number; // 첫 책장 높이
  preview: boolean; // 아바타 미리보기 (바닥만)
};
type Disposable = { dispose(): void };
export type Shell = { group: THREE.Group; own: Disposable[]; focus: THREE.Vector3[] }; // focus = 방 보기 카메라가 꼭 담을 점 (창·천장)

/** 집마다 방 보기 카메라 — tilt(내려다보는 각), yaw(+ 오른쪽에서, - 왼쪽에서) */
export const HOUSE_CAM: Record<HouseId, { tilt: number; yaw: number }> = {
  grid: { tilt: 0.52, yaw: 0.06 },
  attic: { tilt: 0.44, yaw: 0.46 },
  sunny: { tilt: 0.78, yaw: 0.2 },
  cabin: { tilt: 0.3, yaw: -0.36 },
};

/** 집마다 러그·방석 색 — 같은 물건이어도 집마다 느낌이 다르게 */
export const HOUSE_COLORS: Record<HouseId, { rug: string; cushion: string }> = {
  grid: { rug: PAL.butter, cushion: PAL.mint },
  attic: { rug: PAL.coral, cushion: PAL.butter },
  sunny: { rug: PAL.sky, cushion: PAL.coral },
  cabin: { rug: PAL.mint, cushion: PAL.apricot },
};

const FLOOR_TONE: Record<HouseId, FloorTone> = { grid: "honey", attic: "amber", sunny: "birch", cabin: "walnut" };

export function buildShell(id: HouseId, ctx: ShellCtx, toonMat: (color: string) => THREE.Material): Shell {
  const group = new THREE.Group();
  const own: Disposable[] = [];
  const focus: THREE.Vector3[] = [];
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const toon = (c: string) => {
    const m = toonMat(c);
    own.push(m);
    return m;
  };
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, cast = false) => {
    own.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const lambert = (map: THREE.Texture, extra: THREE.MeshLambertMaterialParameters = {}) => {
    own.push(map);
    const m = new THREE.MeshLambertMaterial({ map, ...extra });
    own.push(m);
    return m;
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, cast = false) => {
    const m = mesh(new THREE.BoxGeometry(w, h, d), mat, cast);
    m.position.set(x, y, z);
    return m;
  };

  // 바닥
  const floor = mesh(new THREE.PlaneGeometry(1200, 600), lambert(floorTexture(1200, 600, FLOOR_TONE[id])));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(400, 0, 270);
  if (ctx.preview) return { group, own, focus };

  // 뒷벽 + 걸레받이
  const W = ctx.wallZ;
  const wallMap = id === "grid" ? gridTexture(1200, 420, 5) : wallTexture(id, 1200, 420);
  const wall = mesh(new THREE.PlaneGeometry(1200, 420), lambert(wallMap));
  wall.position.set(400, 190, W);
  box(1200, 5, 1.6, 400, 2.5, W + 0.8, toon(id === "cabin" ? "#8f6541" : PAL.cream));

  const left = ctx.caseX - ctx.caseHalf; // 책장 왼쪽 끝
  const right = ctx.caseX + ctx.caseHalf; // 책장 오른쪽 끝

  /** 벽에 거는 네모 창 (틀 + 창밖 + 십자 살) */
  const squareWindow = (cx: number, cy: number, w: number, h: number, view: "sky" | "forest", frame: string) => {
    const glass = mesh(new THREE.PlaneGeometry(w, h), lambert(windowViewTexture(view)));
    glass.position.set(cx, cy, W + 0.3);
    const fm = toon(frame);
    const t = 3;
    box(w + t * 2, t, 2.4, cx, cy + h / 2 + t / 2, W + 1.2, fm, true);
    box(w + t * 2 + 4, t, 5, cx, cy - h / 2 - t / 2, W + 2.4, fm, true); // 창턱
    box(t, h, 2.4, cx - w / 2 - t / 2, cy, W + 1.2, fm, true);
    box(t, h, 2.4, cx + w / 2 + t / 2, cy, W + 1.2, fm, true);
    box(1.6, h, 1.4, cx, cy, W + 0.9, fm);
    box(w, 1.6, 1.4, cx, cy, W + 0.9, fm);
  };

  if (id === "attic") {
    // 왼쪽으로 내려오는 나무 천장 + 낮은 옆벽 = 다락방 귀퉁이
    const lowX = left - 40;
    const lowY = 60;
    const th = 0.75; // 천장 기울기 — 책장 위 화분보다는 높게
    const L = 300;
    const ceilMap = wallTexture("attic", L, 300);
    const ceil = mesh(new THREE.PlaneGeometry(L, 300), lambert(ceilMap, { side: THREE.DoubleSide }));
    ceil.rotation.order = "ZXY";
    ceil.rotation.z = th;
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(lowX + (L / 2) * Math.cos(th), lowY + (L / 2) * Math.sin(th), W + 150);
    const knee = mesh(new THREE.PlaneGeometry(300, lowY), lambert(wallTexture("attic", 300, lowY)));
    knee.rotation.y = Math.PI / 2;
    knee.position.set(lowX, lowY / 2, W + 150);
    // 서까래 (천장 따라 나무 막대 셋)
    const beam = toon(PAL.woodDark);
    for (const z of [W + 40, W + 120, W + 200]) {
      const b = box(L, 4, 4, lowX + (L / 2) * Math.cos(th), lowY + (L / 2) * Math.sin(th) - 2.5, z, beam, true);
      b.rotation.z = th;
    }
    // 동그란 창 (노을) — 천장 아래 낮은 벽에
    const cx = left - 20;
    const cy = 46;
    const r = 11;
    focus.push(v(cx - r - 3, cy - r, W), v(cx - r, cy + r + 4, W), v(lowX + 30, lowY + 30 * Math.tan(th), W + 20)); // 창 + 천장 한 귀퉁이
    const glass = mesh(new THREE.CircleGeometry(r, 40), lambert(windowViewTexture("dusk")));
    glass.position.set(cx, cy, W + 0.3);
    const ring = mesh(new THREE.TorusGeometry(r + 1.4, 1.8, 10, 40), toon(PAL.woodDark), true);
    ring.position.set(cx, cy, W + 1.2);
    box(1.4, r * 2, 1.2, cx, cy, W + 0.9, toon(PAL.woodDark));
    box(r * 2, 1.4, 1.2, cx, cy, W + 0.9, toon(PAL.woodDark));
  } else if (id === "sunny") {
    // 큰 창 + 커튼 + 바닥에 떨어진 햇살
    const cx = right + 29;
    const cy = 70;
    const w = 44;
    const h = 50;
    squareWindow(cx, cy, w, h, "sky", PAL.cream);
    focus.push(v(cx + w / 2 + 9, cy + h / 2 + 6, W), v(cx + w / 2 + 9, cy - h / 2, W)); // 창 (햇살은 바닥에 저절로 보인다)
    const cur = toon(PAL.butter);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) box(3.2, h + 10, 1.2, cx + s * (w / 2 + 4 + i * 2.6), cy + 2, W + 3 + (i % 2) * 0.8, cur, true);
    }
    const rod = mesh(new THREE.CylinderGeometry(0.8, 0.8, w + 26, 10), toon(PAL.woodDark));
    rod.rotation.z = Math.PI / 2;
    rod.position.set(cx, cy + h / 2 + 8, W + 3);
    const sun = new THREE.Shape();
    sun.moveTo(cx - w / 2, 2);
    sun.lineTo(cx + w / 2, 2);
    sun.lineTo(cx + w / 2 - 30, 72);
    sun.lineTo(cx - w / 2 - 30, 72);
    sun.closePath();
    const patchMat = new THREE.MeshBasicMaterial({ color: PAL.butter, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
    own.push(patchMat);
    const patch = mesh(new THREE.ShapeGeometry(sun), patchMat);
    patch.rotation.x = -Math.PI / 2;
    patch.position.y = 0.15;
    patch.receiveShadow = false;
    // Shape 의 y 가 바닥의 -z 로 가므로 뒤집어 앞쪽으로
    patch.scale.y = -1;
  } else if (id === "cabin") {
    // 숲이 보이는 창 + 두꺼운 나무틀, 벽 등
    squareWindow(right + 38, 74, 40, 44, "forest", "#7a5236");
    focus.push(v(right + 62, 100, W), v(right + 62, 50, W));
    const lamp = mesh(new THREE.SphereGeometry(4.2, 16, 12), new THREE.MeshToonMaterial({ color: PAL.butter, emissive: PAL.butter, emissiveIntensity: 0.55 }));
    own.push(lamp.material as THREE.Material);
    lamp.position.set(left - 22, 118, W + 6);
    box(2, 8, 6, left - 22, 110, W + 3, toon("#7a5236"));
  }
  return { group, own, focus };
}
