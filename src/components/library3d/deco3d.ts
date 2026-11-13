// 꾸미기 물건 (입체) — 선물로 받는 아바타 소품 7가지 · 도서관 물건 7가지 · 선물 상자. 공·원기둥·상자로만 만든다 (그림 파일 없음).
// 색은 앱 팔레트. 하지 말 것: 광택, 그라디언트, 보라. 단위 cm.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Outfit } from "@/lib/avatar/config";
import { PAL, loadTexture } from "./textures";
import type { Kit } from "./toon";

export type Anchor = "head" | "neck" | "back";
export type RoomCtx = { caseX: number; caseHalf: number; caseTop: number; wallZ: number; cushion: THREE.Vector3 };
export type RoomItem3D = { obj: THREE.Object3D; tick?: (t: number) => void; focus: THREE.Vector3[]; at: THREE.Vector3 };

const GREEN = "#8fc79f";
const GREEN_2 = "#79b48c";
const GOLD = "#f3c95c";
const CAT = "#f2b56b";
const BEAR = "#a0704b";
const PINK = "#f2b8a2";

/** 옷 색과 겹치지 않는 강조색 */
const accent = (o: Outfit) => (o === "coral" ? PAL.mint : PAL.coral);

function star(outer: number, inner: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? inner : outer;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

const sphere = (r: number, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);

// ── 아바타 소품 ── (head = 머리 가운데 기준, neck·back = 몸 기준)

export function buildWearable(id: string, kit: Kit, outfit: Outfit): { anchor: Anchor; obj: THREE.Object3D } | null {
  const g = new THREE.Group();
  const acc = kit.toon(accent(outfit));
  switch (id) {
    case "ribbon": {
      for (const s of [-1, 1]) {
        const loop = kit.part(sphere(2.3), acc, 0.25);
        loop.scale.set(1.35, 0.85, 0.55);
        loop.position.set(s * 2.4, 0, 0);
        loop.rotation.z = s * 0.35;
        const tail = kit.part(new THREE.BoxGeometry(0.9, 2.6, 0.4), acc, 0.2);
        tail.position.set(s * 0.9, -2.0, 0);
        tail.rotation.z = s * 0.3;
        g.add(loop, tail);
      }
      g.add(kit.part(sphere(1.15), acc, 0.2));
      g.position.set(5.2, 8.4, 2.0);
      g.rotation.set(0.2, 0.35, -0.55);
      return { anchor: "head", obj: g };
    }
    case "starpin": {
      const geo = new THREE.ExtrudeGeometry(star(2.9, 1.3), { depth: 0.7, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 2 });
      geo.center();
      const m = kit.part(geo, kit.toon(PAL.butter), 0.2);
      g.add(m);
      const p = new THREE.Vector3(7.4, 5.2, 3.8);
      g.position.copy(p);
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), p.clone().normalize());
      return { anchor: "head", obj: g };
    }
    case "flowers": {
      const vine = kit.part(new THREE.TorusGeometry(10.0, 0.5, 8, 48), kit.toon(GREEN_2), 0);
      vine.rotation.x = Math.PI / 2;
      g.add(vine);
      const colors = [PAL.coral, PAL.cream, PAL.sky, PAL.butter];
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2;
        const f = kit.part(sphere(1.5, 12, 10), kit.toon(colors[i % colors.length]), 0.18);
        f.position.set(Math.sin(a) * 10.0, 0.4, Math.cos(a) * 10.0);
        f.scale.y = 0.75;
        const c = kit.part(sphere(0.55, 8, 6), kit.toon(i % 4 === 3 ? PAL.coral : PAL.butter), 0);
        c.position.set(Math.sin(a) * 11.2, 0.6, Math.cos(a) * 11.2);
        g.add(f, c);
      }
      g.position.set(0, 4.6, -0.4);
      g.rotation.x = -0.36;
      return { anchor: "head", obj: g };
    }
    case "bear": {
      for (const s of [-1, 1]) {
        const ear = kit.part(sphere(3.3), kit.toon(BEAR), 0.25);
        ear.scale.set(1, 1, 0.6);
        ear.position.set(s * 6.3, 8.4, -0.6);
        const inner = kit.part(sphere(1.8, 12, 8), kit.toon(PINK), 0);
        inner.scale.set(1, 1, 0.5);
        inner.position.set(s * 6.3, 8.2, 1.0);
        g.add(ear, inner);
      }
      return { anchor: "head", obj: g };
    }
    case "crown": {
      const gold = kit.toon(GOLD, { side: THREE.DoubleSide });
      const ring = kit.part(new THREE.CylinderGeometry(4.8, 5.1, 3.0, 28, 1, true), gold, 0);
      g.add(ring);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spike = kit.part(new THREE.ConeGeometry(1.0, 2.6, 10), gold, 0.15);
        spike.position.set(Math.sin(a) * 4.8, 2.7, Math.cos(a) * 4.8);
        const ball = kit.part(sphere(0.55, 8, 6), gold, 0);
        ball.position.set(Math.sin(a) * 4.8, 4.1, Math.cos(a) * 4.8);
        g.add(spike, ball);
      }
      const gems = [PAL.coral, PAL.sky, PAL.mint];
      gems.forEach((c, i) => {
        const a = (i - 1) * 0.9;
        const gem = kit.part(sphere(0.75, 10, 8), kit.toon(c), 0.12);
        gem.position.set(Math.sin(a) * 5.1, 0, Math.cos(a) * 5.1);
        g.add(gem);
      });
      g.position.set(0, 10.0, -0.6);
      g.rotation.set(-0.12, 0, 0.1);
      return { anchor: "head", obj: g };
    }
    case "scarf": {
      const ring = kit.part(new THREE.TorusGeometry(4.9, 1.7, 10, 28), acc, 0.25);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 16.2, 0.2);
      const tail = kit.part(new RoundedBoxGeometry(2.8, 6.5, 1.0, 2, 0.4), acc, 0.22);
      tail.position.set(2.6, 12.2, 5.6);
      tail.rotation.set(0.12, 0, 0.12);
      for (const y of [10.4, 12.0]) {
        const stripe = kit.part(new THREE.BoxGeometry(2.9, 0.6, 1.05), kit.toon(PAL.cream), 0);
        stripe.position.set(2.6 + (y - 12.2) * 0.12, y, 5.62);
        stripe.rotation.copy(tail.rotation);
        g.add(stripe);
      }
      g.add(ring, tail);
      return { anchor: "neck", obj: g };
    }
    case "bag": {
      const col = outfit === "apricot" ? PAL.butter : PAL.apricot;
      const body = kit.part(new RoundedBoxGeometry(9, 9.5, 4.2, 3, 1.4), kit.toon(col), 0.3);
      body.position.set(0, 11.6, -7.8);
      const flap = kit.part(new RoundedBoxGeometry(9.3, 4.4, 4.7, 2, 1.2), kit.toon(col === PAL.butter ? PAL.apricot : PAL.butter), 0.25);
      flap.position.set(0, 14.4, -7.8);
      const buckle = kit.part(sphere(0.8, 10, 8), kit.toon(PAL.cream), 0.15);
      buckle.position.set(0, 12.6, -10.2);
      g.add(body, flap, buckle);
      for (const s of [-1, 1]) {
        const strap = kit.part(new THREE.BoxGeometry(1.3, 8, 0.6), kit.toon(PAL.shoe), 0);
        strap.position.set(s * 3.4, 13.4, -5.6);
        strap.rotation.x = 0.28;
        g.add(strap);
      }
      return { anchor: "back", obj: g };
    }
  }
  return null;
}

