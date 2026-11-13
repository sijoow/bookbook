// 동반 동물 (입체) — 강아지·고양이·토끼·햄스터·병아리. 아바타를 졸졸 따라다니고, 아바타가 앉으면 방석 옆에서 쉰다(읽는 동안엔 꾸벅 잔다).
// 11-12 사용자: "동반 애견이나 이런 요소도 고를 수 있게". 공·원기둥·원뿔로만 만든다 (그림 파일 없음). 단위 cm, 앞 = +z.

import * as THREE from "three";
import type { Pet as PetKind } from "@/lib/avatar/config";
import { approach, turnDelta } from "@/lib/library3d/motion";
import { PAL } from "./textures";
import { Kit } from "./toon";
import { FEATURES } from "@/lib/features";
import { loadPart, partReady } from "./avatar3d";

/** Blender 동물 덩어리 색 (scripts/blender/pets.py 이름: main·accent·pink·nose·beak·earL/R·tail) */
const PET_COLORS: Record<string, { main: string; accent?: string; pink?: string; nose?: string; beak?: string; ear?: string; tail?: string }> = {
  dog: { main: "#f3dcb6", accent: "#fbecd2", nose: PAL.inkDeep, ear: "#b98552", tail: "#b98552" },
  cat: { main: "#f2b56b", accent: "#fbecd2", nose: PAL.coral },
  rabbit: { main: "#fbf7f2", pink: "#f6b8b0", nose: PAL.coral },
  hamster: { main: "#e9b46e", accent: "#fbf3e3", pink: "#f6b8b0", nose: PAL.coral },
  chick: { main: PAL.butter, beak: PAL.apricot },
};
/** 눈 자리 — 코드 몸과 같다 (y, z, 사이, 크기) */
const PET_FACE: Record<string, [number, number, number, number?]> = { dog: [10.2, 6.9, 1.55], cat: [9.9, 6.6, 1.45], rabbit: [10.4, 5.9, 1.5], hamster: [5.9, 4.85, 1.45, 0.5], chick: [8.7, 3.6, 1.2, 0.45] };

const sphere = (r: number, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);

export class Pet {
  readonly root = new THREE.Group(); // 바닥 자리·방향
  sleeping = false;
  private body = new THREE.Group(); // 깡충·숨쉬기
  private tail: THREE.Object3D | null = null;
  private ears: THREE.Object3D[] = [];
  private eyes: THREE.Object3D[] = [];
  private kit: Kit;
  private t = Math.random() * 10;
  private phase = 0;
  private moving = 0;
  private react = 0; // 눌렸을 때 반응 (1 → 0, 0.7초)

  /** 눌렸다 — 콩 뛰며 한 바퀴 (자고 있었어도 잠깐 눈을 뜬다) */
  poke() {
    this.react = 1;
  }

  constructor(
    readonly kind: Exclude<PetKind, "none">,
    gradient: THREE.Texture,
  ) {
    this.kit = new Kit(gradient);
    this.root.add(this.body);
    this.build();
    // Blender 몸 — 받아 둔 게 있으면 바로, 아니면 받은 뒤 바꿔 끼운다 (그동안은 코드 몸)
    if (FEATURES.blenderParts) {
      const name = `pet-${this.kind}`;
      const ready = partReady(name);
      if (ready) this.useBlender(ready);
      else void loadPart(name).then((src) => src && !this.gone && this.useBlender(src));
    }
  }

