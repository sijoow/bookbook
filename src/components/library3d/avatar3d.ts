// 나만의 아바타 (입체) — 공·캡슐·회전체로 만든 아기 비율 캐릭터. 관절(어깨·다리·목)을 돌려 앉기·걷기·손 뻗기·책 들기.
// 얼굴은 캔버스 그림(표정 5개), 테두리는 갈색 펜 선(조금 크게 뒤집은 껍데기). 단위 cm, 발바닥 = root 의 y 0, 앞 = +z.

import * as THREE from "three";
import { AVATAR_COLOR, type AvatarConfig, type Outfit } from "@/lib/avatar/config";
import { FEATURES } from "@/lib/features";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Blender 부위 — 이름마다 한 번만 받는다 (public/models/parts/{이름}.glb) */
const PARTS = new Map<string, Promise<THREE.Object3D | null>>();
const PART_READY = new Map<string, THREE.Object3D | null>(); // 받은 것 — 바로 붙인다 (미리보기 그림이 대머리로 찍히지 않게)
export const BLENDER_PARTS = { hair: Object.fromEntries(["bob", "short", "pigtails", "bun", "beanie", "bowl", "spiky", "side", "long", "ponytail", "braids", "curly", "wavy"].map((h) => [h, `hair-${h}`])) as Record<string, string>, hat: { beret: "hat-beret", cap: "hat-cap", bucket: "hat-bucket", straw: "hat-straw" } as Record<string, string> };
export function loadPart(name: string): Promise<THREE.Object3D | null> {
  let p = PARTS.get(name);
  if (!p) {
    p = new GLTFLoader()
      .loadAsync(`/models/parts/${name}.glb`)
      .then((g) => g.scene as THREE.Object3D)
      .catch(() => null)
      .then((o) => {
        PART_READY.set(name, o);
        return o;
      });
    PARTS.set(name, p);
  }
  return p;
}
/** 미리보기 그림을 찍기 전에 — 쓰는 부위를 다 받아 둔다 */
export function preloadParts(): Promise<unknown> {
  if (!FEATURES.blenderParts) return Promise.resolve();
  return Promise.all([...Object.values(BLENDER_PARTS.hair), ...Object.values(BLENDER_PARTS.hat)].map(loadPart));
}
import { approach } from "@/lib/library3d/motion";
import { buildWearable } from "./deco3d";
import { FACE_EYE, PAL, cachedPattern, clothTexture, faceTexture, hairTexture, loadPattern, type Expr } from "./textures";
import { Kit } from "./toon";

export type Pose = "stand" | "sit" | "sitwave" | "read" | "reach" | "pull" | "carry" | "cheer" | "wave" | "show";

type J = {
  lift: number;
  lean: number;
  headX: number;
  headY: number;
  headZ: number;
  aLX: number;
  aLZ: number;
  aRX: number;
  aRZ: number;
  lLX: number;
  lRX: number;
};
const KEYS = ["lift", "lean", "headX", "headY", "headZ", "aLX", "aLZ", "aRX", "aRZ", "lLX", "lRX"] as const;

/** 방석(높이 6cm) 위에 앉을 때 몸을 올리는 양 — 다리는 방석에 살짝 묻힌다 */
export const SIT_LIFT = 1.2;
export const CUSHION_H = 6;

const BASE: J = { lift: 0, lean: 0, headX: 0, headY: 0, headZ: 0, aLX: 0.06, aLZ: 0.16, aRX: 0.06, aRZ: -0.16, lLX: 0, lRX: 0 };

// 팔 X 회전: 음수 = 앞·위로 / 왼팔(+x 쪽) Z 양수 = 바깥으로
const POSES: Record<Pose, Partial<J>> = {
  stand: {},
  sit: { lift: SIT_LIFT, lLX: -1.5, lRX: -1.5, aLX: -0.5, aRX: -0.5, aLZ: 0.12, aRZ: -0.12, headX: 0.04 },
  sitwave: { lift: SIT_LIFT, lLX: -1.5, lRX: -1.5, aLX: -0.5, aLZ: 0.12, aRX: -2.7, aRZ: -0.45, headZ: 0.1 },
  read: { lift: SIT_LIFT, lLX: -1.5, lRX: -1.5, aLX: -1.22, aRX: -1.22, aLZ: -0.34, aRZ: 0.34, headX: 0.05 },
  reach: { aLX: -2.85, aRX: -2.85, aLZ: 0.1, aRZ: -0.1, headX: -0.42, lean: -0.05 },
  pull: { aLX: -2.25, aRX: -2.25, aLZ: 0.04, aRZ: -0.04, headX: -0.22, lean: -0.2, lLX: -0.22, lRX: 0.2 },
  carry: { aLX: -1.12, aRX: -1.12, aLZ: -0.32, aRZ: 0.32, headX: 0.04 },
  cheer: { aLX: -2.55, aRX: -2.55, aLZ: 0.62, aRZ: -0.62, headX: -0.2 },
  wave: { aRX: -2.75, aRZ: -0.45, headZ: 0.1 },
  show: { aLX: -1.8, aRX: -1.8, aLZ: -0.36, aRZ: 0.36, headX: -0.06 },
};

/** 색을 조금 진하게 (치마·주머니) */
function darker(hex: string, k = 0.18): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(v * (1 - k)).toString(16).padStart(2, "0");
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

/** 옷 가게 옷 (lib/deco/items 의 자리 body) */
const DRESS_IDS = new Set(["stripes", "overalls", "dots", "sweater", "raincoat", "spacesuit"]);

/** 털모자 색 — 옷과 겹치지 않게 */
const HAT: Record<Outfit, string> = { apricot: PAL.mint, mint: PAL.coral, butter: PAL.sky, coral: PAL.butter, sky: PAL.apricot };

const OUTLINE_VS = /* glsl */ `
uniform float thickness;
void main() {
  vec3 p = position + normal * thickness;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const OUTLINE_FS = /* glsl */ `