// ── 도서관 물건 ──

function boxCorners(c: THREE.Vector3, w: number, h: number, d: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const x of [-w / 2, w / 2]) for (const y of [0, h]) for (const z of [-d / 2, d / 2]) out.push(new THREE.Vector3(c.x + x, c.y + y, c.z + z));
  return out;
}

function skyTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 200;
  const x = c.getContext("2d")!;
  x.fillStyle = "#bfe1ef";
  x.fillRect(0, 0, 256, 200);
  x.fillStyle = "#ffffff";
  for (const [cx, cy, r] of [
    [70, 70, 22],
    [98, 62, 26],
    [126, 74, 20],
    [180, 132, 16],
    [200, 126, 20],
  ]) {
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fill();
  }
  // 작은 별 하나
  x.fillStyle = PAL.butter;
  x.strokeStyle = PAL.ink;
  x.lineWidth = 3;
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 6 : 14;
    x.lineTo(206 + Math.cos(a) * r, 46 + Math.sin(a) * r);
  }
  x.closePath();
  x.fill();
  x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildRoomItem(id: string, kit: Kit, ctx: RoomCtx): RoomItem3D | null {
  const g = new THREE.Group();
  const wood = kit.toon(PAL.wood);
  const woodLight = kit.toon(PAL.woodLight);
  const { cushion: c } = ctx;
  switch (id) {
    case "plant": {
      // 책장 위 왼쪽 끝 (방이 옆으로 넓어지지 않게 — 책장이 크게 보이도록)
      const at = new THREE.Vector3(ctx.caseX - ctx.caseHalf + 6.5, ctx.caseTop, -11);
      const pot = kit.part(new THREE.CylinderGeometry(5.6, 4.4, 9, 22), kit.toon("#d98b5f"), 0.3);
      pot.position.y = 4.5;
      const rim = kit.part(new THREE.TorusGeometry(5.6, 0.75, 8, 24), kit.toon("#e29a70"), 0.2);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 9;
      const soil = kit.part(new THREE.CylinderGeometry(5.0, 5.0, 0.6, 20), kit.toon("#7a5236"), 0);
      soil.position.y = 8.7;
      const leaves = new THREE.Group();
      for (const [x, y, z, r, col] of [
        [0, 15.5, 0, 4.8, GREEN],
        [-3.6, 12.6, 1, 3.4, PAL.mint],
        [3.7, 13.2, -0.6, 3.6, GREEN_2],
        [1, 20, 0.5, 3.2, PAL.mint],
        [-1.9, 18.4, -1.6, 2.9, GREEN],
      ] as const) {
        const l = kit.part(sphere(r), kit.toon(col), 0.25);
        l.position.set(x, y, z);
        l.scale.y = 1.12;
        leaves.add(l);
      }
      g.add(pot, rim, soil, leaves);
      g.position.copy(at);
      g.scale.setScalar(0.62);
      return { obj: g, at, focus: boxCorners(at, 8, 16, 8), tick: (t) => (leaves.rotation.z = Math.sin(t * 1.3) * 0.035) };
    }
    case "lamp": {
      // 책장 위 오른쪽 끝 책상 스탠드 — 책등을 비추는 따뜻한 빛
      const at = new THREE.Vector3(ctx.caseX + ctx.caseHalf - 6.5, ctx.caseTop, -11);
      const metal = kit.toon(PAL.inkSoft);
      const base = kit.part(new THREE.CylinderGeometry(3.2, 3.6, 1.1, 22), metal, 0.2);
      base.position.y = 0.55;
      const stem = kit.part(new THREE.CylinderGeometry(0.5, 0.5, 11, 10), metal, 0.15);
      stem.position.y = 6.5;
      const head = new THREE.Group();
      head.position.set(0, 12.2, 0.6);
      head.rotation.x = 0.35;
      const shade = kit.part(new THREE.CylinderGeometry(2.4, 4.6, 5.2, 24, 1, true), kit.toon(PAL.butter, { side: THREE.DoubleSide, emissive: "#f6d77c", emissiveIntensity: 0.25 }), 0);
      const bulb = kit.part(sphere(1.4), kit.basic({ color: "#fff4cf" }), 0, false);
      bulb.position.y = -1.2;
      head.add(shade, bulb);
      const glow = new THREE.PointLight("#ffd9a0", 0.45, 70, 0);
      glow.position.set(0, 9, 4);
      g.add(base, stem, head, glow);
      g.position.copy(at);
      return { obj: g, at, focus: boxCorners(at, 10, 16, 10) };
    }
    case "window": {
      const at = new THREE.Vector3(ctx.caseX - 15, ctx.caseTop + 14, ctx.wallZ + 0.4);
      const W = 30;
      const H = 23;
      const glassTex = kit.keep(skyTexture());
      const glass = new THREE.Mesh(kit.keep(new THREE.PlaneGeometry(W - 3, H - 3)), kit.basic({ map: glassTex }));
      glass.position.set(0, H / 2, 0.2);
      g.add(glass);
      const bar = (w: number, h: number, x: number, y: number, mat = woodLight, d = 1.6) => {
        const b = kit.part(new THREE.BoxGeometry(w, h, d), mat, 0.18);
        b.position.set(x, y, 0.8);
        g.add(b);
      };
      bar(W, 2.2, 0, 1.1);
      bar(W, 2.2, 0, H - 1.1);
      bar(2.2, H, -W / 2 + 1.1, H / 2);
      bar(2.2, H, W / 2 - 1.1, H / 2);
      bar(1, H - 3, 0, H / 2, woodLight, 1);
      bar(W - 3, 1, 0, H / 2, woodLight, 1);
      bar(W + 5, 1.6, 0, -0.4, wood, 4);
      // 커튼
      for (const s of [-1, 1]) {
        const cur = kit.part(new RoundedBoxGeometry(6, H + 2, 1.2, 2, 0.5), kit.toon(PAL.coral), 0.2);
        cur.position.set(s * (W / 2 + 1.5), H / 2 + 0.5, 2.0);
        const tie = kit.part(new THREE.BoxGeometry(6.4, 1.2, 1.5), kit.toon(PAL.butter), 0);
        tie.position.set(s * (W / 2 + 1.5), H / 2 - 2, 2.1);
        g.add(cur, tie);
      }
      g.position.copy(at);
      return { obj: g, at, focus: boxCorners(at, W + 14, H + 2, 3) };
    }
    case "frame": {
      const at = new THREE.Vector3(ctx.caseX + 17, ctx.caseTop + 15, ctx.wallZ + 0.6);
      const card = new THREE.Mesh(kit.keep(new THREE.PlaneGeometry(17, 17)), kit.toon(PAL.cream));
      card.position.set(0, 9, 0.9);
      const picMat = kit.basic({ transparent: true, alphaTest: 0.3 });
      const pic = new THREE.Mesh(kit.keep(new THREE.PlaneGeometry(13.5, 13.5)), picMat);
      pic.position.set(0, 9, 1.0);
      loadTexture("/img/planet-home.webp")
        .then((t) => {
          picMat.map = t;
          picMat.needsUpdate = true;
        })
        .catch(() => pic.removeFromParent());
      g.add(card, pic);
      for (const [w, h, x, y] of [
        [19.6, 1.6, 0, 0.8],
        [19.6, 1.6, 0, 17.2],
        [1.6, 18, -9, 9],
        [1.6, 18, 9, 9],
      ] as const) {
        const b = kit.part(new THREE.BoxGeometry(w, h, 1.4), wood, 0.15);
        b.position.set(x, y, 0.9);
        g.add(b);
      }
      // 마스킹테이프 (다꾸)
      for (const s of [-1, 1]) {
        const tape = new THREE.Mesh(kit.keep(new THREE.PlaneGeometry(6.5, 2.2)), kit.basic({ color: PAL.butter, transparent: true, opacity: 0.82 }));
        tape.position.set(s * 8.2, 17.6, 1.7);
        tape.rotation.z = s * -0.6;
        g.add(tape);
      }
      g.position.copy(at);
      g.rotation.z = 0.04;
      return { obj: g, at, focus: boxCorners(at, 22, 20, 3) };
    }
    case "lights": {
      const y = ctx.caseTop + 9;
      const x0 = ctx.caseX - ctx.caseHalf + 3;
      const x1 = ctx.caseX + ctx.caseHalf - 3;
      const z = ctx.wallZ + 1.4;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, y - 7 * 4 * t * (1 - t), z));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const wire = new THREE.Mesh(kit.keep(new THREE.TubeGeometry(curve, 60, 0.22, 6)), kit.toon(PAL.ink));
      g.add(wire);
      const colors = [PAL.butter, PAL.coral, PAL.mint, PAL.sky];
      const bulbs: THREE.MeshToonMaterial[] = [];
      for (let i = 0; i < 9; i++) {
        const p = curve.getPoint((i + 0.5) / 9);
        const mat = kit.toon(colors[i % 4], { emissive: colors[i % 4], emissiveIntensity: 0.6 });
        bulbs.push(mat);
        const b = kit.part(sphere(1.15, 12, 10), mat, 0.15, false);
        b.scale.y = 1.3;
        b.position.copy(p).add(new THREE.Vector3(0, -1.3, 0.4));
        g.add(b);
      }
      const at = new THREE.Vector3(ctx.caseX, y - 8, z);
      return {
        obj: g,
        at,
        focus: [new THREE.Vector3(x0, y + 1, z), new THREE.Vector3(x1, y + 1, z), new THREE.Vector3(ctx.caseX, y - 10, z)],
        tick: (t) => bulbs.forEach((m, i) => (m.emissiveIntensity = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7)))),
      };
    }
    case "cat": {
      const at = new THREE.Vector3(c.x - 24, 0, c.z - 5);
      const fur = kit.toon(CAT);
      const cat = new THREE.Group();
      const body = kit.part(sphere(6, 24, 16), fur, 0.3);
      body.scale.set(1.25, 0.62, 1.0);
      body.position.y = 3.6;
      const head = kit.part(sphere(3.6, 20, 14), fur, 0.3);
      head.position.set(4.6, 4.3, 3.2);
      for (const s of [-1, 1]) {
        const ear = kit.part(new THREE.ConeGeometry(1.35, 2.6, 10), fur, 0.18);
        ear.position.set(4.6 + s * 1.7, 7.2, 3.0);
        ear.rotation.z = -s * 0.32;
        const eye = kit.part(new THREE.BoxGeometry(1.1, 0.28, 0.2), kit.toon(PAL.inkDeep), 0, false);
        eye.position.set(4.6 + s * 1.25, 4.6, 6.62);
        eye.rotation.z = s * 0.25;
        cat.add(ear, eye);
      }
      const tailCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-7, 2.2, 0), new THREE.Vector3(-6.4, 1.6, 4.6), new THREE.Vector3(-2, 1.4, 7.0), new THREE.Vector3(2.4, 1.6, 6.6)]);
      const tail = kit.part(new THREE.TubeGeometry(tailCurve, 20, 1.1, 8), fur, 0.25);
      cat.add(body, head, tail);
      g.add(cat);
      g.position.copy(at);
      g.rotation.y = 0.5;
      return { obj: g, at, focus: boxCorners(at, 18, 9, 16), tick: (t) => cat.scale.set(1, 1 + 0.035 * Math.sin(t * 2), 1) };
    }
    case "ladder": {
      // 책장 사다리 (책장 꾸미기, 11-13) — 책장 오른쪽 옆판에 비스듬히 기대 둔다. 바닥 발이 옆으로 벌어진다
      const H = Math.max(40, ctx.caseTop * 0.92);
      const lean = 8;
      const len = Math.hypot(H, lean);
      const at = new THREE.Vector3(ctx.caseX + ctx.caseHalf + lean + 1.2, 0, -12);
      const ladder = new THREE.Group();
      for (const z of [-5.2, 5.2]) {
        const rail = kit.part(new THREE.BoxGeometry(1.5, len, 1.5), wood, 0.2);
        rail.position.set(0, len / 2, z);
        ladder.add(rail);
      }
      for (let y = 7; y < len - 3; y += 8.5) {
        const rung = kit.part(new THREE.CylinderGeometry(0.55, 0.55, 10.4, 10), woodLight, 0.15);
        rung.rotation.x = Math.PI / 2;
        rung.position.set(0, y, 0);
        ladder.add(rung);
      }
      ladder.rotation.z = Math.atan2(lean, H); // 위가 책장 쪽으로 기운다
      g.add(ladder);
      g.position.copy(at);
      return { obj: g, at, focus: [at.clone().add(new THREE.Vector3(-lean, H, -6)), at.clone().add(new THREE.Vector3(2, 0, 6))] };
    }
    case "table": {
      const at = new THREE.Vector3(c.x + 25, 0, c.z - 3);
      const base = kit.part(new THREE.CylinderGeometry(4.2, 4.6, 1.2, 22), wood, 0.2);
      base.position.y = 0.6;
      const leg = kit.part(new THREE.CylinderGeometry(1.1, 1.1, 12.5, 12), wood, 0.18);
      leg.position.y = 6.8;
      const top = kit.part(new THREE.CylinderGeometry(7.5, 7.5, 1.6, 30), woodLight, 0.25);
      top.position.y = 13.6;
      const mug = kit.part(new THREE.CylinderGeometry(1.9, 1.7, 3.6, 18), kit.toon(PAL.coral), 0.2);
      mug.position.set(1.8, 16.2, 1.4);
      const handle = kit.part(new THREE.TorusGeometry(1.05, 0.35, 8, 16), kit.toon(PAL.coral), 0.12);
      handle.position.set(3.8, 16.2, 1.4);
      const coffee = kit.part(new THREE.CylinderGeometry(1.7, 1.7, 0.2, 18), kit.toon("#6b4a33"), 0);
      coffee.position.set(1.8, 17.9, 1.4);
      const book = kit.part(new THREE.BoxGeometry(5, 0.9, 7), kit.toon(PAL.sky), 0.15);
      book.position.set(-2.6, 14.85, -0.6);
      book.rotation.y = 0.35;
      g.add(base, leg, top, mug, handle, coffee, book);
      g.position.copy(at);
      return { obj: g, at, focus: boxCorners(at, 16, 19, 16) };
    }
  }
  return null;
}