  /** target 쪽으로 따라간다. 가까우면 멈춰 face 쪽을 본다 */
  update(dt: number, target: THREE.Vector3, face?: number) {
    this.t += dt;
    const p = this.root.position;
    const dx = target.x - p.x;
    const dz = target.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 1.5) {
      const step = Math.min(dist, Math.min(140, dist * 5) * dt);
      p.x += (dx / dist) * step;
      p.z += (dz / dist) * step;
      this.moving = approach(this.moving, 1, 10, dt);
      const want = Math.atan2(dx, dz);
      this.root.rotation.y += turnDelta(this.root.rotation.y, want) * (1 - Math.exp(-12 * dt));
    } else {
      this.moving = approach(this.moving, 0, 6, dt);
      if (face !== undefined) this.root.rotation.y += turnDelta(this.root.rotation.y, face) * (1 - Math.exp(-4 * dt));
    }
    this.phase += dt * (this.moving > 0.2 ? 15 : 0);
    this.body.position.y = Math.abs(Math.sin(this.phase)) * 2.2 * this.moving;
    const breath = this.sleeping ? 0.05 * Math.sin(this.t * 1.6) : 0.025 * Math.sin(this.t * 2.6);
    this.body.scale.set(1, 1 + breath * (1 - this.moving), 1);
    // 꼬리·귀
    if (this.tail) {
      const wag = this.kind === "dog" ? Math.sin(this.t * (this.sleeping ? 2 : 13)) * (this.sleeping ? 0.15 : 0.55) : Math.sin(this.t * 1.6) * 0.3;
      this.tail.rotation.y = wag;
    }
    this.ears.forEach((e, i) => (e.rotation.z = (i ? -1 : 1) * (0.05 * Math.sin(this.t * 3 + i) + (this.moving > 0.3 ? 0.12 : 0))));
    // 자면 눈을 감는다 (가끔 깜빡)
    // 눌렸을 때 — 콩 + 한 바퀴
    if (this.react > 0) {
      this.react = Math.max(0, this.react - dt * 1.45);
      const k = 1 - this.react;
      this.body.position.y += Math.sin(k * Math.PI) * 6;
      this.body.rotation.y = k * Math.PI * 2;
      if (this.tail) this.tail.rotation.y = Math.sin(this.t * 20) * 0.7;
    } else this.body.rotation.y = 0;
    const blink = !this.sleeping && Math.sin(this.t * 0.9) > 0.985;
    for (const e of this.eyes) e.scale.y = (this.sleeping && this.react === 0) || blink ? 0.18 : 1;
  }

  private gone = false;

  /** Blender 몸으로 — 코드 몸을 치우고, 덩어리마다 만화 재질 + 갈색 펜 테두리. 귀(earL·earR)·꼬리(tail)는 축이 붙는 곳이라 그대로 흔든다 */
  private useBlender(src: THREE.Object3D) {
    for (const c of [...this.body.children]) c.removeFromParent();
    this.ears = [];
    this.tail = null;
    this.eyes = [];
    const C = PET_COLORS[this.kind] ?? { main: "#ffffff" };
    const root = src.clone(true);
    const named: THREE.Object3D[] = [];
    root.traverse((o) => named.push(o));
    for (const o of named) {
      const m = o as THREE.Mesh;
      if (!m.isMesh) continue;
      const n = m.name;
      const color = n.startsWith("ear") ? (C.ear ?? C.main) : n === "tail" ? (C.tail ?? C.main) : n.startsWith("pink") ? (C.pink ?? C.main) : n === "accent" ? (C.accent ?? C.main) : n === "nose" ? (C.nose ?? PAL.inkDeep) : n === "beak" ? (C.beak ?? C.main) : C.main;
      m.material = this.kit.toon(color);
      m.castShadow = true;
      if (n !== "nose") m.add(new THREE.Mesh(m.geometry, this.kit.outline(n === "main" ? 0.26 : 0.18)));
      if (n === "earL" || n === "earR") this.ears.push(m);
      if (n === "tail") this.tail = m;
    }
    this.body.add(root);
    const f = PET_FACE[this.kind];
    if (f) this.face(f[0], f[1], f[2], f[3]);
  }

  dispose() {
    this.gone = true;
    this.root.removeFromParent();
    this.kit.dispose();
  }

  // ── 만들기 ──

  private add(geo: THREE.BufferGeometry, color: string, pos: [number, number, number], scale: [number, number, number] = [1, 1, 1], line = 0.24, parent: THREE.Object3D = this.body) {
    const m = this.kit.part(geo, this.kit.toon(color), line);
    m.position.set(...pos);
    m.scale.set(...scale);
    parent.add(m);
    return m;
  }

  private face(y: number, z: number, gap: number, r = 0.55) {
    for (const s of [-1, 1]) this.eyes.push(this.add(sphere(r, 10, 8), PAL.inkDeep, [s * gap, y, z], [1, 1, 1], 0));
  }

  private legs(color: string, xs: number, zs: number, h = 3) {
    for (const x of [-xs, xs]) for (const z of [-zs, zs]) this.add(new THREE.CylinderGeometry(1.05, 1.1, h, 10), color, [x, h / 2, z], [1, 1, 1], 0.2);
  }

  private build() {
    switch (this.kind) {
      case "dog": {
        const fur = "#f3dcb6";
        const ear = "#b98552";
        this.add(sphere(4.6), fur, [0, 5.2, 0], [1, 0.85, 1.3]);
        this.add(sphere(3.9), fur, [0, 9.4, 3.6]);
        this.add(sphere(1.7), "#fbecd2", [0, 8.6, 7.0], [1.1, 0.8, 1]);
        this.add(sphere(0.65, 10, 8), PAL.inkDeep, [0, 9.1, 8.65], [1, 1, 1], 0);
        this.face(10.2, 6.9, 1.55);
        for (const s of [-1, 1]) {
          const e = this.add(sphere(1.9), ear, [s * 3.6, 9.5, 3.1], [0.6, 1.3, 0.9]);
          e.rotation.z = s * 0.35;
          this.ears.push(e);
        }
        this.legs(fur, 2.2, 2.6);
        const tail = new THREE.Group();
        tail.position.set(0, 6.4, -5.2);
        this.add(new THREE.ConeGeometry(0.95, 3.4, 10), ear, [0, 1.4, -0.5], [1, 1, 1], 0.2, tail).rotation.x = -0.75;
        this.body.add(tail);
        this.tail = tail;
        break;
      }
      case "cat": {
        const fur = "#f2b56b";
        this.add(sphere(4.4), fur, [0, 5.0, 0], [1, 0.82, 1.25]);
        this.add(sphere(3.7), fur, [0, 9.2, 3.4]);
        this.add(sphere(1.5), "#fbecd2", [0, 8.4, 6.4], [1.2, 0.75, 0.8]);
        this.add(sphere(0.5, 10, 8), PAL.coral, [0, 8.9, 7.1], [1, 1, 1], 0);
        this.face(9.9, 6.6, 1.45);
        for (const s of [-1, 1]) {
          const e = this.add(new THREE.ConeGeometry(1.35, 2.6, 10), fur, [s * 2.0, 12.4, 3.2]);
          e.rotation.z = -s * 0.3;
          this.ears.push(e);
        }
        this.legs(fur, 2.1, 2.4);
        const tail = new THREE.Group();
        tail.position.set(0, 5.6, -5.0);
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 3, -1.6), new THREE.Vector3(0, 6.5, -0.8), new THREE.Vector3(0, 8, 0.6)]);
        this.add(new THREE.TubeGeometry(curve, 16, 0.85, 8), fur, [0, 0, 0], [1, 1, 1], 0.2, tail);
        this.body.add(tail);
        this.tail = tail;
        break;
      }
      case "rabbit": {
        const fur = "#fbf7f2";
        this.add(sphere(5.0), fur, [0, 5.0, 0], [1, 0.9, 1.1]);
        this.add(sphere(3.8), fur, [0, 9.8, 2.6]);
        this.add(sphere(0.55, 10, 8), PAL.coral, [0, 9.4, 6.35], [1, 1, 1], 0);
        this.face(10.4, 5.9, 1.5);
        for (const s of [-1, 1]) {
          const e = this.add(new THREE.CapsuleGeometry(1.0, 4.6, 4, 10), fur, [s * 1.4, 15.4, 2.2]);
          e.rotation.z = -s * 0.18;
          this.add(new THREE.CapsuleGeometry(0.55, 3.6, 4, 8), "#f6b8b0", [0, 0, 0.55], [1, 1, 0.5], 0, e);
          this.ears.push(e);
        }
        const tail = new THREE.Group();
        tail.position.set(0, 4.6, -5.2);
        this.add(sphere(1.7), fur, [0, 0, 0], [1, 1, 1], 0.2, tail);
        this.body.add(tail);
        this.tail = tail;
        break;
      }
      case "hamster": {
        const fur = "#e9b46e";
        this.add(sphere(4.3), fur, [0, 4.3, 0], [1.1, 0.95, 1.2]);
        this.add(sphere(2.8), "#fbf3e3", [0, 3.6, 2.9], [1, 0.9, 0.6], 0);
        this.add(sphere(0.45, 10, 8), PAL.coral, [0, 5.0, 5.25], [1, 1, 1], 0);
        this.face(5.9, 4.85, 1.45, 0.5);
        for (const s of [-1, 1]) {
          const e = this.add(sphere(1.1), fur, [s * 2.4, 8.2, 1.0], [1, 1, 0.6]);
          this.ears.push(e);
          this.add(sphere(1.0, 10, 8), "#f6b8b0", [s * 2.9, 4.7, 4.1], [1, 0.7, 0.5], 0); // 볼
        }
        break;
      }
      case "chick": {
        const fur = PAL.butter;
        this.add(sphere(3.8), fur, [0, 3.9, 0], [1, 0.95, 1.1]);
        this.add(sphere(2.8), fur, [0, 8.0, 1.2]);
        const beak = this.add(new THREE.ConeGeometry(0.8, 1.7, 10), PAL.apricot, [0, 7.8, 4.4], [1, 1, 1], 0.15);
        beak.rotation.x = Math.PI / 2;
        this.face(8.7, 3.6, 1.2, 0.45);
        for (const s of [-1, 1]) {
          const w = this.add(sphere(1.8), fur, [s * 3.6, 4.4, -0.2], [0.45, 0.9, 1.1]);
          w.rotation.z = s * 0.35;
          this.ears.push(w);
          this.add(new THREE.BoxGeometry(1.4, 0.4, 1.8), PAL.apricot, [s * 1.3, 0.2, 1.0], [1, 1, 1], 0.1);
        }
        break;
      }
    }
  }
}