uniform vec3 color;
void main() {
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;

export class Avatar {
  readonly root = new THREE.Group(); // 바닥 자리·방향·점프 높이·찌그러짐
  readonly body = new THREE.Group(); // 자세 높이·숨·기울기
  readonly head = new THREE.Group();
  readonly armL = new THREE.Group();
  readonly armR = new THREE.Group();
  readonly legL = new THREE.Group();
  readonly legR = new THREE.Group();
  readonly hold = new THREE.Group(); // 책 드는 자리 (가슴 앞)
  readonly tagAnchor = new THREE.Object3D(); // 이름표 자리 (머리 위)
  /** 아바타를 누를 때 맞추는 공 (몸 가운데, 반지름) */
  readonly hitRadius = 17;

  pose: Pose = "sit";
  expr: Expr = "normal";
  walking = false;
  squash = 0; // 점프할 때 + 찌그러짐 / - 늘어남

  private cur: J = { ...BASE, ...POSES.sit };
  private t = Math.random() * 10;
  private walkPhase = 0;
  private walkBlend = 0;
  private blinkIn = 1.5;
  private blinkLeft = 0;
  private torso!: THREE.Mesh;
  private faceMat!: THREE.MeshToonMaterial;
  private faces: Record<Expr, THREE.CanvasTexture>;
  private trash: Array<{ dispose(): void }> = [];
  readonly headCenter = new THREE.Group(); // 머리 가운데 (머리 소품 자리)
  private worn = new Map<string, THREE.Object3D>();
  private wornKit: Kit | null = null;
  private outlines = new Map<number, THREE.ShaderMaterial>();
  // 옷 가게 옷 (자리 body) — 입으면 기본 옷(cfg.outfit 색) 대신
  private clothMat!: THREE.Material;
  private sleeveMat!: THREE.Material; // 소매 (무늬는 몸통보다 크게 반복)
  private pantsMat!: THREE.Material;
  private sleeves: THREE.Mesh[] = [];
  private legMeshes: THREE.Mesh[] = [];
  private shorts: THREE.Mesh | null = null;
  private legBase!: THREE.Material; // 고른 아랫옷의 다리 (맨다리·바지·청바지·스타킹)
  private shortsBase: THREE.Material | null = null; // 고른 아랫옷 (반바지·치마…)
  private profile: THREE.Vector2[] = [];
  private dressed: string | null = null;
  private dressKit: Kit | null = null;
  private dressParts: THREE.Object3D[] = [];
  private hatGroup: THREE.Group | null = null; // 기본 모자 — 머리 소품을 하면 숨긴다

  constructor(
    readonly cfg: AvatarConfig,
    private gradient: THREE.Texture,
    opts: { face?: boolean } = {},
  ) {
    if (opts.face === false) {
      // 얼굴 없이 (꾸미기의 머리 모양 그림 칸 — 빈 얼굴에 머리만)
      const blank = document.createElement("canvas");
      blank.width = blank.height = 2;
      const t = new THREE.CanvasTexture(blank);
      this.faces = { normal: t, blink: t, happy: t, read: t, wow: t };
      this.trash.push(t);
    } else {
      this.faces = {
        normal: faceTexture("normal", cfg),
        blink: faceTexture("blink", cfg),
        happy: faceTexture("happy", cfg),
        read: faceTexture("read", cfg),
        wow: faceTexture("wow", cfg),
      };
      this.trash.push(...Object.values(this.faces));
    }
    this.build();
    this.apply(0);
  }

  setPose(p: Pose) {
    this.pose = p;
  }

  setExpr(e: Expr) {
    this.expr = e;
  }

  /** 아바타 몸 가운데 (누르기 판정용) */
  center(out = new THREE.Vector3()): THREE.Vector3 {
    return this.body.getWorldPosition(out).add(new THREE.Vector3(0, 17, 0));
  }

  update(dt: number) {
    this.t += dt;
    const tg: J = { ...BASE, ...POSES[this.pose] };

    this.walkBlend = approach(this.walkBlend, this.walking ? 1 : 0, 12, dt);
    if (this.walking) this.walkPhase += dt * 12;
    const sw = Math.sin(this.walkPhase) * this.walkBlend;
    const armSwing = this.pose === "stand" ? 0.5 : 0.1;
    tg.lLX += 0.62 * sw;
    tg.lRX -= 0.62 * sw;
    tg.aLX -= armSwing * sw;
    tg.aRX += armSwing * sw;

    const idle = !this.walking;
    if (this.pose === "sit" && idle) {
      // 앉아서 발을 동동
      const k = Math.sin(this.t * 2.4);
      tg.lLX += 0.1 * k;
      tg.lRX -= 0.1 * k;
      tg.headZ += 0.06 * Math.sin(this.t * 0.7);
    }
    if (this.pose === "read") tg.headZ += 0.045 * Math.sin(this.t * 0.9);
    if (this.pose === "wave" || this.pose === "sitwave") tg.aRZ += Math.sin(this.t * 14) * 0.38;
    if (this.pose === "cheer") tg.aLZ += Math.sin(this.t * 16) * 0.12;

    for (const k of KEYS) this.cur[k] = approach(this.cur[k], tg[k], 14, dt);
    this.apply(sw);

    // 깜빡
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkLeft = 0.12;
      this.blinkIn = 2.2 + Math.random() * 3.2;
    }
    if (this.blinkLeft > 0) this.blinkLeft -= dt;
    const blink = this.blinkLeft > 0 && (this.expr === "normal" || this.expr === "read");
    const map = this.faces[blink ? "blink" : this.expr];
    if (this.faceMat.map !== map) this.faceMat.map = map;
  }

  private apply(sw: number) {
    const c = this.cur;
    this.body.position.y = c.lift + Math.abs(Math.sin(this.walkPhase)) * 1.1 * this.walkBlend;
    this.body.rotation.set(c.lean, 0, 0.05 * sw);
    this.head.rotation.set(c.headX, c.headY, c.headZ);
    this.armL.rotation.set(c.aLX, 0, c.aLZ);
    this.armR.rotation.set(c.aRX, 0, c.aRZ);
    this.legL.rotation.set(c.lLX, 0, 0);
    this.legR.rotation.set(c.lRX, 0, 0);
    const s = this.squash;
    this.root.scale.set(1 + s * 0.45, 1 - s, 1 + s * 0.45);
    const breath = 1 + 0.014 * Math.sin(this.t * 2.3) * (1 - this.walkBlend);
    if (this.torso) this.torso.scale.set(1, breath, 1);
  }

  // ── 만들기 ──

  private toon(color: string, side: THREE.Side = THREE.FrontSide): THREE.MeshToonMaterial {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: this.gradient, side });
    this.trash.push(m);
    return m;
  }

  private outline(thickness: number): THREE.ShaderMaterial {
    let m = this.outlines.get(thickness);
    if (!m) {
      m = new THREE.ShaderMaterial({
        uniforms: { thickness: { value: thickness }, color: { value: new THREE.Color(PAL.ink) } },
        vertexShader: OUTLINE_VS,
        fragmentShader: OUTLINE_FS,
        side: THREE.BackSide,
      });
      this.outlines.set(thickness, m);
      this.trash.push(m);
    }
    return m;
  }

  /** Blender 부위 붙이기 — 받아지면 모양을 굳혀(노드 변형까지) 만화 재질 + 갈색 펜 테두리로. 바로 돌려주는 빈 묶음에 나중에 들어간다 */
  private attachPart(parent: THREE.Object3D, name: string, mat: THREE.Material, line: number, scale = 10.05, accent?: THREE.Material): THREE.Group {
    const g = new THREE.Group();
    g.scale.setScalar(scale);
    parent.add(g);
    const fill = (src: THREE.Object3D | null) => {
      if (!src || this.gone) return;
      src.updateMatrixWorld(true);
      src.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const geo = (mesh.geometry as THREE.BufferGeometry).clone();
        geo.applyMatrix4(mesh.matrixWorld);
        if (!geo.getAttribute("normal")) geo.computeVertexNormals();
        g.add(this.part(geo, accent && mesh.name.includes("accent") ? accent : mat, line / scale)); // 두 색 부위 — accent 덩어리는 포인트 색
      });
      this.onPartReady?.();
    };
    const ready = PART_READY.get(name);
    if (ready !== undefined) fill(ready);
    else void loadPart(name).then(fill);
    return g;
  }

  /** 부위가 늦게 붙었을 때 (무대가 한 번 더 그리게) */
  onPartReady: (() => void) | null = null;
  private gone = false;

  /** 겉면 + 갈색 펜 테두리 */
  private part(geo: THREE.BufferGeometry, mat: THREE.Material, line = 0.4): THREE.Mesh {
    this.trash.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    if (line > 0) {
      const o = new THREE.Mesh(geo, this.outline(line));
      o.raycast = () => {};
      m.add(o);
    }
    return m;
  }

  private build() {
    const { cfg } = this;
    const skin = this.toon(AVATAR_COLOR.skin[cfg.skin]);
    const hair = this.toon("#ffffff", THREE.DoubleSide); // 머리카락 — 결 무늬 그림 (11-13)
    hair.map = hairTexture(AVATAR_COLOR.hair[cfg.hairColor]);
    this.trash.push(hair.map);
    const cloth = this.toon(AVATAR_COLOR.outfit[cfg.outfit]);
    const pants = this.toon(PAL.pants);
    // 윗옷 무늬 (11-13) — 있으면 몸통·소매를 무늬 그림으로 (옷 색 대신 무늬 색 그대로)
    const patterned = FEATURES.patterns && Boolean(cfg.pattern && cfg.pattern !== "none"); // 무늬는 숨김 (11-13)
    // 데님 자켓은 늘 청색 · 세일러는 흰 몸판 (깃·리본이 옷 색)
    if (!patterned && cfg.top === "denim") cloth.color.set("#6f93bf");
    if (!patterned && cfg.top === "sailor") cloth.color.set(PAL.cream);
    const sleeve = patterned ? this.toon("#ffffff") : cloth;
    if (patterned && cfg.pattern) {
      cloth.color.set("#ffffff");
      const apply = (t: THREE.Texture) => {
        const a = t.clone();
        a.repeat.set(2, 1); // 무늬 그림 = 옆으로 거울 2장 — 위아래 한 번 (이음매는 목·밑단)
        a.needsUpdate = true;
        const b = t.clone();
        b.repeat.set(1, 1);
        b.needsUpdate = true;
        this.trash.push(a, b);
        cloth.map = a;
        (sleeve as THREE.MeshToonMaterial).map = b;
        cloth.needsUpdate = true;
        sleeve.needsUpdate = true;
      };
      const ready = cachedPattern(cfg.pattern);
      if (ready) apply(ready);
      else void loadPattern(cfg.pattern).then((t) => t && apply(t));
    }
    this.clothMat = cloth;
    this.sleeveMat = sleeve;
    this.pantsMat = pants;
    const shoe = this.toon(PAL.shoe);
    const ink = this.toon(PAL.ink);

    this.root.add(this.body);

    // 몸통 — 원피스: 아래가 넓은 종 모양 / 그 밖의 윗옷: 곧은 셔츠 + 아랫옷 (아기 비율). 11-13 윗옷·아랫옷·신발을 따로 고른다
    const top = cfg.top ?? (cfg.gender === "boy" ? "tee" : "dress");
    const boy = top !== "dress";
    const prof = (
      boy
        ? [
            [0, 2.2],
            [5.6, 2.3],
            [6.15, 3.2],
            [6.2, 6.2],
            [5.5, 9.0],
            [3.9, 11.2],
            [2.2, 12.3],
            [0, 12.6],
          ]
        : [
            [0, 0],
            [4.6, 0.1],
            [6.2, 1.1],
            [6.75, 3.0],
            [6.45, 6.2],
            [5.5, 9.0],
            [3.9, 11.2],
            [2.2, 12.3],
            [0, 12.6],
          ]
    ).map(([r, y]) => new THREE.Vector2(r, y));
    this.profile = prof;
    this.torso = this.part(new THREE.LatheGeometry(prof, 30), cloth, 0.38);
    this.torso.position.y = 5;
    this.body.add(this.torso);
    // 아랫옷 — 반바지(맨다리) · 긴바지 · 치마(맨다리) · 청바지. 원피스면 안 보이고 다리는 스타킹 색
    const bottom = cfg.bottom ?? "shorts";
    const DENIM = "#6f93bf";
    const legColor = !boy ? PAL.pants : bottom === "pants" ? "#7c7368" : bottom === "jeans" ? DENIM : AVATAR_COLOR.skin[cfg.skin];
    const legMat = this.toon(legColor);
    this.legBase = legMat;
    if (boy) {
      if (bottom === "skirt") {
        // 치마 — 셔츠 아래로 퍼지는 짧은 치마 (윗옷 색을 조금 진하게)
        const skirt = this.part(new THREE.CylinderGeometry(5.9, 7.3, 3.6, 28, 1, true), this.toon(darker(AVATAR_COLOR.outfit[cfg.outfit])), 0.34);
        skirt.position.y = 6.0;
        this.body.add(skirt);
        this.shorts = skirt;
        this.shortsBase = skirt.material as THREE.Material;
      } else {
        const color = bottom === "jeans" ? DENIM : bottom === "pants" ? "#7c7368" : PAL.pants;
        const shorts = this.part(new THREE.CylinderGeometry(5.75, 6.0, 3.0, 28), this.toon(color), 0.36);
        shorts.position.y = 6.3;
        this.body.add(shorts);
        this.shorts = shorts;
        this.shortsBase = shorts.material as THREE.Material;
      }
    }
    // 윗옷 꾸밈 — 티셔츠: 단추 둘 · 카라 셔츠: 흰 깃 · 후드티: 뒤 모자 + 앞 주머니 + 끈 · 가디건: 가운데 여밈 + 단추 셋 · 원피스: 단추 둘
    const rAt = (y: number) => {
      for (let i = 1; i < prof.length; i++) if (y <= prof[i].y) {
        const k = (y - prof[i - 1].y) / Math.max(0.001, prof[i].y - prof[i - 1].y);
        return prof[i - 1].x + (prof[i].x - prof[i - 1].x) * Math.max(0, Math.min(1, k));
      }
      return 0;
    };
    const onFront = (m: THREE.Mesh, x: number, y: number, out = 0.12) => {
      m.position.set(x, y, Math.sqrt(Math.max(0, rAt(y) ** 2 - x * x)) + out);
      this.torso.add(m);
      return m;
    };
    const cream = this.toon(PAL.cream);
    if (top === "collar") {
      const ring = this.part(new THREE.TorusGeometry(2.5, 0.55, 8, 28), cream, 0.24);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 12.1;
      this.torso.add(ring);
      for (const s of [-1, 1]) {
        const flap = this.part(new THREE.ConeGeometry(1.35, 2.6, 3), cream, 0.2);
        flap.rotation.set(Math.PI / 2 + 0.5, 0, s * 0.5 + Math.PI);
        onFront(flap, s * 1.1, 11.3, 0.25);
      }
      for (const y of [8.6, 6.2]) onFront(this.part(new THREE.SphereGeometry(0.5, 10, 8), ink, 0), 0, y, 0.1);
    } else if (top === "hoodie") {
      const hood = this.part(new THREE.SphereGeometry(4.4, 18, 12), cloth, 0.3);
      hood.scale.set(1.35, 0.8, 0.7);
      hood.position.set(0, 16.3, -4.9);
      this.body.add(hood);
      const pocket = this.part(new THREE.BoxGeometry(6.4, 2.6, 0.7), this.toon(darker(AVATAR_COLOR.outfit[cfg.outfit])), 0.2);
      onFront(pocket, 0, 4.3, 0.05).rotation.x = -0.08;
      for (const s of [-1, 1]) {
        const str = this.part(new THREE.CapsuleGeometry(0.22, 2.4, 4, 6), cream, 0);
        onFront(str, s * 1.0, 10.6, 0.2);
      }
    } else if (top === "cardigan") {
      const band = this.part(new THREE.BoxGeometry(1.1, 10.6, 0.5), cream, 0.16);
      onFront(band, 0, 6.6, -0.05).rotation.x = -0.12;
      for (const y of [9.6, 7.0, 4.4]) onFront(this.part(new THREE.SphereGeometry(0.5, 10, 8), this.toon(PAL.woodDark), 0), 0, y, 0.3);
      for (const arm of [this.armL, this.armR]) {
        const cuff = this.part(new THREE.TorusGeometry(1.86, 0.45, 8, 20), cream, 0.18);
        cuff.rotation.x = Math.PI / 2;
        cuff.position.y = -5.6;
        arm.add(cuff);
      }
    } else if (top === "sweat") {
      // 맨투맨 — 목·밑단·소매 골지(조금 진하게) + 앞에 작은 곰돌이 얼굴
      const rib = this.toon(darker(AVATAR_COLOR.outfit[cfg.outfit]));
      const neck = this.part(new THREE.TorusGeometry(2.55, 0.48, 8, 28), rib, 0.2);
      neck.rotation.x = Math.PI / 2;
      neck.position.y = 12.05;
      this.torso.add(neck);
      const hem = this.part(new THREE.CylinderGeometry(6.3, 6.25, 1.1, 30), rib, 0.22);
      hem.position.y = 2.75;
      this.torso.add(hem);
      for (const arm of [this.armL, this.armR]) {
        const cuff = this.part(new THREE.TorusGeometry(1.86, 0.42, 8, 20), rib, 0.18);
        cuff.rotation.x = Math.PI / 2;
        cuff.position.y = -5.6;
        arm.add(cuff);
      }
      const bear = this.toon(PAL.cream);
      const face = this.part(new THREE.SphereGeometry(1.45, 16, 12), bear, 0.18);
      face.scale.z = 0.35;
      onFront(face, 0, 7.4, 0.05);
      for (const s of [-1, 1]) {
        const ear = this.part(new THREE.SphereGeometry(0.55, 10, 8), bear, 0.14);
        ear.scale.z = 0.4;
        onFront(ear, s * 1.15, 8.55, 0.05);
        onFront(this.part(new THREE.SphereGeometry(0.17, 8, 6), ink, 0), s * 0.5, 7.6, 0.55);
      }
      onFront(this.part(new THREE.SphereGeometry(0.24, 8, 6), this.toon(PAL.woodDark), 0), 0, 7.15, 0.58);
    } else if (top === "denim") {
      // 데님 자켓 — 진한 청 깃 · 가운데 여밈 · 가슴 주머니 덮개 둘 · 금빛 단추
      const deep = this.toon("#4f73a0");
      const brass = this.toon("#d9b45a");
      for (const s of [-1, 1]) {
        const flap = this.part(new THREE.ConeGeometry(1.5, 2.8, 3), deep, 0.2);
        flap.rotation.set(Math.PI / 2 + 0.5, 0, s * 0.5 + Math.PI);
        onFront(flap, s * 1.15, 11.3, 0.25);
        const pocket = this.part(new THREE.BoxGeometry(2.2, 0.9, 0.35), deep, 0.14);
        onFront(pocket, s * 2.5, 9.2, 0.05).rotation.x = -0.25;
        onFront(this.part(new THREE.SphereGeometry(0.26, 8, 6), brass, 0), s * 2.5, 9.0, 0.3);
      }
      const band = this.part(new THREE.BoxGeometry(0.55, 9.6, 0.3), deep, 0.12);
      onFront(band, 0, 6.6, -0.02).rotation.x = -0.1;
      for (const y of [9.6, 7.4, 5.2]) onFront(this.part(new THREE.SphereGeometry(0.34, 10, 8), brass, 0), 0, y, 0.22);
      const hem = this.part(new THREE.CylinderGeometry(6.3, 6.25, 1.0, 30), deep, 0.2);
      hem.position.y = 2.7;
      this.torso.add(hem);
    } else if (top === "sailor") {
      // 세일러 — 흰 몸판에 옷 색 큰 깃(등판 + 앞 V) · 흰 줄 · 빨간 리본
      const col = this.toon(AVATAR_COLOR.outfit[cfg.outfit]);
      const back = this.part(new THREE.BoxGeometry(7.6, 4.6, 0.45), col, 0.2);
      back.position.set(0, 10.4, -rAt(10.4) + 0.1);
      back.rotation.x = 0.28;
      this.torso.add(back);
      for (const s of [-1, 1]) {
        const lapel = this.part(new THREE.ConeGeometry(1.7, 4.4, 3), col, 0.2);
        lapel.rotation.set(Math.PI / 2 + 0.35, 0, s * 0.42 + Math.PI);
        onFront(lapel, s * 1.55, 10.2, 0.2);
        const line = this.part(new THREE.BoxGeometry(0.22, 3.4, 0.1), cream, 0);
        line.rotation.z = s * 0.42;
        onFront(line, s * 1.75, 10.3, 0.62);
      }
      const red = this.toon(PAL.coral);
      for (const s of [-1, 1]) {
        const loop = this.part(new THREE.SphereGeometry(0.85, 12, 8), red, 0.16);
        loop.scale.set(1.35, 0.75, 0.45);
        onFront(loop, s * 0.95, 8.4, 0.35);
        const tail = this.part(new THREE.BoxGeometry(0.5, 1.8, 0.2), red, 0.12);
        tail.rotation.z = s * 0.25;
        onFront(tail, s * 0.55, 7.2, 0.3);
      }
      onFront(this.part(new THREE.SphereGeometry(0.45, 10, 8), red, 0.12), 0, 8.4, 0.5);
    } else if (top === "puffer") {
      // 패딩 — 가로로 도톰한 누빔 셋 + 높은 깃 + 소매도 누빔
      const puff = cloth;
      for (const y of [4.0, 6.6, 9.1]) {
        const ring = this.part(new THREE.TorusGeometry(rAt(y) + 0.1, 0.62, 10, 30), puff, 0.24);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = y;
        this.torso.add(ring);
      }
      const collarTall = this.part(new THREE.CylinderGeometry(2.6, 3.1, 1.9, 22), puff, 0.22);
      collarTall.position.y = 12.1;
      this.torso.add(collarTall);
      const zip = this.part(new THREE.BoxGeometry(0.3, 9.4, 0.2), this.toon(darker(AVATAR_COLOR.outfit[cfg.outfit])), 0);
      onFront(zip, 0, 7.4, 0.62);
      for (const arm of [this.armL, this.armR]) {
        for (const y of [-1.6, -4.2]) {
          const r = this.part(new THREE.TorusGeometry(1.95, 0.5, 8, 20), puff, 0.2);
          r.rotation.x = Math.PI / 2;
          r.position.y = y;
          arm.add(r);
        }
      }
    } else if (top === "blouse") {
      // 블라우스 — 목둘레 주름(작은 동그라미가 빙 둘러) + 목 리본 + 볼록 소매
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const f = this.part(new THREE.SphereGeometry(0.62, 10, 8), cream, 0.12);
        f.scale.set(1, 0.7, 1);
        f.position.set(Math.sin(a) * 2.75, 12.0, Math.cos(a) * 2.75);
        this.torso.add(f);
      }
      const bowMat = this.toon(darker(AVATAR_COLOR.outfit[cfg.outfit]));
      for (const s of [-1, 1]) {
        const loop = this.part(new THREE.SphereGeometry(0.7, 10, 8), bowMat, 0.14);
        loop.scale.set(1.3, 0.7, 0.45);
        onFront(loop, s * 0.8, 11.0, 0.45);
      }
      onFront(this.part(new THREE.SphereGeometry(0.36, 8, 6), bowMat, 0.1), 0, 11.0, 0.6);
      for (const arm of [this.armL, this.armR]) {
        const puffS = this.part(new THREE.SphereGeometry(2.45, 16, 12), cloth, 0.26);
        puffS.scale.set(1, 0.85, 1);
        puffS.position.y = -0.9;
        arm.add(puffS);
      }
    } else if (top === "tee") {
      // 티셔츠 — 목 골지 + 가슴에 작은 별 (단추 대신, 11-13)
      const neck = this.part(new THREE.TorusGeometry(2.5, 0.38, 8, 28), this.toon(darker(AVATAR_COLOR.outfit[cfg.outfit])), 0.18);
      neck.rotation.x = Math.PI / 2;
      neck.position.y = 12.05;
      this.torso.add(neck);
      const star = this.part(new THREE.CylinderGeometry(0.95, 0.95, 0.3, 5), this.toon(PAL.butter), 0.14);
      star.rotation.x = Math.PI / 2;
      onFront(star, 2.2, 8.6, 0.1);
    } else {
      // 원피스 — 단추 둘 + 허리 리본 (11-13)
      for (const [y, r] of [
        [4.6, 6.62],
        [7.4, 6.05],
      ]) {
        const b = this.part(new THREE.SphereGeometry(0.62, 10, 8), ink, 0);
        b.position.set(0, y, (boy ? rAt(y) : r) + 0.12);
        this.torso.add(b);
      }
      const sash = this.toon(cfg.outfit === "coral" ? PAL.butter : PAL.coral);
      const belt = this.part(new THREE.TorusGeometry(rAt(8.3) + 0.05, 0.42, 8, 30), sash, 0.18);
      belt.rotation.x = Math.PI / 2;
      belt.position.y = 8.3;
      this.torso.add(belt);
      for (const s of [-1, 1]) {
        const loop = this.part(new THREE.SphereGeometry(0.8, 10, 8), sash, 0.14);
        loop.scale.set(1.3, 0.7, 0.45);
        loop.position.set(2.6 + s * 0.85, 8.4, Math.sqrt(Math.max(0, rAt(8.4) ** 2 - 2.6 ** 2)) + 0.3);
        this.torso.add(loop);
      }
    }

    // 다리 (엉덩이 관절)
    for (const [leg, x] of [
      [this.legL, 3.0],
      [this.legR, -3.0],
    ] as const) {
      leg.position.set(x, 5.4, 0);
      const l = this.part(new THREE.CapsuleGeometry(2.25, 2.0, 6, 14), legMat, 0.34);
      l.position.y = -2.3;
      this.legMeshes.push(l);
      leg.add(l);
      this.buildShoe(leg, cfg.shoes ?? "flats", shoe);
      this.body.add(leg);
    }

    // 팔 (어깨 관절) — 소매는 옷 색, 손은 피부
    for (const [arm, x] of [
      [this.armL, 6.0],
      [this.armR, -6.0],
    ] as const) {
      arm.position.set(x, 14.6, 0);
      const a = this.part(new THREE.CapsuleGeometry(1.85, 3.6, 6, 12), sleeve, 0.32);
      a.position.y = -3.0;
      this.sleeves.push(a);
      const h = this.part(new THREE.SphereGeometry(2.1, 16, 12), skin, 0.3);
      h.position.y = -7.2;
      arm.add(a, h);
      this.body.add(arm);
    }

    // 머리 (목 관절) — hc = 머리 가운데 (머리 소품도 여기에 단다)
    this.head.position.set(0, 16.6, 0);
    this.body.add(this.head);
    const hc = this.headCenter;
    hc.position.y = 9.2;
    this.head.add(hc);
    hc.add(this.part(new THREE.SphereGeometry(9.6, 40, 30), skin, 0.42));
    // 얼굴 — 앞쪽 공 조각에 투명 그림
    const faceGeo = new THREE.SphereGeometry(9.68, 40, 24, Math.PI / 2 - 0.92, 1.84, Math.PI / 2 - 0.72, 1.44);
    this.faceMat = new THREE.MeshToonMaterial({ map: this.faces.normal, transparent: true, gradientMap: this.gradient, depthWrite: false });
    this.trash.push(faceGeo, this.faceMat);
    const face = new THREE.Mesh(faceGeo, this.faceMat);
    face.renderOrder = 2;
    hc.add(face);
    // 귀
    for (const s of [-1, 1]) {
      const e = this.part(new THREE.SphereGeometry(2.0, 12, 10), skin, 0.3);
      e.position.set(s * 9.2, -0.6, 0.2);
      hc.add(e);
    }
    this.buildHair(hc, hair);
    // 모자는 머리 소품(상점)으로만 — 설정의 hat 은 안 그린다 (11-13)
    if (cfg.glasses) this.buildGlasses(hc, ink);

    this.tagAnchor.position.set(0, 14, 0);
    hc.add(this.tagAnchor);
    this.hold.position.set(0, 12.5, 8.6);
    this.body.add(this.hold);
  }

  /** 모자를 쓰나 (털모자 머리면 이미 모자라 안 씌운다) */
  private hatOn(): boolean {
    return false; // 설정의 모자는 안 쓴다 (모자 = 머리 소품, 11-13)
  }

  /** 머리 소품 모자 — hat-cap·hat-bucket·hat-straw·hat-beret (상점) */
  private hatItem: THREE.Group | null = null;
  private wearHat(id: string | undefined) {
    this.hatItem?.removeFromParent();
    this.hatItem = null;
    if (!id) return;
    const kind = id.slice(4) as "cap" | "bucket" | "straw" | "beret";
    const color = { cap: PAL.sky, bucket: PAL.butter, straw: PAL.sky, beret: PAL.coral }[kind] ?? PAL.sky;
    const before = this.hatGroup;
    this.buildHat(this.headCenter, kind, color);
    this.hatItem = this.hatGroup;
    this.hatGroup = before === this.hatItem ? null : before;
  }

  /** 모자 (11-13) — 캡모자(챙 + 꼭지 단추 + 작은 별 패치) · 벙거지 · 밀짚모자(넓은 챙 + 리본) · 베레모(옆으로 기울임) */
  private buildHat(hc: THREE.Group, hatKind?: "cap" | "bucket" | "straw" | "beret", colorHex?: string) {
    if (!hatKind) return;
    const color = colorHex ?? PAL.sky;
    const mat = this.toon(color);
    const bp = FEATURES.blenderParts ? BLENDER_PARTS.hat[hatKind] : undefined;
    if (bp) {
      // Blender 모자 (11-13) — 본체 + 포인트 색(캡 단추·별 패치 / 벙거지 띠 / 밀짚모자 리본)
      const main = hatKind === "straw" ? this.toon("#e8cf8a") : mat;
      const acc = this.toon(hatKind === "cap" ? PAL.butter : hatKind === "bucket" ? PAL.cream : color);
      this.hatGroup = this.attachPart(hc, bp, main, 0.32, 10.05, acc);
      return;
    }
    const g = new THREE.Group();
    const kind = hatKind;
    if (kind === "cap") {
      const crown = this.part(new THREE.SphereGeometry(10.75, 32, 14, 0, Math.PI * 2, 0, 1.2), mat, 0.32);
      crown.rotation.x = -0.12;
      const brim = this.part(new THREE.CylinderGeometry(7.2, 7.2, 0.7, 28, 1, false, -Math.PI / 2, Math.PI), mat, 0.28);
      brim.scale.set(1, 1, 0.95);
      brim.position.set(0, 3.9, 6.6);
      brim.rotation.x = 0.22;
      const knob = this.part(new THREE.SphereGeometry(1.0, 12, 8), this.toon(PAL.cream), 0.2);
      knob.position.set(0, 10.6, -1.3);
      const patch = this.part(new THREE.CylinderGeometry(1.6, 1.6, 0.4, 5), this.toon(PAL.butter), 0.15); // 앞 별 패치 (오각)
      patch.rotation.x = Math.PI / 2 - 0.55;
      patch.position.set(0, 7.9, 6.9);
      g.add(crown, brim, knob, patch);
    } else if (kind === "bucket") {
      const crown = this.part(new THREE.CylinderGeometry(8.4, 10.6, 6.4, 30), mat, 0.3);
      crown.position.y = 6.2;
      const top = this.part(new THREE.SphereGeometry(8.4, 30, 8, 0, Math.PI * 2, 0, 0.5), mat, 0.26);
      top.position.y = 6.2 + 3.2 - 8.4 * Math.cos(0.5);
      const brim = this.part(new THREE.CylinderGeometry(11.0, 14.2, 2.6, 34, 1, true), mat, 0.26);
      brim.position.y = 2.6;
      const band = this.part(new THREE.TorusGeometry(10.5, 0.45, 8, 34), this.toon(PAL.cream), 0.14);
      band.rotation.x = Math.PI / 2;
      band.position.y = 3.6;
      g.add(crown, top, brim, band);
      g.rotation.x = -0.08;
    } else if (kind === "straw") {
      const straw = this.toon("#e8cf8a");
      const brim = this.part(new THREE.CylinderGeometry(16.5, 16.5, 0.7, 40), straw, 0.26);
      brim.position.y = 4.2;
      const crown = this.part(new THREE.CylinderGeometry(8.6, 9.6, 5.6, 30), straw, 0.28);
      crown.position.y = 7.3;
      const ribbon = this.part(new THREE.TorusGeometry(9.45, 0.9, 8, 32), mat, 0.18);
      ribbon.rotation.x = Math.PI / 2;
      ribbon.position.y = 5.6;
      const bow = this.part(new THREE.SphereGeometry(1.5, 12, 8), mat, 0.18);
      bow.scale.set(1.5, 0.9, 0.6);
      bow.position.set(6.6, 5.8, 6.4);
      g.add(brim, crown, ribbon, bow);
      g.rotation.x = -0.1;
    } else if (kind === "beret") {
      const top = this.part(new THREE.SphereGeometry(10.4, 30, 16), mat, 0.3);
      top.scale.set(1.18, 0.42, 1.14);
      top.position.y = 7.8;
      const stem = this.part(new THREE.CylinderGeometry(0.45, 0.6, 1.6, 8), mat, 0.14);
      stem.position.y = 12.3;
      g.add(top, stem);
      g.rotation.z = -0.22;
      g.position.x = 0.9;
    }
    hc.add(g);
    this.hatGroup = g;
  }

  /** 신발 (11-13) — 단화(갈색 동글) · 운동화(흰 몸통 + 코랄 밑창) · 부츠(갈색 목) · 장화(노란 목) */
  private buildShoe(leg: THREE.Group, kind: string, brown: THREE.Material) {
    const foot = (mat: THREE.Material) => {
      const s = this.part(new THREE.SphereGeometry(2.55, 16, 12), mat, 0.3);
      s.scale.set(1, 0.62, 1.32);
      s.position.set(0, -4.75, 0.75);
      leg.add(s);
      return s;
    };
    if (kind === "sneakers") {
      foot(this.toon("#fbf6ee"));
      const sole = this.part(new THREE.CylinderGeometry(2.6, 2.6, 0.55, 18), this.toon(PAL.coral), 0.16);
      sole.scale.set(1, 1, 1.32);
      sole.position.set(0, -6.05, 0.75);
      leg.add(sole);
      const lace = this.part(new THREE.BoxGeometry(1.3, 0.25, 0.9), this.toon(PAL.sky), 0);
      lace.position.set(0, -3.95, 2.3);
      leg.add(lace);
      return;
    }
    if (kind === "boots" || kind === "rain") {
      const mat = kind === "rain" ? this.toon(PAL.butter) : this.toon("#8a5f40");
      foot(mat);
      const shaft = this.part(new THREE.CylinderGeometry(2.45, 2.35, 3.6, 18), mat, 0.28);
      shaft.position.set(0, -3.0, 0.1);
      leg.add(shaft);
      if (kind === "boots") {
        const cuff = this.part(new THREE.TorusGeometry(2.45, 0.42, 8, 18), this.toon(PAL.cream), 0.16);
        cuff.rotation.x = Math.PI / 2;
        cuff.position.set(0, -1.2, 0.1);
        leg.add(cuff);
      }
      return;
    }
    foot(brown);
  }

  /** 머리 위를 덮는 모자 모양 (앞쪽을 들어 이마가 보이게) */
  private cap(hc: THREE.Group, mat: THREE.Material, r: number, L: number, tilt: number): THREE.Mesh {
    const m = this.part(new THREE.SphereGeometry(r, 40, 20, 0, Math.PI * 2, 0, L), mat, 0.34);
    m.rotation.x = -tilt;
    hc.add(m);
    return m;
  }

  /** 앞머리 한 다발 — theta(위에서 내려온 각)·phi(앞에서 옆으로 돈 각) 자리 */
  private tuft(hc: THREE.Group, mat: THREE.Material, theta: number, phi: number, r: number, sx: number, sy: number) {
    const n = new THREE.Vector3(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi));
    const m = this.part(new THREE.SphereGeometry(r, 16, 12), mat, 0.28);
    m.position.copy(n).multiplyScalar(9.95);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    m.scale.set(sx, sy, 0.62);
    hc.add(m);
  }

  /**
   * 끝이 뾰족한 머리 다발 (앞머리·옆머리) — 위가 둥글고 아래로 갈수록 가늘어지는 물방울. theta·phi 자리에서 머리 겉을 따라 아래로 흘러내린다.
   * len = 다발 길이 배율, w = 폭 배율, tilt = 옆으로 기울기(라디안)
   */
  private lock(hc: THREE.Group, mat: THREE.Material, theta: number, phi: number, r: number, len = 1, w = 1, tilt = 0) {
    const prof = [
      [0, 1.0],
      [0.55, 0.86],
      [0.92, 0.46],
      [1.0, 0.0],
      [0.86, -0.62],
      [0.56, -1.22],
      [0.22, -1.72],
      [0, -1.95],
    ].map(([a, b]) => new THREE.Vector2(a * r, b * r));
    const m = this.part(new THREE.LatheGeometry(prof, 14), mat, 0.26);
    const n = new THREE.Vector3(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi));
    const down = new THREE.Vector3(0, -1, 0).addScaledVector(n, n.y).normalize(); // 머리 겉을 따라 아래로
    const yAxis = down.clone().negate().applyAxisAngle(n, tilt); // 다발의 위쪽 (끝은 -y)
    const xAxis = new THREE.Vector3().crossVectors(yAxis, n).normalize();
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, n));
    m.position.copy(n).multiplyScalar(9.9);
    m.scale.set(w, len, 0.58);
    hc.add(m);
    return m;
  }

  private blob(hc: THREE.Group, mat: THREE.Material, r: number, pos: [number, number, number], scale: [number, number, number] = [1, 1, 1]) {
    const m = this.part(new THREE.SphereGeometry(r, 18, 14), mat, 0.3);
    m.position.set(...pos);
    m.scale.set(...scale);
    hc.add(m);
    return m;
  }

  private buildHair(hc: THREE.Group, hair: THREE.Material) {
    const style = this.cfg.hair;
    // Blender 로 만든 머리 모양이 있으면 그걸로 (11-13)
    const bp = FEATURES.blenderParts ? BLENDER_PARTS.hair[style] : undefined;
    if (bp) {
      this.attachPart(hc, bp, hair, 0.34, 10.05, this.toon(HAT[this.cfg.outfit])); // 머리끈(양갈래·똥머리)은 옷 색
      return;
    }
    // 앞머리 — 끝이 뾰족한 다발 여럿 (가운데가 조금 짧고, 바깥쪽은 옆으로 살짝 기운다)
    const bangs = (n: 3 | 4, theta: number) => {
      const phis = n === 4 ? [-0.7, -0.35, 0, 0.35, 0.7] : [-0.5, -0.17, 0.17, 0.5];
      phis.forEach((p, i) => this.lock(hc, hair, theta - (i % 2) * 0.04, p, n === 4 ? 2.3 : 2.2, 1.0 + (i % 2) * 0.12, 1.15, p * 0.35));
    };
    if (style === "beanie") {
      const knit = this.toon(HAT[this.cfg.outfit]);
      const hat = this.cap(hc, knit, 10.75, 1.58, 0.3);
      const rim = this.part(new THREE.TorusGeometry(10.55, 1.55, 10, 40), knit, 0.3);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 10.75 * Math.cos(1.58);
      const pom = this.part(new THREE.SphereGeometry(3.3, 16, 12), this.toon(PAL.cream), 0.3);
      pom.position.y = 10.9;
      hat.add(rim, pom);
      for (const s of [-1, 1]) this.blob(hc, hair, 3.6, [s * 8.7, -3.0, -1.0], [0.7, 1.2, 0.9]);
      return;
    }
    if (style === "short") {
      this.cap(hc, hair, 10.1, 1.62, 0.44);
      bangs(3, 1.13);
      this.blob(hc, hair, 1.7, [0.4, 10.1, -1.4], [1, 1.4, 1]); // 삐친 머리
      return;
    }
    if (style === "bowl") {
      // 바가지 — 이마를 덮는 일자 앞머리, 귀 위까지 동그랗게
      this.cap(hc, hair, 10.35, 1.78, 0.38);
      for (const p of [-0.78, -0.39, 0, 0.39, 0.78]) this.tuft(hc, hair, 1.27, p, 2.9, 1.5, 0.6);
      return;
    }
    if (style === "spiky") {
      // 삐죽 — 짧은 머리 위로 뾰족뾰족 (모자를 쓰면 눌려서 안 보인다)
      this.cap(hc, hair, 10.05, 1.55, 0.4);
      bangs(3, 1.12);
      if (this.hatOn()) return;
      const spikes: Array<[number, number]> = [
        [0.25, 0],
        [0.55, 0.9],
        [0.55, -0.9],
        [0.75, 2.2],
        [0.75, -2.2],
        [0.5, 3.14],
      ];
      for (const [theta, phi] of spikes) {
        const n = new THREE.Vector3(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi)).applyAxisAngle(new THREE.Vector3(1, 0, 0), -0.25);
        const m = this.part(new THREE.ConeGeometry(1.9, 4.6, 10), hair, 0.25);
        m.position.copy(n).multiplyScalar(10.6);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
        hc.add(m);
      }
      return;
    }
    if (style === "side") {
      // 가르마 — 한쪽으로 쓸어 넘긴 앞머리
      this.cap(hc, hair, 10.15, 1.6, 0.42);
      const swoop = this.blob(hc, hair, 4.2, [2.2, 7.6, 6.1], [1.75, 0.66, 0.62]);
      swoop.rotation.set(-0.62, 0.15, -0.32);
      this.tuft(hc, hair, 1.16, -0.55, 2.6, 1.2, 0.8);
      return;
    }
    if (style === "curly") {
      // 뽀글 머리 — 작은 동글이를 머리 위에 빼곡히 (얼굴 앞은 비운다)
      for (let i = 0; i < 64; i++) {
        const theta = Math.acos(1 - (i + 0.5) / 64 * 1.18); // 위쪽 반구 조금 아래까지 고르게
        const phi = i * 2.39996; // 해바라기 씨 배치
        const front = Math.cos(phi) > 0.35 && theta > 1.02; // 얼굴 자리
        if (front) continue;
        const n = new THREE.Vector3(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi));
        const m = this.part(new THREE.SphereGeometry(2.55 + (i % 3) * 0.25, 14, 10), hair, 0.22);
        m.position.copy(n).multiplyScalar(10.15);
        hc.add(m);
      }
      return;
    }
    this.cap(hc, hair, 10.2, 1.7, 0.56);
    bangs(4, 1.04);
    if (style === "long") {
      // 긴 생머리 — 등 뒤로 길게 + 양옆으로 내려오는 머리
      this.blob(hc, hair, 7.2, [0, -6.8, -4.6], [1.42, 1.8, 0.78]);
      for (const s of [-1, 1]) {
        this.blob(hc, hair, 3.4, [s * 8.9, -5.2, -0.6], [0.62, 2.15, 0.85]);
        this.lock(hc, hair, 1.45, s * 1.05, 2.4, 1.6, 1.0, s * 0.1);
      }
    } else if (style === "ponytail") {
      // 포니테일 — 뒤통수 위에서 묶어 아래로
      const tie = this.part(new THREE.TorusGeometry(1.7, 0.6, 8, 18), this.toon(HAT[this.cfg.outfit]), 0.2);
      tie.position.set(0, 4.6, -9.4);
      tie.rotation.x = 0.5;
      hc.add(tie);
      const tail = this.lock(hc, hair, 2.15, Math.PI, 3.3, 2.0, 1.0);
      tail.position.set(0, 2.4, -11.4);
      for (const s of [-1, 1]) this.lock(hc, hair, 1.42, s * 1.08, 2.0, 1.15, 0.9, s * 0.12); // 옆 잔머리
    } else if (style === "braids") {
      // 땋은 머리 — 귀 뒤에서 양쪽으로 땋아 내린다 (끝에 리본)
      const ribbon = this.toon(HAT[this.cfg.outfit]);
      for (const s of [-1, 1]) {
        for (let k = 0; k < 6; k++) {
          const b = this.part(new THREE.SphereGeometry(2.15 - k * 0.12, 12, 10), hair, 0.22);
          b.position.set(s * (8.3 + (k % 2) * 0.55), -3.2 - k * 2.45, -2.4 + k * 0.25);
          b.scale.set(1, 0.9, 0.95);
          hc.add(b);
        }
        const bow = this.part(new THREE.SphereGeometry(1.2, 10, 8), ribbon, 0.18);
        bow.position.set(s * 8.6, -17.6, -1.0);
        bow.scale.set(1.6, 0.8, 0.7);
        hc.add(bow);
      }
    } else if (style === "wavy") {
      // 웨이브 단발 — 옆머리가 물결처럼 세 번 굽이친다
      for (const s of [-1, 1]) {
        this.blob(hc, hair, 3.3, [s * 8.7, -1.4, -1.3], [0.75, 0.95, 0.95]);
        this.blob(hc, hair, 3.1, [s * 9.5, -4.3, -1.5], [0.72, 0.95, 0.95]);
        this.blob(hc, hair, 2.8, [s * 8.9, -7.0, -1.2], [0.72, 0.95, 0.9]);
      }
      this.blob(hc, hair, 6.6, [0, -3.8, -5.2], [1.38, 1.05, 0.75]); // 뒷머리
    } else if (style === "bob") {
      for (const s of [-1, 1]) this.blob(hc, hair, 4.3, [s * 8.6, -2.4, -1.4], [0.72, 1.5, 0.95]);
    } else if (style === "pigtails") {
      const tie = this.toon(HAT[this.cfg.outfit]);
      for (const s of [-1, 1]) {
        this.blob(hc, hair, 3.9, [s * 10.9, -1.4, -2.8], [0.95, 1.18, 0.95]);
        this.blob(hc, tie, 1.4, [s * 9.3, 0.3, -2.2]);
      }
    } else if (style === "bun") {
      this.blob(hc, hair, 4.6, [0, 10.4, -3.6]);
      const tie = this.part(new THREE.TorusGeometry(2.9, 0.75, 8, 20), this.toon(HAT[this.cfg.outfit]), 0.25);
      tie.position.set(0, 7.5, -3.0);
      tie.rotation.x = Math.PI / 2 - 0.35;
      hc.add(tie);
    }
  }

  private buildGlasses(hc: THREE.Group, ink: THREE.Material) {
    const theta = Math.PI / 2 - 0.72 + (FACE_EYE.y / 256) * 1.44; // 얼굴 그림의 눈 높이
    const pts: THREE.Vector3[] = [];
    for (const s of [-1, 1]) {
      const phi = s * (FACE_EYE.x / 256) * 1.84;
      const n = new THREE.Vector3(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi));
      const ring = this.part(new THREE.TorusGeometry(2.45, 0.4, 8, 30), ink, 0);
      ring.position.copy(n).multiplyScalar(10.25);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      hc.add(ring);
      pts.push(ring.position.clone());
    }
    const mid = pts[0].clone().add(pts[1]).multiplyScalar(0.5);
    const bridge = this.part(new THREE.CylinderGeometry(0.32, 0.32, Math.max(0.6, pts[0].distanceTo(pts[1]) - 4.6), 8), ink, 0);
    bridge.position.copy(mid).setLength(10.45);
    bridge.rotation.z = Math.PI / 2;
    hc.add(bridge);
  }

  /**
   * 옷 한 벌 입기 (옷 가게, 11-13) — 몸통·소매·다리 재질을 바꾸고 덧붙이는 것(깃·멜빵·모자·벨트…)을 단다. null 이면 기본 옷.
   * 몸통에 단 것은 숨 쉴 때 같이 움직인다. 좌표는 몸통 회전체 기준(아래 0 → 목 12.6, 앞 = +z).
   */
  private dress(id: string | null) {
    if (this.dressed === id) return;
    this.dressed = id;
    for (const o of this.dressParts) o.removeFromParent();
    this.dressParts = [];
    this.dressKit?.dispose();
    this.dressKit = null;
    // legs 를 안 주면 고른 아랫옷 그대로 (다리·반바지/치마)
    const set = (top: THREE.Material, arms: THREE.Material, legs?: THREE.Material) => {
      this.torso.material = top;
      for (const s of this.sleeves) s.material = arms;
      for (const l of this.legMeshes) l.material = legs ?? this.legBase;
      if (this.shorts) this.shorts.material = legs ?? this.shortsBase ?? this.pantsMat;
    };
    if (!id || !DRESS_IDS.has(id)) {
      set(this.clothMat, this.sleeveMat);
      return;
    }
    const kit = (this.dressKit = new Kit(this.gradient));
    const pat = (kind: "stripes" | "dots" | "knit", base: string, mark: string, rep: [number, number]) => {
      const m = kit.toon("#ffffff");
      m.map = kit.keep(clothTexture(kind, base, mark, rep));
      return m;
    };
    const add = (parent: THREE.Object3D, o: THREE.Object3D) => {
      parent.add(o);
      this.dressParts.push(o);
      return o;
    };
    // 몸통 겉 반지름 (회전체 높이 y 에서) — 앞에 다는 것 자리
    const rAt = (y: number) => {
      const p = this.profile;
      for (let i = 1; i < p.length; i++) {
        if (y <= p[i].y) {
          const k = (y - p[i - 1].y) / Math.max(0.001, p[i].y - p[i - 1].y);
          return p[i - 1].x + (p[i].x - p[i - 1].x) * Math.max(0, Math.min(1, k));
        }
      }
      return 0;
    };
    const ring = (y: number, r: number, tube: number, mat: THREE.Material, parent: THREE.Object3D = this.torso) => {
      const t = kit.part(new THREE.TorusGeometry(r, tube, 10, 32), mat, 0.26);
      t.rotation.x = Math.PI / 2;
      t.position.y = y;
      return add(parent, t);
    };
    const front = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, out = 0.15, line = 0.22) => {
      const m = kit.part(geo, mat, line);
      m.position.set(x, y, Math.sqrt(Math.max(0, rAt(y) ** 2 - x * x)) + out);
      return add(this.torso, m);
    };
    const cream = kit.toon(PAL.cream);
    const wood = kit.toon(PAL.woodDark);
    switch (id) {
      case "stripes": {
        set(pat("stripes", PAL.coral, PAL.cream, [1, 4]), pat("stripes", PAL.coral, PAL.cream, [1, 2]));
        ring(12.25, 2.45, 0.42, kit.toon(PAL.coral)); // 목 둘레
        break;
      }
      case "overalls": {
        const dots = pat("dots", PAL.butter, PAL.cream, [8, 2]);
        set(cream, cream, pat("dots", PAL.butter, PAL.cream, [3, 1]));
        // 허리 아래 바지 부분 — 몸통보다 살짝 크게 감싼다
        const low = this.profile.filter((p) => p.y <= 6.4).map((p) => new THREE.Vector2(p.x + 0.16, p.y));
        low.push(new THREE.Vector2(rAt(6.4) + 0.16, 6.4));
        add(this.torso, kit.part(new THREE.LatheGeometry(low, 30), dots, 0.3));
        // 가슴판 + 멜빵 + 단추
        const bib = front(new THREE.BoxGeometry(6.2, 4.4, 0.7), dots, 0, 8.4, -0.2, 0.26);
        bib.rotation.x = -0.22;
        for (const s of [-1, 1]) {
          const strap = kit.part(new THREE.BoxGeometry(1.1, 6.6, 0.5), dots, 0.2);
          strap.position.set(s * 2.4, 11.4, rAt(11.4) - 0.2);
          strap.rotation.x = -0.75;
          add(this.torso, strap);
          front(new THREE.SphereGeometry(0.62, 10, 8), wood, s * 2.3, 10.3, 0.35, 0);
        }
        break;
      }
      case "dots": {
        set(pat("dots", PAL.coral, PAL.cream, [9, 3]), pat("dots", PAL.coral, PAL.cream, [3, 2]));
        // 흰 동그란 깃 — 목 둘레 + 앞 두 날개
        ring(12.1, 2.55, 0.62, cream);
        for (const s of [-1, 1]) {
          const flap = kit.part(new THREE.SphereGeometry(1.9, 16, 10), cream, 0.22);
          flap.scale.set(1.1, 0.55, 0.42);
          flap.position.set(s * 1.35, 11.35, rAt(11.35) + 0.15);
          flap.rotation.z = s * 0.35;
          add(this.torso, flap);
        }
        break;
      }
      case "sweater": {
        set(pat("knit", PAL.mint, "#5fa58c", [10, 1]), pat("knit", PAL.mint, "#5fa58c", [4, 1]));
        ring(12.2, 2.75, 1.25, kit.toon(PAL.mint)); // 목 폴라
        ring(0.9, rAt(0.9) + 0.05, 0.55, kit.toon("#7fbfa6")); // 밑단 골
        for (const arm of [this.armL, this.armR]) {
          const cuff = kit.part(new THREE.TorusGeometry(1.86, 0.5, 8, 20), kit.toon("#7fbfa6"), 0.2);
          cuff.rotation.x = Math.PI / 2;
          cuff.position.y = -5.6;
          add(arm, cuff);
        }
        break;
      }
      case "raincoat": {
        const yellow = kit.toon(PAL.butter);
        set(yellow, yellow);
        ring(12.15, 2.7, 0.85, yellow); // 깃
        // 뒤로 넘긴 모자
        const hood = kit.part(new THREE.SphereGeometry(4.6, 20, 14), yellow, 0.3);
        hood.scale.set(1.35, 0.85, 0.7);
        hood.position.set(0, 16.4, -5.0);
        add(this.body, hood);
        // 나무 단추 셋 (가로 막대)
        for (const y of [10.2, 7.6, 5.0]) {
          const tg = front(new THREE.CapsuleGeometry(0.42, 1.5, 4, 8), wood, 0, y, 0.3, 0.16);
          tg.rotation.z = Math.PI / 2;
        }
        break;
      }
      case "spacesuit": {
        const white = kit.toon("#f7f3ea");
        set(white, white, white);
        ring(12.0, 2.85, 1.05, kit.toon(PAL.sky)); // 목 둘레
        ring(3.2, rAt(3.2) + 0.08, 0.62, kit.toon(PAL.coral)); // 벨트
        // 가슴 배지 — 민트 행성 + 버터 고리
        const planet = front(new THREE.SphereGeometry(1.15, 16, 12), kit.toon(PAL.mint), 2.0, 8.6, 0.55, 0.18);
        const ringMesh = kit.part(new THREE.TorusGeometry(1.65, 0.2, 6, 24), kit.toon(PAL.butter), 0);
        ringMesh.rotation.set(Math.PI / 2 - 0.35, 0, 0.3);
        planet.add(ringMesh);
        // 무릎 띠 (하늘)
        for (const l of this.legMeshes) {
          const band = kit.part(new THREE.TorusGeometry(2.3, 0.35, 6, 18), kit.toon(PAL.sky), 0.15);
          band.rotation.x = Math.PI / 2;
          band.position.y = -0.6;
          add(l, band);
        }
        break;
      }
    }
  }

  /** 선물 소품 하기 — 전에 하던 것은 벗는다. 새로 단 것들을 돌려준다 (짠 하고 커지는 연출용). 옷(자리 body)은 dress 로 */
  wear(ids: string[]): Map<string, THREE.Object3D> {
    this.dress(ids.find((id) => DRESS_IDS.has(id)) ?? null);
    for (const o of this.worn.values()) o.removeFromParent();
    this.worn.clear();
    this.wornKit?.dispose();
    this.wornKit = new Kit(this.gradient);
    let headOn = false;
    this.wearHat(ids.find((id) => id.startsWith("hat-")));
    for (const id of ids) {
      if (DRESS_IDS.has(id) || id.startsWith("hat-")) continue;
      const w = buildWearable(id, this.wornKit, this.cfg.outfit);
      if (!w) continue;
      if (w.anchor === "head") headOn = true;
      (w.anchor === "head" ? this.headCenter : this.body).add(w.obj);
      this.worn.set(id, w.obj);
    }
    // 머리 소품(곰돌이 귀·리본·별 핀·꽃 화관·왕관)을 하면 기본 모자는 벗는다 — 소품이 먼저 (11-13 사용자: "모자를 쓰고 있어도 소품이 적용되게")
    if (this.hatGroup) this.hatGroup.visible = !headOn;
    return new Map(this.worn);
  }

  dispose() {
    this.gone = true;
    for (const d of this.trash) d.dispose();
    this.trash = [];
    this.wornKit?.dispose();
    this.wornKit = null;
    this.dressKit?.dispose();
    this.dressKit = null;
  }
}