/** 선물 상자 — 뚜껑은 따로 (열 때 튀어 오른다) */
export function buildGiftBox(kit: Kit): { obj: THREE.Group; lid: THREE.Group } {
  const g = new THREE.Group();
  const red = kit.toon(PAL.coral);
  const gold = kit.toon(PAL.butter);
  const box = kit.part(new RoundedBoxGeometry(9, 7, 9, 2, 0.8), red, 0.3);
  box.position.y = 3.5;
  const r1 = kit.part(new THREE.BoxGeometry(9.15, 7.1, 1.7), gold, 0);
  r1.position.y = 3.5;
  const r2 = kit.part(new THREE.BoxGeometry(1.7, 7.1, 9.15), gold, 0);
  r2.position.y = 3.5;
  const lid = new THREE.Group();
  lid.position.y = 7.4;
  const top = kit.part(new RoundedBoxGeometry(9.9, 2.2, 9.9, 2, 0.6), red, 0.3);
  const l1 = kit.part(new THREE.BoxGeometry(10.0, 2.3, 1.8), gold, 0);
  const l2 = kit.part(new THREE.BoxGeometry(1.8, 2.3, 10.0), gold, 0);
  lid.add(top, l1, l2);
  for (const s of [-1, 1]) {
    const loop = kit.part(sphere(1.9), gold, 0.2);
    loop.scale.set(1.3, 0.8, 0.6);
    loop.position.set(s * 1.9, 1.9, 0);
    loop.rotation.z = s * 0.4;
    lid.add(loop);
  }
  const knot = kit.part(sphere(0.9, 10, 8), gold, 0.15);
  knot.position.y = 1.7;
  lid.add(knot);
  g.add(box, r1, r2, lid);
  return { obj: g, lid };
}
