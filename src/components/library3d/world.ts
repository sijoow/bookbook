// 나의 도서관 (입체) — 모눈종이 벽·나무 바닥·러그·방석, 내 책이 꽂힌 책장, 방석에 앉은 내 아바타.
// 11-12 사용자: "유니티 정도로 간단하게 게임 애니메이션 느낌으로, 애기가 앉아 있다가 나만의 아바타가 직접 꺼낸다"
//   + "염주 돌리는 앱(산사) 같은 느낌으로 나만의 도서관"
// 책을 누르면 → 아바타가 일어나 걸어가서(높은 줄은 깡충) 책을 빼 들고 → 방석에 앉아 표지를 보이며 읽는다 → 덮으면 다시 꽂고 앉는다.
// mode: home(내 도서관) · visit(친구 도서관 — 친구 아바타가 책을 꺼내 보여 준다) · preview(아바타 꾸미기)
// 단위 cm. three.js 를 직접 쓴다 (React 밖). prefers-reduced-motion 이면 순간이동.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { AvatarConfig } from "@/lib/avatar/config";
import type { LibraryBook } from "@/lib/books/types";
import { CASE, SPINE_INSET, layoutLibrary, type LibraryLayout, type UnitLayout } from "@/lib/library3d/layout";
import { ease, facing, jumpFor, riseTime, turnDelta, walkTime } from "@/lib/library3d/motion";
import { dropTarget, moveTo, type DropTarget, type SpineRect } from "@/lib/books/drop";
import { ITEM, PAINT_COLOR, ROOM_SURFACES, TRACK, type ItemPos, type PaintId } from "@/lib/deco/items";
import { TOP_Z, canMove, fromPos, homeSurface, itemRadius, placeSpot, roomFrame, toPos, wallRect, type RoomFrame, type Spot } from "@/lib/library3d/roomPlace";
import { Avatar, CUSHION_H, type Pose } from "./avatar3d";
import { Book3D, type BookShared } from "./book3d";
import { buildGiftBox, buildRoomItem, type RoomItem3D } from "./deco3d";
import { HOUSE_CAM, HOUSE_COLORS, buildShell, type Shell } from "./house3d";
import { Pet } from "./pet3d";
import { Kit } from "./toon";
import { PAL, addSlotTexture, loadTexture, openPageTexture, pagesTexture, rugTexture, sparkleTexture, starTexture, toonGradient } from "./textures";
import { DEFAULT_HOUSE, type HouseId } from "@/lib/house/houses";

export type StageMode = "home" | "visit" | "preview";
/** 미리보기 카메라가 담을 곳 (꾸미기 창은 탭마다 다르게) */
export type StageFocus = "body" | "face" | "pet" | "hair" | "eyes" | "mouth";

export type WorldEvents = {
  pick?: (id: string) => void;
  add?: () => void;
  avatarTap?: () => void;
  /** 매 프레임 — 이름표·선물 상자 자리 (캔버스 안 CSS px) */
  frame?: (tag: { x: number; y: number; visible: boolean }, gift: { x: number; y: number } | null, guest: { x: number; y: number; visible: boolean } | null) => void;
  gift?: () => void; // 선물 상자를 눌렀다
  view?: (shelf: boolean) => void; // '크게 보기'(책장만)로 바뀌었다
  reorder?: (ids: string[]) => void; // 순서 바꾸기에서 책을 옮겨 놓았다
  arrange?: (id: string, pos: ItemPos) => void; // 물건 자리에서 방 물건을 옮겨 놓았다
  itemDoubleTap?: (id: string) => void; // 방 물건을 두 번 눌렀다 (홈 — 물건 자리로)
  cam?: (moved: boolean) => void; // 손으로 카메라를 옮겼나 (제자리 버튼)
  say?: (text: string) => void;
  sayGuest?: (text: string) => void; // 손님(나) 말풍선
  units?: (count: number, current: number) => void;
};

type Tween = { t: number; dur: number; fn: (p: number) => void; ease: (t: number) => number; done: () => void };
type Fx = { obj: THREE.Sprite; t: number; dur: number; from: THREE.Vector3; vel: THREE.Vector3; spin: number };
type HoldKind = "carry" | "read" | "show";
export type DecoView = { worn: string[]; placed: string[]; pos?: Record<string, ItemPos>; paint?: PaintId };
const copyDeco = (d: DecoView): DecoView => ({ worn: [...d.worn], placed: [...d.placed], pos: { ...(d.pos ?? {}) }, paint: d.paint });
/** 방 물건의 처음 자리 (deco3d 가 만든 그대로) — 옮긴 자리는 여기서 얼마나 떨어졌나로 계산 */
type RoomHome = { at: THREE.Vector3; focus: THREE.Vector3[]; rotZ: number };

const FRONT_Z = 7.8; // 책장 앞에 설 때 아바타 자리 (몸이 선반에 닿지 않게)
const BOOKENDS = ["planet-mint", "planet-coral", "planet-yellow", "planet-orange", "planet-brown"];
const IDENTITY = new THREE.Quaternion();
const FOV = 24; // 좁게 — 원근이 덜 과장된 '장난감 방' 느낌

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export class LibraryWorld {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 1, 3000);
  private last = 0; // 지난 프레임 시각 (ms)
  private sun = new THREE.DirectionalLight("#fffaf0", 1.7);
  private gradient = toonGradient();
  private shared: BookShared;
  private lineMat = new THREE.LineBasicMaterial({ color: PAL.ink, transparent: true, opacity: 0.7 });
  private own: Array<{ dispose(): void }> = [];
  private caseOwn: Array<{ dispose(): void }> = [];

  private caseRoot = new THREE.Group();
  private booksRoot = new THREE.Group();
  private fxRoot = new THREE.Group();
  private books = new Map<string, Book3D>();
  private layout: LibraryLayout = layoutLibrary([], false);
  private addMesh: THREE.Mesh | null = null;
  private avatar: Avatar | null = null;
  private cushion = new THREE.Vector3();
  // 꾸미기 — 방 물건·선물 상자
  private decoRoot = new THREE.Group();
  private roomKit: Kit;
  private roomKey = "";
  private room = new Map<string, RoomItem3D>();
  private roomHome = new Map<string, RoomHome>();
  private roomSpot = new Map<string, Spot>(); // 옮길 수 있는 물건이 지금 놓인 자리
  private deco: DecoView = { worn: [], placed: [], pos: {} };
  private pendingDeco: DecoView | null = null;
  private gifts = 0;
  private giftBox: { outer: THREE.Group; inner: THREE.Group; lid: THREE.Group; kit: Kit } | null = null;
  private giftSpot = new THREE.Vector3();
  private opening = false;
  // 책장 크게 보기 · 순서 바꾸기
  private shelfView = false;
  private insets = { top: 0, bottom: 0, left: 0 }; // 화면 가장자리에 버튼이 덮는 자리(px) — 방은 그 안쪽에 맞춘다
  private house: HouseId = DEFAULT_HOUSE; // 내가 살 집 — 벽·바닥·창과 방 보기 구도
  private shell: Shell | null = null;
  private shellKey = "";
  private rugColor = PAL.butter; // 지금 러그 색 (집이 바뀌면 다시 그린다)
  private editing = false;
  private drag: { b: Book3D; pointerId: number; planeZ: number; off: THREE.Vector2; rects: SpineRect[]; target: DropTarget } | null = null;
  // 물건 자리 — 방이 넓게 보이고, 방 물건을 끌어 옮긴다 (11-13 사용자: "아이템 위치도 옮기고")
  private arranging = false;
  private itemDrag: { id: string; pointerId: number; from: Spot; spot: Spot; off: { x: number; y: number }; sx: number; sy: number; moved: boolean } | null = null;
  private dropMark: { obj: THREE.Object3D; own: Array<{ dispose(): void }>; id: string; s: Spot["s"] } | null = null;
  private insertBar: THREE.Mesh | null = null;
  private raycaster = new THREE.Raycaster();
  private rugMesh: THREE.Mesh | null = null;
  private cushionMesh: THREE.Mesh | null = null;
  private moveSeq = 0;
  private pet: Pet | null = null;
  private guest: Avatar | null = null; // 친구 도서관에 놀러 간 '나'
  private guestCushion: THREE.Mesh | null = null;
  private moving = new Map<string, number>();

  private w = 1;
  private h = 1;
  private time = 0;
  private tweens: Tween[] = [];
  private fx: Fx[] = [];
  private timeScale = 1;
  private instant: boolean;
  private chain: Promise<void> = Promise.resolve();
  private running = 0;
  private pendingBooks: { books: LibraryBook[]; marks?: Set<string> } | null = null;
  private lastBooks: { books: LibraryBook[]; marks?: Set<string> } | null = null; // 책장 꾸미기가 바뀌면 다시 배치
  private shelfKey = "";
  private pendingAvatar: AvatarConfig | null = null;
  private held: Book3D | null = null;
  private readingId: string | null = null;
  private readingSheet = false; // 읽기 끝내기(몇 쪽까지) 창이 열렸나 — 열리면 책을 덮고 카메라가 예전 자리로
  private openBook: { group: THREE.Group; pivot: THREE.Group; own: Array<{ dispose(): void }>; book: Book3D; next: number; t: number } | null = null;
  private pageTex: THREE.Texture | null = null;
  private unit = 0;
  private readingView = false;
  private focus: StageFocus = "body"; // 미리보기 카메라 — 얼굴·머리·눈·코입은 그 부위로 다가가고, 동물까지 담기도
  private standing = false; // 미리보기에서 서 있기 (꾸미기 창 — 좁고 긴 칸에 크게)
  private view = { pos: new THREE.Vector3(0, 60, 200), look: new THREE.Vector3(0, 30, 0) };
  private goal = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  private snap = true;
  private active = false;
  private disposed = false;
  private down: { x: number; y: number; id: number } | null = null;
  // 카메라 손 조절 (방 보기에서만) — 살짝 돌리기·가까이/멀리. 빈 곳 두 번 누르면 처음대로
  private userCam = { yaw: 0, tilt: 0, zoom: 1 };
  private orbit: { id: number; x: number; y: number; yaw: number; tilt: number; on: boolean } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch: { dist: number; zoom: number } | null = null;
  private lastTap: { x: number; y: number; t: number } | null = null;
  private tmp = new THREE.Vector3();

  constructor(
    private canvas: HTMLCanvasElement,
    private mode: StageMode,
    private events: WorldEvents,
    font: string,
  ) {
    this.instant = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = new THREE.Color(PAL.paper);

    this.shared = { pages: pagesTexture(), star: starTexture(), sparkle: sparkleTexture(), font };
    this.own.push(this.gradient, this.lineMat, this.shared.pages, this.shared.star, this.shared.sparkle);

    // 빛 — 위에서 감싸는 빛 + 왼쪽 위 해 (부드러운 그림자)
    this.scene.add(new THREE.HemisphereLight("#fff6e6", "#d8b48c", 1.55));
    this.sun.position.set(-70, 160, 120);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -95;
    sc.right = 95;
    sc.top = 95;
    sc.bottom = -95;
    sc.near = 20;
    sc.far = 450;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.4;
    this.scene.add(this.sun, this.sun.target);

    this.scene.add(this.caseRoot, this.booksRoot, this.fxRoot, this.decoRoot);
    this.roomKit = new Kit(this.gradient);
    this.cushion.set(mode === "preview" ? 0 : 21, 0, mode === "preview" ? 0 : 42);
    this.giftSpot.set(this.cushion.x - 17, 0, this.cushion.z + 17);
    this.buildRoom();

    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointercancel", this.onCancel);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
  }

  // ── 바깥에서 부르는 것 ──

  setActive(on: boolean) {
    if (this.disposed || on === this.active) return;
    this.active = on;
    this.last = 0;
    this.renderer.setAnimationLoop(on ? this.tick : null);
  }

  resize(w: number, h: number) {
    if (this.disposed || w < 2 || h < 2) return;
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.snap = true;
    this.goalKey = "";
    if (!this.active) this.renderOnce();
  }

  setAvatar(cfg: AvatarConfig) {
    if (this.running) {
      this.pendingAvatar = cfg;
      return;
    }
    const old = this.avatar;
    const a = new Avatar(cfg, this.gradient);
    if (old) {
      a.root.position.copy(old.root.position);
      a.root.rotation.y = old.root.rotation.y;
      a.setPose(old.pose);
      a.setExpr(old.expr);
      if (this.held) a.hold.attach(this.held.group);
      old.root.removeFromParent();
      old.dispose();
    } else {
      a.root.position.copy(this.cushion);
      a.setPose(this.standing ? "stand" : "sit");
    }
    this.avatar = a;
    a.wear(this.deco.worn);
    a.root.visible = !(this.shelfView || this.editing);
    this.scene.add(a.root);
    if ((this.pet?.kind ?? "none") !== cfg.pet) {
      const at = this.pet?.root.position.clone() ?? this.petSpot();
      this.pet?.dispose();
    this.guest?.dispose();
      this.pet = cfg.pet === "none" ? null : new Pet(cfg.pet, this.gradient);
      if (this.pet) {
        this.pet.root.position.copy(at);
        this.pet.root.rotation.y = -0.5;
        this.pet.root.visible = a.root.visible;
        this.scene.add(this.pet.root);
      }
      this.goalKey = "";
    }
    if (old && this.mode === "preview") void this.greet("어때?", false); // 고른 얼굴이 보이게 웃는 표정 없이
  }

  setBooks(books: LibraryBook[], marks?: Set<string>) {
    if (this.mode === "preview") return;
    if (this.running) {
      this.pendingBooks = { books, marks };
      return;
    }
    this.lastBooks = { books, marks };
    this.shelfKey = this.shelfLook();
    const layout = layoutLibrary(books, this.mode === "home", { wide: this.deco.placed.includes("shelf-wide"), tall: this.deco.placed.includes("shelf-tall") });
    const byId = new Map(books.map((b) => [b.id, b]));
    // 빠진 책
    for (const [id, b3] of this.books) {
      if (!byId.has(id)) {
        if (this.held === b3) this.held = null;
        b3.dispose();
        this.books.delete(id);
      }
    }
    for (const slot of layout.slots) {
      const book = byId.get(slot.id);
      if (!book) continue;
      let b3 = this.books.get(slot.id);
      if (b3) b3.update(book, slot);
      else {
        b3 = new Book3D(book, slot, this.shared);
        this.books.set(slot.id, b3);
        this.booksRoot.add(b3.group);
      }
      if (!b3.out && this.drag?.b !== b3) this.slide(b3);
      b3.setMarked(Boolean(marks?.has(book.id)));
    }
    this.layout = layout;
    this.placeCushion();
    this.unit = Math.min(this.unit, layout.units.length - 1);
    this.buildCase();
    this.applyRoom();
    this.events.units?.(layout.units.length, this.unit);
    if (!this.active) this.renderOnce();
  }

  /** 꾸미기 — 아바타 소품·방 물건 (연출 중이면 끝난 뒤) */
  setDeco(deco: DecoView) {
    if (this.running) {
      this.pendingDeco = deco;
      return;
    }
    const wornChanged = deco.worn.join() !== this.deco.worn.join();
    this.deco = copyDeco(deco);
    if (wornChanged) this.avatar?.wear(this.deco.worn);
    if (!this.refreshShelf()) this.applyRoom();
    if (!this.active) this.renderOnce();
  }

  /** 책장 꾸미기 모양 (넓은·높은 책장·칠한 색) */
  private shelfLook(): string {
    const p = this.deco.placed;
    return [p.includes("shelf-wide"), p.includes("shelf-tall"), p.includes("paint") ? (this.deco.paint ?? "mint") : "wood"].join("|");
  }

  /** 책장 꾸미기가 바뀌었으면 책장을 다시 배치하고 다시 짓는다 (그 안에서 방 물건도) */
  private refreshShelf(): boolean {
    if (this.mode === "preview" || !this.lastBooks || this.shelfLook() === this.shelfKey) return false;
    this.setBooks(this.lastBooks.books, this.lastBooks.marks);
    return true;
  }

  /** 안 연 선물 수 — 있으면 러그 위에 선물 상자 (0 에서 늘면 위에서 툭 떨어진다) */
  setGifts(n: number) {
    const before = this.gifts;
    this.gifts = Math.max(0, n);
    if (this.mode !== "home" || this.opening) return;
    if (this.gifts > 0 && !this.giftBox) this.spawnGift(this.gifts > before && before === 0 && this.time > 1);
    else if (this.gifts === 0 && this.giftBox) this.removeGift();
  }

  /** 선물 열기 — 아바타가 상자 앞으로 가서 열면 물건이 '짠' 하고 놓이고/달린다 */
  openGift(itemId: string, deco: DecoView, left: number): Promise<void> {
    return this.enqueue(async () => {
      const av = this.avatar;
      const gb = this.giftBox;
      const item = ITEM[itemId];
      if (!av || !gb || !item) {
        this.deco = copyDeco(deco);
        this.avatar?.wear(this.deco.worn);
        this.applyRoom();
        this.gifts = Math.max(0, left);
        return;
      }
      this.opening = true;
      this.setShelfView(false);
      await this.getUp();
      await this.walkTo(this.giftSpot.x, this.giftSpot.z - 11);
      await this.turnTo(0, 0.15);
      av.setPose("carry");
      av.setExpr("wow");
      this.say("열어 볼까?");
      await this.wait(0.3);
      // 뚜껑이 퐁
      const lid = gb.lid;
      const y0 = lid.position.y;
      await this.tween(
        0.42,
        (p) => {
          lid.position.y = y0 + 16 * p - 6 * p * p;
          lid.position.x = 7 * p;
          lid.rotation.z = -1.3 * p;
        },
        ease.out,
      );
      this.burstAt(this.giftSpot.clone().add(new THREE.Vector3(0, 9, 0)));
      // 물건 등장
      this.deco = copyDeco(deco);
      if (item.kind === "shelf") {
        this.refreshShelf(); // 넓은·높은 책장·칠하기 — 책장이 바로 바뀐다
        this.burstAt(new THREE.Vector3(this.layout.units[0].x, this.layout.units[0].height + 4, -6));
      } else if (item.kind === "room") {
        this.applyRoom();
        const it = this.room.get(itemId);
        if (it) {
          const s0 = it.obj.scale.x; // 화분은 0.62 — 다 커진 뒤에도 원래 크기로
          it.obj.scale.setScalar(0.01);
          await this.tween(0.5, (p) => it.obj.scale.setScalar(Math.max(0.01, p) * s0), ease.outBack);
          this.burstAt(it.at.clone().add(new THREE.Vector3(0, 10, 0)));
        }
      } else {
        const o = av.wear(this.deco.worn).get(itemId);
        if (o) {
          const s0 = o.scale.clone();
          o.scale.setScalar(0.01);
          await this.tween(0.5, (p) => o.scale.copy(s0).multiplyScalar(Math.max(0.01, p)), ease.outBack);
        }
        this.burstAt(av.tagAnchor.getWorldPosition(new THREE.Vector3()));
      }
      av.setPose("cheer");
      av.setExpr("happy");
      this.say(item.label + " 받았다!");
      await this.hopInPlace(7);
      await this.wait(0.35);
      // 상자 치우기 — 남은 선물이 있으면 새 상자
      await this.tween(0.22, (p) => gb.outer.scale.setScalar(Math.max(0.01, 1 - p)));
      this.removeGift();
      this.opening = false;
      this.gifts = Math.max(0, left);
      if (this.gifts > 0) this.spawnGift(false);
      av.setPose("stand");
      av.setExpr("normal");
      await this.walkTo(this.cushion.x, this.cushion.z + 14);
      await this.sitDown("sit");
    });
  }

  /** 홈: 꺼내 와서 방석에 앉아 읽기까지 */
  fetch(id: string): Promise<void> {
    return this.enqueue(async () => {
      const b = this.books.get(id);
      const av = this.avatar;
      if (!b || !av || b.out) return;
      b.ensureCover();
      this.setShelfView(false);
      this.say(pick(["이거 읽을래!", "꺼내 올게!", "이 책이구나!"]));
      await this.getUp();
      await this.goTo(b);
      await this.takeFromShelf(b);
      await this.turnTo(0, 0.2);
      this.setUnit(0);
      await this.walkTo(this.cushion.x, this.cushion.z + 14);
      await this.sitDown("read");
      await this.holdBook(b, "read", 0.28);
      av.setExpr("read");
      this.readingId = id;
      if (!this.readingSheet) this.showOpenBook(b);
    });
  }

  /** 홈: 이어 읽기 — 연출 없이 방석에서 읽는 모습으로 */
  seat(id: string) {
    const b = this.books.get(id);
    const av = this.avatar;
    if (!b || !av) return;
    b.ensureCover();
    this.grab(b);
    av.root.position.set(this.cushion.x, 0, this.cushion.z);
    av.root.rotation.y = 0;
    av.setPose("read");
    av.setExpr("read");
    void this.holdBook(b, "read", 0).then(() => {
      if (this.readingId === id && !this.readingSheet) this.showOpenBook(b);
    });
    this.readingId = id;
  }

  /** 홈: 덮고 다시 꽂기 (다 읽었으면 먼저 만세). updated 를 주면 꽂는 순간 책갈피·별을 바꾼다 */
  putBack(id: string, finished = false, updated?: LibraryBook): Promise<void> {
    return this.enqueue(async () => {
      const av = this.avatar;
      const b = this.books.get(id) ?? this.held;
      this.readingId = null;
      this.hideOpenBook();
      if (!av || !b) return;
      const mark = () => {
        if (updated && updated.id === b.book.id) b.update(updated, b.slot);
      };
      if (finished) {
        av.setExpr("happy");
        av.setPose("cheer");
        this.say("다 읽었다!");
        this.burstAt(av.tagAnchor.getWorldPosition(new THREE.Vector3()));
        await this.hopInPlace(8);
        await this.wait(0.3);
      }
      av.setExpr("normal");
      if (b.out) {
        await this.getUp();
        av.setPose("carry");
        await this.holdBook(b, "carry", 0.2);
        await this.goTo(b);
        await this.putIntoShelf(b);
        mark();
        await this.turnTo(0, 0.2);
      } else {
        b.home();
        mark();
      }
      this.setUnit(0);
      await this.walkTo(this.cushion.x, this.cushion.z + 14);
      await this.sitDown("sit");
    });
  }

  /** 친구 도서관: 친구 아바타가 그 책을 꺼내 와서 보여 준다 (들고 있던 책은 먼저 꽂고) */
  present(id: string): Promise<void> {
    return this.enqueue(async () => {
      const av = this.avatar;
      const b = this.books.get(id);
      if (!av || !b || this.held === b) return;
      if (this.held) await this.returnHeld();
      b.ensureCover();
      this.setShelfView(false);
      this.say(pick(["이 책 보여 줄게!", "잠깐만!", "이거?"]));
      await this.getUp();
      await this.goTo(b);
      await this.takeFromShelf(b);
      await this.turnTo(0, 0.2);
      this.setUnit(0);
      await this.walkTo(this.cushion.x, this.cushion.z + 16);
      av.setPose("show");
      av.setExpr("happy");
      await this.holdBook(b, "show", 0.26);
    });
  }

  /** 친구 도서관: 보여 주던 책을 꽂고 방석으로 */
  stow(): Promise<void> {
    return this.enqueue(async () => {
      if (!this.held) return;
      await this.returnHeld();
      this.setUnit(0);
      await this.walkTo(this.cushion.x, this.cushion.z + 14);
      await this.sitDown("sit");
    });
  }

  /** 손 흔들고 한마디 (happy 면 웃는 얼굴로) */
  greet(line?: string, happy = true): Promise<void> {
    if (this.running) return Promise.resolve();
    return this.enqueue(async () => {
      const av = this.avatar;
      if (!av) return;
      const before = av.pose;
      const sitting = before === "sit" || before === "read";
      if (before === "read" || before === "show") {
        if (line) this.say(line);
        return; // 책 들고 있을 땐 말만
      }
      av.setPose(sitting ? "sitwave" : "wave");
      if (happy) av.setExpr("happy");
      this.say(line ?? pick(["오늘은 뭐 읽을까?", "책 골라 줘!", "같이 읽자!"]));
      await this.wait(1.1);
      av.setPose(before);
      av.setExpr("normal");
    });
  }

  /** 책장 크게 보기 (책장만 화면 가득) — 책을 고르면 다시 방 보기로 */
  setShelfView(on: boolean) {
    if (this.shelfView === on) return;
    this.shelfView = on;
    this.goalKey = "";
    this.applyForeground();
    this.events.view?.(on || this.editing);
  }

  /** 순서 바꾸기 — 책장이 크게 보이고, 책을 끌어 옮긴다 (책이 살짝 들썩인다) */
  setEditing(on: boolean) {
    if (this.editing === on) return;
    this.editing = on;
    if (!on) {
      this.cancelDrag();
      for (const b of this.books.values()) b.group.rotation.z = 0;
    }
    this.goalKey = "";
    this.applyForeground();
    this.events.view?.(on || this.shelfView);
  }

  /** 물건 자리 — 방이 조금 넓게 보이고, 옮길 수 있는 물건이 살랑거린다. 끌어서 책장 위·바닥·벽에 놓는다 */
  setArranging(on: boolean) {
    if (this.arranging === on || this.mode !== "home") return;
    this.arranging = on;
    if (on) {
      this.setShelfView(false);
      this.setEditing(false);
    } else {
      this.cancelItemDrag();
      for (const [id, it] of this.room) it.obj.rotation.z = this.roomHome.get(id)?.rotZ ?? 0;
    }
    this.goalKey = "";
    this.applyForeground();
  }

  /** 친구 도서관에 놀러 간 '나' — 오른쪽에서 걸어 들어와 인사하고 손님 방석에 앉는다 */
  setGuest(cfg: AvatarConfig | null, worn: string[] = []) {
    if (this.mode !== "visit") return;
    if (this.guest) {
      this.guest.root.removeFromParent();
      this.guest.dispose();
      this.guest = null;
    }
    if (!cfg) return;
    const g = new Avatar(cfg, this.gradient);
    g.wear(worn);
    const start = new THREE.Vector3(this.cushion.x + 64, 0, this.cushion.z + 26);
    g.root.position.copy(start);
    g.root.rotation.y = -Math.PI / 2;
    g.setPose("stand");
    g.root.visible = !(this.shelfView || this.editing);
    this.scene.add(g.root);
    this.guest = g;
    if (!this.guestCushion) {
      const geo = new RoundedBoxGeometry(24, CUSHION_H - 1, 22, 4, 2.4);
      const mat = this.toon(PAL.coral);
      this.own.push(geo, mat);
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      this.addOutline(m, geo, 0.4);
      this.scene.add(m);
      this.guestCushion = m;
    }
    const spot = this.guestSpot();
    this.guestCushion.position.set(spot.x, (CUSHION_H - 1) / 2, spot.z);
    this.goalKey = "";
    void this.enqueue(async () => {
      const host = this.avatar;
      await this.walkTo(spot.x, spot.z + 14, g);
      await this.turnTo(facing(this.cushion.x - spot.x, this.cushion.z - spot.z - 14), 0.18, g);
      g.setPose("wave");
      g.setExpr("happy");
      this.events.sayGuest?.("놀러 왔어!");
      await this.wait(0.7);
      if (host && host.pose === "sit") {
        host.setPose("sitwave");
        host.setExpr("happy");
        this.say("어서 와!");
      }
      await this.wait(1.0);
      if (host && host.pose === "sitwave") {
        host.setPose("sit");
        host.setExpr("normal");
      }
      g.setPose("stand");
      g.setExpr("normal");
      await this.turnTo(0, 0.15, g);
      await this.hop(new THREE.Vector3(spot.x, 0, spot.z), 8, 0.34, "sit", g);
    });
  }

  /** 발도장을 남기면 손님(나)이 만세 */
  guestCheer(line = "발도장 꾹!") {
    const g = this.guest;
    if (!g) return;
    void this.enqueue(async () => {
      const before = g.pose;
      g.setPose(before === "sit" ? "sitwave" : "cheer");
      g.setExpr("happy");
      this.events.sayGuest?.(line);
      this.burstAt(g.tagAnchor.getWorldPosition(new THREE.Vector3()));
      await this.wait(1.1);
      g.setPose(before);
      g.setExpr("normal");
    });
  }

  private guestSpot(): THREE.Vector3 {
    return new THREE.Vector3(this.cushion.x - 28, 0, this.cushion.z + 8);
  }

  /** 동물이 쉬는 자리 — 방석 오른쪽 앞 */
  private petSpot(): THREE.Vector3 {
    return new THREE.Vector3(this.cushion.x + 17, 0, this.cushion.z + 9);
  }

  /** 동물 — 아바타가 앉아 있으면 제자리에서 쉬고(읽는 동안엔 잔다), 걸으면 뒤쪽 옆을 졸졸 */
  private stepPet(dt: number) {
    const pet = this.pet;
    const av = this.avatar;
    if (!pet || !av) return;
    const sitting = av.pose === "sit" || av.pose === "read" || av.pose === "sitwave" || (this.mode === "preview" && this.standing); // 꾸미기 창에선 옆에 얌전히
    pet.sleeping = av.pose === "read";
    if (sitting) {
      const spot = this.petSpot();
      pet.update(dt, spot, Math.atan2(av.root.position.x - spot.x, av.root.position.z + 20 - spot.z));
      return;
    }
    const off = new THREE.Vector3(-11, 0, -9).applyAxisAngle(new THREE.Vector3(0, 1, 0), av.root.rotation.y);
    const target = av.root.position.clone().add(off);
    target.y = 0;
    target.z = Math.max(target.z, 9); // 책장 안으로 들어가지 않게
    pet.update(dt, target, av.root.rotation.y);
  }

  /** 책장만 볼 땐 앞쪽 것들이 책장을 가리지 않게 숨긴다 */
  private applyForeground() {
    const show = !(this.shelfView || this.editing);
    if (this.avatar) this.avatar.root.visible = show;
    if (this.pet) this.pet.root.visible = show;
    if (this.guest) this.guest.root.visible = show;
    if (this.guestCushion) this.guestCushion.visible = show;
    if (this.cushionMesh) this.cushionMesh.visible = show;
    if (this.rugMesh) this.rugMesh.visible = show;
    if (this.giftBox) this.giftBox.outer.visible = show;
    // 바닥에 놓인 물건(고양이·탁자, 바닥으로 옮긴 화분·스탠드)도 책장 앞을 가리니 숨긴다
    for (const [id, it] of this.room) it.obj.visible = show || this.roomSpot.get(id)?.s !== "floor";
  }

  /** 버튼이 덮는 가장자리 (위 이름판·아래 퀵메뉴·왼쪽 탭) — 방·책장 보기가 그 안쪽에 들어오게 */
  setInsets(top: number, bottom: number, left = 0) {
    const i = this.insets;
    if (i.top === top && i.bottom === bottom && i.left === left) return;
    this.insets = { top, bottom, left };
    this.goalKey = "";
  }

  /** '몇 쪽까지' 창이 열렸다/닫혔다 — 열리면 책을 덮고(카메라는 위쪽으로), 닫히면 다시 편다 */
  setReadingSheet(open: boolean) {
    if (this.readingSheet === open) return;
    this.readingSheet = open;
    this.goalKey = "";
    const b = this.held;
    if (open) this.hideOpenBook();
    else if (b && this.readingId === b.book.id) this.showOpenBook(b);
  }

  /** 읽는 동안 손에 든 책 대신 펼친 책 — 양쪽 쪽은 글줄, 오른쪽에서 한 장이 가끔 넘어간다 */
  private showOpenBook(b: Book3D) {
    this.hideOpenBook();
    const parent = b.group.parent;
    if (!parent || this.instant) return;
    this.pageTex ??= openPageTexture();
    const own: Array<{ dispose(): void }> = [];
    const k = 0.62;
    const W = Math.max(8, b.slot.d * k); // 한 쪽 너비
    const H = Math.max(10, b.slot.h * k);
    const T = Math.min(1.6, Math.max(0.5, b.slot.t * k * 0.45)); // 한쪽 종이 두께
    const coverMat = this.toon(b.color);
    const sideMat = new THREE.MeshLambertMaterial({ color: PAL.page });
    const faceMat = new THREE.MeshLambertMaterial({ map: this.pageTex });
    own.push(coverMat, sideMat, faceMat);
    b.ensureCover();
    const front = b.coverMaterial; // 책이 치운다 (own 에 넣지 않는다)
    const g = new THREE.Group();
    const OPEN = 0.3; // 쪽이 카메라 쪽으로 벌어진 각
    for (const side of [-1, 1]) {
      const half = new THREE.Group();
      const boardGeo = new THREE.BoxGeometry(W + 0.5, H + 0.9, 0.45);
      // 바깥 면(-z)에 앞표지 — 아바타 쪽에서 보면 왼쪽 판, 우리 쪽에서 보면 오른쪽 (앞표지는 펼치면 왼쪽)
      const board = new THREE.Mesh(boardGeo, side < 0 ? [coverMat, coverMat, coverMat, coverMat, coverMat, front] : coverMat);
      board.position.set(side * (W / 2 + 0.15), 0, -0.25);
      const blockGeo = new THREE.BoxGeometry(W, H, T);
      const block = new THREE.Mesh(blockGeo, sideMat);
      block.position.set(side * (W / 2), 0, T / 2);
      const faceGeo = new THREE.PlaneGeometry(W * 0.96, H * 0.96);
      const face = new THREE.Mesh(faceGeo, faceMat);
      face.position.set(side * (W / 2), 0, T + 0.02);
      for (const m of [board, block]) m.castShadow = true;
      half.add(board, block, face);
      half.rotation.y = -side * OPEN;
      own.push(boardGeo, blockGeo, faceGeo);
      g.add(half);
    }
    // 넘어가는 한 장 — 책등(x=0)에 붙어 오른쪽에서 왼쪽으로
    const pageGeo = new THREE.PlaneGeometry(W * 0.96, H * 0.95);
    pageGeo.translate((W * 0.96) / 2, 0, 0);
    const pageMat = new THREE.MeshLambertMaterial({ map: this.pageTex, side: THREE.DoubleSide });
    own.push(pageGeo, pageMat);
    const pivot = new THREE.Group();
    pivot.position.z = T + 0.06;
    pivot.add(new THREE.Mesh(pageGeo, pageMat));
    pivot.visible = false;
    g.add(pivot);
    // 쪽이 아바타 눈을 보게 — 뒤로 돌리고(π) 위쪽을 앞으로 기울인다. 우리 쪽에선 펼친 표지(텐트 모양) 너머로 눈이 보인다
    g.position.set(0, 1.2, 3.9);
    g.rotation.set(0.55, Math.PI, 0);
    parent.add(g);
    b.group.visible = false;
    this.openBook = { group: g, pivot, own, book: b, next: 2.5 + Math.random() * 2, t: -1 };
  }

  private hideOpenBook() {
    const ob = this.openBook;
    if (!ob) return;
    ob.group.removeFromParent();
    for (const d of ob.own) d.dispose();
    ob.book.group.visible = true;
    this.openBook = null;
  }

  /** 가끔 한 장 넘기기 (0.7초) */
  private stepOpenBook(dt: number) {
    const ob = this.openBook;
    if (!ob) return;
    if (ob.t < 0) {
      ob.next -= dt;
      if (ob.next > 0) return;
      ob.t = 0;
      ob.pivot.visible = true;
    }
    ob.t = Math.min(1, ob.t + dt / 0.7);
    const e = ease.inOut(ob.t);
    ob.pivot.rotation.y = -0.3 - (Math.PI - 0.6) * e;
    if (ob.t >= 1) {
      ob.t = -1;
      ob.pivot.visible = false;
      ob.next = 5 + Math.random() * 4;
    }
  }

  /** 미리보기에서 서 있기 — 꾸미기 창(좁고 긴 왼쪽 칸)에서 아바타가 크게 보이게. 방석은 숨긴다 */
  setStanding(on: boolean) {
    if (this.mode !== "preview" || this.standing === on) return;
    this.standing = on;
    if (this.cushionMesh) this.cushionMesh.visible = !on;
    if (this.avatar && !this.running) this.avatar.setPose(on ? "stand" : "sit");
    this.goalKey = "";
  }

  /** 미리보기 카메라 — 얼굴 꾸밀 땐 얼굴만 크게 */
  setFocus(f: StageFocus) {
    if (f === this.focus) return;
    this.focus = f;
    this.goalKey = "";
  }

  /** 읽는 동안 카메라를 아바타 가까이 (전체 화면) */
  setReadingView(on: boolean, smooth = false) {
    if (this.readingView === on) return;
    this.readingView = on;
    if (!smooth) this.snap = true;
  }

  /** 연출 빨리 감기 (진행 중에 누르면) */
  hurry() {
    if (this.running) this.timeScale = 3.2;
  }

  /** 시험용 — 책등 가운데가 화면 어디인지 (캔버스 기준 CSS px). 사람처럼 그 자리를 눌러 본다 */
  debugBookPoint(id: string): { x: number; y: number } | null {
    const b = this.books.get(id);
    if (!b || b.out) return null;
    const { x, y, z, h, d } = b.slot;
    return this.toScreen(new THREE.Vector3(x, y + h * 0.55, z + d / 2));
  }

  /** 시험용 — 아바타 몸 가운데 화면 자리 */
  debugAvatarPoint(): { x: number; y: number } | null {
    return this.avatar ? this.toScreen(this.avatar.center()) : null;
  }

  /** 시험용 — 선물 상자 화면 자리 */
  debugGiftPoint(): { x: number; y: number } | null {
    return this.giftBox ? this.toScreen(this.giftSpot.clone().add(new THREE.Vector3(0, 5, 0))) : null;
  }

  /** 시험용 — 방 물건 화면 자리 (그림 한가운데쯤, 끌기 시작점) */
  debugItemPoint(id: string): { x: number; y: number } | null {
    const it = this.room.get(id);
    if (!it) return null;
    it.obj.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(it.obj);
    return box.isEmpty() ? null : this.toScreen(box.getCenter(new THREE.Vector3()));
  }

  /** 시험용 — 방 바닥·책장 위·벽의 한 점을 화면 자리로 (끌어 놓을 곳 고르기) */
  debugRoomPoint(x: number, y: number, z: number): { x: number; y: number } {
    return this.toScreen(new THREE.Vector3(x, y, z));
  }

  /** 시험용 — 지금 상태 */
  debugState() {
    return {
      running: this.running,
      held: this.held?.book.id ?? null,
      reading: this.readingId,
      pose: this.avatar?.pose ?? null,
      unit: this.unit,
      units: this.layout.units.length,
      books: [...this.books.keys()],
      gifts: this.gifts,
      shelfView: this.shelfView,
      editing: this.editing,
      arranging: this.arranging,
      house: this.house,
      openBook: Boolean(this.openBook),
      order: [...this.books.values()].sort((a, b) => a.slot.index - b.slot.index).map((b) => b.book.id),
      worn: this.deco.worn,
      placed: this.deco.placed,
      spots: Object.fromEntries(this.roomSpot),
      pos: this.deco.pos ?? {},
      cushion: { x: this.cushion.x, z: this.cushion.z },
      caseTop: this.layout.units[0]?.height ?? 0,
      cases: this.layout.units.map((u) => ({ x: u.x, width: u.width, height: u.height })),
      wallZ: -CASE.depth - 3,
    };
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    for (const tw of this.tweens) tw.done();
    this.tweens = [];
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointercancel", this.onCancel);
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("wheel", this.onWheel);
    for (const b of this.books.values()) b.dispose();
    this.books.clear();
    this.avatar?.dispose();
    this.pet?.dispose();
    for (const d of [...this.caseOwn, ...this.own]) d.dispose();
    for (const d of this.shell?.own ?? []) d.dispose();
    this.hideOpenBook();
    this.hideDropMark();
    this.pageTex?.dispose();
    this.roomKit.dispose();
    this.giftBox?.kit.dispose();
    for (const f of this.fx) f.obj.material.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  // ── 장면 만들기 ──

  private toon(color: string): THREE.MeshToonMaterial {
    return new THREE.MeshToonMaterial({ color, gradientMap: this.gradient });
  }

  /** 집 껍데기(벽·바닥·천장·창) — 집이 바뀌거나 첫 책장 크기가 바뀌면(창 자리) 다시 */
  private applyShell() {
    const u = this.layout.units[0];
    const preview = this.mode === "preview";
    const key = preview ? `${this.house}|p` : `${this.house}|${u?.x}|${u?.width}|${u?.height}`;
    if (key === this.shellKey) return;
    this.shellKey = key;
    if (this.shell) {
      this.shell.group.removeFromParent();
      for (const d of this.shell.own) d.dispose();
    }
    this.shell = buildShell(
      this.house,
      { wallZ: -CASE.depth - 3, caseX: u?.x ?? 0, caseHalf: (u?.width ?? 60) / 2, caseTop: u?.height ?? 60, preview },
      (c) => this.toon(c),
    );
    this.scene.add(this.shell.group);
  }

  /** 내가 살 집 바꾸기 (처음 가입·꾸미기·친구 집) */
  setHouse(id: HouseId) {
    if (id === this.house) return;
    this.house = id;
    this.applyShell();
    this.applyHouseColors();
    if (this.mode !== "preview" && this.room.size) this.placeRoomItems(); // 집마다 창 자리가 달라 옮긴 물건이 비켜 간다
    this.goalKey = "";
  }

  /** 러그·방석 색 = 집마다 */
  private applyHouseColors() {
    const c = HOUSE_COLORS[this.house];
    const rug = this.rugMesh?.material as THREE.MeshLambertMaterial | undefined;
    if (rug && this.rugColor !== c.rug) {
      const t = rugTexture(c.rug);
      this.own.push(t);
      rug.map = t;
      rug.needsUpdate = true;
      this.rugColor = c.rug;
    }
    (this.cushionMesh?.material as THREE.MeshToonMaterial | undefined)?.color.set(c.cushion);
  }

  private buildRoom() {
    const own = this.own;
    this.applyShell();

    // 러그 + 방석 (산사의 방석처럼 — 아바타 자리)
    const rugTex = rugTexture();
    const rugGeo = new THREE.CircleGeometry(23, 56);
    const rugMat = new THREE.MeshLambertMaterial({ map: rugTex, transparent: true });
    const rug = new THREE.Mesh(rugGeo, rugMat);
    this.rugMesh = rug;
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(this.cushion.x, 0.12, this.cushion.z + 2);
    rug.receiveShadow = true;
    own.push(rugTex, rugGeo, rugMat);

    const cGeo = new RoundedBoxGeometry(28, CUSHION_H, 25, 4, 2.6);
    const cMat = this.toon(PAL.mint);
    const cushion = new THREE.Mesh(cGeo, cMat);
    this.cushionMesh = cushion;
    cushion.position.set(this.cushion.x, CUSHION_H / 2, this.cushion.z);
    cushion.castShadow = true;
    cushion.receiveShadow = true;
    const stitch = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(22, 0.01, 19)), new THREE.LineDashedMaterial({ color: PAL.ink, dashSize: 1.4, gapSize: 1.1 }));
    stitch.computeLineDistances();
    stitch.position.y = CUSHION_H / 2 + 0.08;
    const btnGeo = new THREE.SphereGeometry(1.2, 12, 8);
    const btnMat = this.toon(PAL.cream);
    const btn = new THREE.Mesh(btnGeo, btnMat);
    btn.scale.y = 0.5;
    btn.position.y = CUSHION_H / 2 + 0.2;
    cushion.add(stitch, btn);
    own.push(cGeo, cMat, stitch.geometry, stitch.material as THREE.Material, btnGeo, btnMat);
    this.scene.add(rug, cushion);
    this.addOutline(cushion, cGeo, 0.42);
    this.applyHouseColors();
  }

  /** 둥근 물건 테두리 (뒤집은 껍데기) */
  private addOutline(mesh: THREE.Mesh, geo: THREE.BufferGeometry, thickness: number) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { thickness: { value: thickness }, color: { value: new THREE.Color(PAL.ink) } },
      vertexShader: "uniform float thickness; void main(){ vec3 p = position + normal * thickness; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }",
      fragmentShader: "uniform vec3 color; void main(){ gl_FragColor = vec4(color, 1.0); \n#include <colorspace_fragment>\n }",
      side: THREE.BackSide,
    });
    this.own.push(mat);
    const o = new THREE.Mesh(geo, mat);
    mesh.add(o);
  }

  /** 방 물건 — 놓은 것만. 책장 크기가 바뀌면 벽 물건 자리가 달라져 다시 만든다 */
  private applyRoom() {
    if (this.mode === "preview") return;
    this.applyShell();
    const u = this.layout.units[0];
    const key = [u.x, u.width, u.height, this.cushion.x].join(",");
    if (key !== this.roomKey) {
      this.cancelItemDrag();
      for (const it of this.room.values()) it.obj.removeFromParent();
      this.room.clear();
      this.roomHome.clear();
      this.roomSpot.clear();
      this.roomKit.dispose();
      this.roomKit = new Kit(this.gradient);
      this.roomKey = key;
    }
    for (const [id, it] of this.room) {
      if (!this.deco.placed.includes(id)) {
        if (this.itemDrag?.id === id) this.cancelItemDrag();
        it.obj.removeFromParent();
        this.room.delete(id);
        this.roomHome.delete(id);
        this.roomSpot.delete(id);
      }
    }
    const ctx = { caseX: u.x, caseHalf: u.width / 2, caseTop: u.height, wallZ: -CASE.depth - 3, cushion: this.cushion };
    for (const id of this.deco.placed) {
      if (this.room.has(id)) continue;
      const it = buildRoomItem(id, this.roomKit, ctx);
      if (!it) continue;
      this.decoRoot.add(it.obj);
      this.room.set(id, it);
      this.roomHome.set(id, { at: it.at.clone(), focus: it.focus.map((p) => p.clone()), rotZ: it.obj.rotation.z });
    }
    this.placeRoomItems();
    this.applyForeground();
    this.goalKey = "";
  }

  // ── 방 물건 자리 (물건 자리 모드에서 끌어 옮긴다) ──

  private roomFrame(): RoomFrame {
    return roomFrame({
      cases: this.layout.units.map((u) => ({ x: u.x, width: u.width, height: u.height })),
      cushion: { x: this.cushion.x, z: this.cushion.z },
      wallZ: -CASE.depth - 3,
      house: this.house,
      lights: this.deco.placed.includes("lights"),
      ladder: this.deco.placed.includes("ladder"),
    });
  }

  /** 방 물건 자리 — 옮긴 적 없는 물건은 처음 자리, 옮긴 물건은 저장한 자리(막혔으면 가장 가까운 빈자리, 아예 안 되면 처음 자리) */
  private placeRoomItems() {
    const f = this.roomFrame();
    const pos = this.deco.pos ?? {};
    const settled: Array<{ id: string; spot: Spot }> = [];
    const moved: string[] = [];
    for (const id of this.room.keys()) {
      const s = homeSurface(id);
      const home = this.roomHome.get(id);
      if (!s || !home) continue;
      if (pos[id]) {
        moved.push(id);
        continue;
      }
      const spot: Spot = { s, x: home.at.x, y: home.at.y, z: home.at.z };
      settled.push({ id, spot });
      if (this.itemDrag?.id !== id) this.setItemSpot(id, spot);
    }
    const order = (id: string) => TRACK.findIndex((t) => t.id === id);
    moved.sort((a, b) => order(a) - order(b));
    for (const id of moved) {
      const home = this.roomHome.get(id)!;
      const spot = placeSpot(id, fromPos(pos[id], f, home.at.z), f, settled) ?? { s: homeSurface(id)!, x: home.at.x, y: home.at.y, z: home.at.z };
      settled.push({ id, spot });
      if (this.itemDrag?.id !== id) this.setItemSpot(id, spot);
    }
  }

  /** 물건을 그 자리로 — 그림·카메라가 담을 점(focus)도 같이 */
  private setItemSpot(id: string, spot: Spot) {
    const it = this.room.get(id);
    const home = this.roomHome.get(id);
    if (!it || !home) return;
    const d = new THREE.Vector3(spot.x - home.at.x, spot.y - home.at.y, spot.z - home.at.z);
    it.obj.position.set(spot.x, spot.y, spot.z);
    it.at.copy(home.at).add(d);
    it.focus.forEach((p, i) => home.focus[i] && p.copy(home.focus[i]).add(d));
    this.roomSpot.set(id, { ...spot });
  }

  /** 화면 자리의 방 물건 (옮길 수 있는 것만) — 겹치면 작은 것 */
  private itemAt(x: number, y: number): string | null {
    let best: { id: string; area: number } | null = null;
    const box = new THREE.Box3();
    const c = new THREE.Vector3();
    for (const [id, it] of this.room) {
      if (!canMove(id) || !it.obj.visible) continue;
      it.obj.updateWorldMatrix(true, true);
      box.setFromObject(it.obj);
      if (box.isEmpty()) continue;
      let l = Infinity;
      let r = -Infinity;
      let t = Infinity;
      let b = -Infinity;
      for (const cx of [box.min.x, box.max.x])
        for (const cy of [box.min.y, box.max.y])
          for (const cz of [box.min.z, box.max.z]) {
            const p = this.toScreen(c.set(cx, cy, cz));
            l = Math.min(l, p.x);
            r = Math.max(r, p.x);
            t = Math.min(t, p.y);
            b = Math.max(b, p.y);
          }
      const pad = 10; // 작은 물건도 손가락으로 집기 쉽게
      if (x < l - pad || x > r + pad || y < t - pad || y > b + pad) continue;
      const area = (r - l) * (b - t);
      if (!best || area < best.area) best = { id, area };
    }
    return best?.id ?? null;
  }

  /** 손가락 자리(캔버스 px) → 그 물건을 놓을 면 위의 점. 화분·스탠드는 책장 윗면(과 그 뒤)을 가리키면 책장 위, 아니면 바닥 */
  private surfaceAt(id: string, sx: number, sy: number): Spot | null {
    const ndc = new THREE.Vector2((sx / this.w) * 2 - 1, -(sy / this.h) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const ray = this.raycaster.ray;
    const hit = new THREE.Vector3();
    const surf = ROOM_SURFACES[id] ?? [];
    if (surf.includes("wall")) {
      const z = this.roomHome.get(id)?.at.z ?? -CASE.depth - 2.6;
      return ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -z), hit) ? { s: "wall", x: hit.x, y: hit.y, z } : null;
    }
    if (surf.includes("top")) {
      const u = this.layout.units[0];
      if (ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -u.height), hit) && hit.z < 4 && Math.abs(hit.x - u.x) < u.width / 2 + 3) {
        return { s: "top", x: hit.x, y: u.height, z: TOP_Z };
      }
    }
    if (surf.includes("floor") && ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return { s: "floor", x: hit.x, y: 0, z: hit.z };
    return null;
  }

  private startItemDrag(id: string, e: PointerEvent) {
    const spot = this.roomSpot.get(id);
    if (!spot) return;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // 캡처가 안 되는 브라우저면 캔버스 밖으로 나가면 놓친다
    }
    const r = this.canvas.getBoundingClientRect();
    const base = this.toScreen(new THREE.Vector3(spot.x, spot.y, spot.z));
    this.itemDrag = {
      id,
      pointerId: e.pointerId,
      from: { ...spot },
      spot: { ...spot },
      off: { x: base.x - (e.clientX - r.left), y: base.y - (e.clientY - r.top) }, // 잡은 곳과 물건 밑면의 화면 거리 (끄는 내내 그대로)
      sx: e.clientX,
      sy: e.clientY,
      moved: false,
    };
    const it = this.room.get(id);
    if (it) it.obj.rotation.z = this.roomHome.get(id)?.rotZ ?? 0;
    this.liftItem(id, spot);
    this.showDropMark(id, spot);
  }

  private moveItemDrag(e: PointerEvent) {
    const d = this.itemDrag;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
    d.moved = true;
    const r = this.canvas.getBoundingClientRect();
    const want = this.surfaceAt(d.id, e.clientX - r.left + d.off.x, e.clientY - r.top + d.off.y);
    if (!want) return;
    const others = [...this.roomSpot].filter(([k]) => k !== d.id).map(([k, spot]) => ({ id: k, spot }));
    const spot = placeSpot(d.id, want, this.roomFrame(), others);
    if (!spot) return; // 놓을 데가 없으면 마지막 자리에 그대로
    d.spot = spot;
    this.liftItem(d.id, spot);
    this.showDropMark(d.id, spot);
  }

  /** 끄는 동안 살짝 들린다 (벽 물건은 벽에서 앞으로) */
  private liftItem(id: string, spot: Spot) {
    this.setItemSpot(id, spot);
    const it = this.room.get(id);
    if (!it) return;
    if (spot.s === "wall") it.obj.position.z += 2.5;
    else it.obj.position.y += 4;
  }

  private endItemDrag() {
    const d = this.itemDrag;
    if (!d) return;
    this.itemDrag = null;
    this.hideDropMark();
    const it = this.room.get(d.id);
    if (!d.moved) {
      // 그냥 눌렀으면 콩 뛰고 제자리
      this.setItemSpot(d.id, d.from);
      if (it) {
        const y0 = it.obj.position.y;
        void this.tween(0.32, (p) => (it.obj.position.y = y0 + Math.sin(p * Math.PI) * 4), ease.out);
      }
      return;
    }
    const lifted = it?.obj.position.clone();
    this.setItemSpot(d.id, d.spot);
    if (it && lifted) {
      const to = it.obj.position.clone();
      void this.tween(0.22, (p) => it.obj.position.lerpVectors(lifted, to, p), ease.out);
    }
    const pos = toPos(d.spot, this.roomFrame());
    this.deco = { ...this.deco, pos: { ...(this.deco.pos ?? {}), [d.id]: pos } };
    this.applyForeground();
    this.events.arrange?.(d.id, pos);
  }

  private cancelItemDrag() {
    const d = this.itemDrag;
    if (!d) return;
    this.itemDrag = null;
    this.hideDropMark();
    this.setItemSpot(d.id, d.from);
  }

  /** 놓을 자리 표시 — 바닥·책장 위엔 코랄 고리, 벽엔 코랄 네모 */
  private showDropMark(id: string, spot: Spot) {
    if (!this.dropMark || this.dropMark.id !== id || this.dropMark.s !== spot.s) {
      this.hideDropMark();
      const own: Array<{ dispose(): void }> = [];
      const mat = new THREE.MeshBasicMaterial({ color: PAL.coral, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
      own.push(mat);
      let obj: THREE.Object3D;
      if (spot.s === "wall") {
        const r = wallRect(id, 0, 0)!;
        const g = new THREE.Group();
        const t = 1.3;
        const w = r.x1 - r.x0;
        const h = r.y1 - r.y0;
        for (const [bw, bh, bx, by] of [
          [w + t, t, 0, r.y0],
          [w + t, t, 0, r.y1],
          [t, h, r.x0, (r.y0 + r.y1) / 2],
          [t, h, r.x1, (r.y0 + r.y1) / 2],
        ] as const) {
          const geo = new THREE.PlaneGeometry(bw, bh);
          own.push(geo);
          const m = new THREE.Mesh(geo, mat);
          m.position.set(bx, by, 0);
          g.add(m);
        }
        obj = g;
      } else {
        const rad = itemRadius(id);
        const geo = new THREE.RingGeometry(rad + 0.8, rad + 2.4, 40);
        own.push(geo);
        const m = new THREE.Mesh(geo, mat);
        m.rotation.x = -Math.PI / 2;
        obj = m;
      }
      obj.renderOrder = 5;
      this.scene.add(obj);
      this.dropMark = { obj, own, id, s: spot.s };
    }
    const o = this.dropMark.obj;
    if (spot.s === "wall") o.position.set(spot.x, spot.y, spot.z + 0.15);
    else o.position.set(spot.x, spot.y + 0.3, spot.z);
  }

  private hideDropMark() {
    const m = this.dropMark;
    if (!m) return;
    m.obj.removeFromParent();
    for (const d of m.own) d.dispose();
    this.dropMark = null;
  }

  private spawnGift(drop: boolean) {
    const kit = new Kit(this.gradient);
    const { obj: inner, lid } = buildGiftBox(kit);
    const outer = new THREE.Group();
    outer.add(inner);
    outer.position.copy(this.giftSpot);
    this.scene.add(outer);
    this.giftBox = { outer, inner, lid, kit };
    outer.visible = !(this.shelfView || this.editing);
    this.goalKey = "";
    if (this.instant) return;
    if (drop) {
      outer.position.y = 75;
      this.say("배달 왔어!");
      void this.tween(0.6, (p) => (outer.position.y = 75 * (1 - p)), ease.in).then(() =>
        this.tween(0.28, (p) => {
          const k = Math.sin(p * Math.PI) * 0.2;
          outer.scale.set(1 + k, 1 - k, 1 + k);
        }),
      );
    } else {
      outer.scale.setScalar(0.01);
      void this.tween(0.4, (p) => outer.scale.setScalar(Math.max(0.01, p)), ease.outBack);
    }
  }

  private removeGift() {
    const gb = this.giftBox;
    if (!gb) return;
    gb.outer.removeFromParent();
    gb.kit.dispose();
    this.giftBox = null;
    this.goalKey = "";
  }

  /** 방석은 첫 책장 오른쪽 앞 — 책장이 좁아지거나 넓어지면 따라간다 (앉아 있던 아바타·선물 상자도) */
  private placeCushion() {
    if (this.mode === "preview") return;
    const u = this.layout.units[0];
    const x = u.x + Math.max(6, u.width / 2 - 12);
    const z = 41;
    const dx = x - this.cushion.x;
    const dz = z - this.cushion.z;
    if (Math.abs(dx) < 0.01 && Math.abs(dz) < 0.01) return;
    this.cushion.set(x, 0, z);
    this.rugMesh?.position.set(x, 0.12, z + 2);
    this.cushionMesh?.position.set(x, CUSHION_H / 2, z);
    this.giftSpot.set(x - 17, 0, z + 17);
    if (this.giftBox) this.giftBox.outer.position.set(this.giftSpot.x, this.giftBox.outer.position.y, this.giftSpot.z);
    const av = this.avatar;
    if (av && (av.pose === "sit" || av.pose === "read" || av.pose === "sitwave")) {
      av.root.position.x += dx;
      av.root.position.z += dz;
      if (this.pet) this.pet.root.position.copy(this.petSpot());
    }
    if (this.guestCushion) {
      const gs = this.guestSpot();
      this.guestCushion.position.set(gs.x, (CUSHION_H - 1) / 2, gs.z);
      if (this.guest && this.guest.pose === "sit") this.guest.root.position.set(gs.x, 0, gs.z);
    }
    this.roomKey = "";
    this.goalKey = "";
  }

  /** 제자리로 미끄러지기 (순서가 바뀌었을 때) — 처음 그릴 땐 바로 */
  private slide(b: Book3D) {
    const to = new THREE.Vector3(b.slot.x, b.slot.y, b.slot.z);
    const from = b.group.position.clone();
    b.group.quaternion.identity();
    b.group.scale.setScalar(1);
    if (!this.active || this.instant || from.distanceTo(to) < 0.05) {
      b.home();
      return;
    }
    const id = ++this.moveSeq;
    this.moving.set(b.book.id, id);
    void this.tween(
      0.34,
      (p) => {
        if (this.moving.get(b.book.id) === id) b.group.position.lerpVectors(from, to, p);
      },
      ease.out,
    );
  }

  /** 화면 자리의 책 (얇은 책도 누르기 쉽게 6px 여유) */
  private bookAt(x: number, y: number, except?: string): string | null {
    let best: { id: string; d: number } | null = null;
    for (const r of this.spineRects(except)) {
      if (x < r.left - 6 || x > r.right + 6 || y < r.top - 4 || y > r.bottom + 4) continue;
      const d = Math.abs(x - (r.left + r.right) / 2);
      if (!best || d < best.d) best = { id: r.id, d };
    }
    return best?.id ?? null;
  }

  /** 책장에 꽂힌 책들의 책등 앞면 — 화면 사각형 */
  private spineRects(except?: string): SpineRect[] {
    const out: SpineRect[] = [];
    for (const b of this.books.values()) {
      if (b.out || b.book.id === except) continue;
      const pts = b.spineCorners().map((v) => this.toScreen(v));
      out.push({
        id: b.book.id,
        left: Math.min(...pts.map((p) => p.x)),
        right: Math.max(...pts.map((p) => p.x)),
        top: Math.min(...pts.map((p) => p.y)),
        bottom: Math.max(...pts.map((p) => p.y)),
      });
    }
    return out;
  }

  /** 손가락 자리 → 책장 앞 평면(z) 위의 점 */
  private pointOnPlane(clientX: number, clientY: number, z: number): THREE.Vector3 | null {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -z), new THREE.Vector3());
  }

  private startDrag(id: string, e: PointerEvent) {
    const b = this.books.get(id);
    if (!b) return;
    this.moving.delete(id);
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // 캡처가 안 되는 브라우저면 캔버스 밖으로 나가면 놓친다
    }
    b.group.rotation.z = 0;
    b.group.position.set(b.slot.x, b.slot.y + 1.5, b.slot.z + 6);
    const planeZ = b.group.position.z + b.slot.d / 2;
    const hit = this.pointOnPlane(e.clientX, e.clientY, planeZ) ?? b.group.position.clone();
    const r = this.canvas.getBoundingClientRect();
    const rects = this.spineRects(id);
    this.drag = {
      b,
      pointerId: e.pointerId,
      planeZ,
      off: new THREE.Vector2(b.group.position.x - hit.x, b.group.position.y - hit.y),
      rects,
      target: dropTarget(rects, e.clientX - r.left, e.clientY - r.top),
    };
    this.showInsertBar();
  }

  private moveDrag(e: PointerEvent) {
    const d = this.drag;
    if (!d) return;
    const hit = this.pointOnPlane(e.clientX, e.clientY, d.planeZ);
    if (hit) {
      d.b.group.position.x = hit.x + d.off.x;
      d.b.group.position.y = hit.y + d.off.y;
    }
    const r = this.canvas.getBoundingClientRect();
    d.target = dropTarget(d.rects, e.clientX - r.left, e.clientY - r.top);
    this.showInsertBar();
  }

  private endDrag() {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    if (this.insertBar) this.insertBar.visible = false;
    const ids = [...this.books.values()].sort((a, b) => a.slot.index - b.slot.index).map((b) => b.book.id);
    const next = moveTo(ids, d.b.book.id, d.target);
    if (next.join() !== ids.join()) this.events.reorder?.(next);
    this.slide(d.b); // 순서가 같으면 제자리로, 바뀌면 새 배치가 오기 전까지 지금 자리에서
  }

  private cancelDrag() {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    if (this.insertBar) this.insertBar.visible = false;
    this.slide(d.b);
  }

  /** 넣을 자리 표시 — 책 사이 세로 막대 (2D 책장의 주황 줄처럼) */
  private showInsertBar() {
    const d = this.drag;
    if (!d) return;
    const ref = d.target.before ?? d.target.after;
    const b = ref ? this.books.get(ref) : null;
    if (!b) {
      if (this.insertBar) this.insertBar.visible = false;
      return;
    }
    if (!this.insertBar) {
      const geo = new THREE.BoxGeometry(0.8, 1, 0.8);
      const mat = new THREE.MeshBasicMaterial({ color: PAL.coral });
      this.own.push(geo, mat);
      this.insertBar = new THREE.Mesh(geo, mat);
      this.scene.add(this.insertBar);
    }
    const h = Math.max(10, this.layout.rowH - 5);
    const x = d.target.before ? b.slot.x - b.slot.t / 2 - CASE.bookGap / 2 - 0.2 : b.slot.x + b.slot.t / 2 + CASE.bookGap / 2 + 0.2;
    this.insertBar.scale.y = h;
    this.insertBar.position.set(x, b.slot.y + h / 2, -SPINE_INSET + 0.6);
    this.insertBar.visible = true;
  }

  /** 책장 (책 수에 따라 줄·책장 수가 바뀔 때마다 다시) */
  private buildCase() {
    for (const d of this.caseOwn) d.dispose();
    this.caseOwn = [];
    this.caseRoot.clear();
    this.addMesh = null;
    // 책장 칠하기를 켜 두었으면 고른 색으로 (11-13 책장 꾸미기)
    const [sideColor, lightColor] = PAINT_COLOR[this.deco.placed.includes("paint") ? (this.deco.paint ?? "mint") : "wood"];
    const wood = this.toon(sideColor);
    const woodLight = this.toon(lightColor);
    const back = this.toon(PAL.back);
    this.caseOwn.push(wood, woodLight, back);
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
      const g = new THREE.BoxGeometry(w, h, d);
      const m = new THREE.Mesh(g, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      const eg = new THREE.EdgesGeometry(g);
      m.add(new THREE.LineSegments(eg, this.lineMat));
      this.caseOwn.push(g, eg);
      this.caseRoot.add(m);
      return m;
    };
    const D = CASE.depth;
    for (const u of this.layout.units) {
      const W = u.innerW;
      const S = CASE.side;
      const H = u.height;
      for (const s of [-1, 1]) box(S, H, D, u.x + s * (W / 2 + S / 2), H / 2, -D / 2, wood);
      box(W + S * 2 + 1.6, CASE.top, D + 1.4, u.x, H - CASE.top / 2, -D / 2 + 0.4, woodLight);
      box(W, CASE.plinth, D - 1.5, u.x, CASE.plinth / 2, -D / 2 - 0.75, wood);
      box(W, H - CASE.plinth - CASE.top, 1, u.x, CASE.plinth + (H - CASE.plinth - CASE.top) / 2, -D + 0.5, back);
      u.rowFloors.forEach((f) => box(W, CASE.board, D - 0.6, u.x, f - CASE.board / 2, -D / 2 + 0.3, woodLight));
      // 줄 끝 빈 자리에 행성 북엔드 (2D 책장과 같은 스티커)
      u.free.forEach((f, i) => {
        const room = f.x1 - f.x0;
        if (room < 9) return;
        const size = Math.min(14, room - 1.5, this.layout.rowH - 6);
        const name = BOOKENDS[(u.index * 3 + i) % BOOKENDS.length];
        const geo = new THREE.PlaneGeometry(size, size);
        const mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.35 });
        this.caseOwn.push(geo, mat);
        const m = new THREE.Mesh(geo, mat);
        m.position.set(f.x1 - size / 2 - 0.6, u.rowFloors[f.row] + size / 2, -SPINE_INSET - 5);
        this.caseRoot.add(m);
        loadTexture(`/img/${name}.webp`)
          .then((t) => {
            mat.map = t;
            mat.needsUpdate = true;
          })
          .catch(() => m.removeFromParent());
      });
    }
    const add = this.layout.add;
    if (add) {
      const tex = addSlotTexture();
      const geo = new THREE.PlaneGeometry(add.w, add.h);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
      this.caseOwn.push(tex, geo, mat);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(add.x, add.y + add.h / 2, -SPINE_INSET);
      this.caseRoot.add(m);
      this.addMesh = m;
    }
  }

  // ── 움직임 ──

  private enqueue(job: () => Promise<void>): Promise<void> {
    const run = this.chain.then(async () => {
      if (this.disposed) return;
      this.running++;
      try {
        await job();
      } finally {
        this.running--;
        if (!this.running) {
          this.timeScale = 1;
          const pb = this.pendingBooks;
          const pa = this.pendingAvatar;
          this.pendingBooks = null;
          this.pendingAvatar = null;
          if (pa) this.setAvatar(pa);
          if (pb) this.setBooks(pb.books, pb.marks);
          const pd = this.pendingDeco;
          this.pendingDeco = null;
          if (pd) this.setDeco(pd);
        }
      }
    });
    this.chain = run.catch(() => {});
    return run;
  }

  private tween(dur: number, fn: (p: number) => void, e: (t: number) => number = ease.inOut): Promise<void> {
    if (this.disposed || dur <= 0 || this.instant) {
      fn(1);
      return Promise.resolve();
    }
    return new Promise((done) => this.tweens.push({ t: 0, dur, fn, ease: e, done }));
  }

  private wait(dur: number) {
    return this.tween(dur, () => {});
  }

  private say(text: string) {
    this.events.say?.(text);
  }

  private setUnit(i: number) {
    const n = this.layout.units.length;
    const next = clamp(i, 0, n - 1);
    if (next === this.unit) return;
    this.unit = next;
    this.events.units?.(n, next);
  }

  private async turnTo(angle: number, dur: number, who: Avatar | null = this.avatar) {
    const av = who;
    if (!av) return;
    const start = av.root.rotation.y;
    const d = turnDelta(start, angle);
    if (Math.abs(d) < 0.01) return;
    await this.tween(dur, (p) => (av.root.rotation.y = start + d * p), ease.out);
  }

  private async walkTo(x: number, z: number, who: Avatar | null = this.avatar) {
    const av = who;
    if (!av) return;
    const from = av.root.position.clone();
    const dx = x - from.x;
    const dz = z - from.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.6) return;
    await this.turnTo(facing(dx, dz), 0.14, av);
    av.setPose(av === this.avatar && this.held ? "carry" : "stand");
    av.walking = true;
    await this.tween(
      walkTime(dist),
      (p) => {
        av.root.position.x = from.x + dx * p;
        av.root.position.z = from.z + dz * p;
      },
      ease.linear,
    );
    av.walking = false;
  }

  /** 포물선으로 폴짝 (방석 오르내리기). midPose 는 공중에서 바꾼다 */
  private async hop(to: THREE.Vector3, height: number, dur: number, midPose?: Pose, who: Avatar | null = this.avatar) {
    const av = who;
    if (!av) return;
    const from = av.root.position.clone();
    await this.tween(0.08, (p) => (av.squash = 0.1 * p));
    let switched = false;
    await this.tween(
      dur,
      (p) => {
        av.root.position.lerpVectors(from, to, p);
        av.root.position.y = from.y + (to.y - from.y) * p + height * 4 * p * (1 - p);
        av.squash = 0.1 * (1 - p) - 0.2 * Math.sin(p * Math.PI);
        if (midPose && !switched && p > 0.45) {
          av.setPose(midPose);
          switched = true;
        }
      },
      ease.linear,
    );
    if (midPose && !switched) av.setPose(midPose);
    await this.tween(0.13, (p) => (av.squash = 0.15 * Math.sin(p * Math.PI)));
    av.squash = 0;
  }

  private async hopInPlace(height: number) {
    const av = this.avatar;
    if (!av) return;
    await this.hop(av.root.position.clone(), height, 0.36);
  }

  /** 방석에서 앞으로 폴짝 내려와 선다 */
  private async getUp() {
    const av = this.avatar;
    if (!av || (av.pose !== "sit" && av.pose !== "read" && av.pose !== "sitwave")) return;
    av.setExpr("normal");
    await this.turnTo(0, 0.12);
    const to = av.root.position.clone().add(new THREE.Vector3(0, 0, 14));
    to.y = 0;
    await this.hop(to, 7, 0.32, this.held ? "carry" : "stand");
  }

  /** 방석 앞에서 뒤로 폴짝 올라가 앉는다 */
  private async sitDown(pose: "sit" | "read") {
    const av = this.avatar;
    if (!av) return;
    await this.turnTo(0, 0.14);
    await this.hop(new THREE.Vector3(this.cushion.x, 0, this.cushion.z), 8, 0.34, pose);
  }

  /** 그 책 앞까지 걸어가서 책장을 본다 (다른 책장이면 카메라도 따라간다) */
  private async goTo(b: Book3D) {
    this.setUnit(b.slot.unit);
    const u = this.layout.units[b.slot.unit];
    const x = clamp(b.slot.x, u.x - u.innerW / 2 + 4, u.x + u.innerW / 2 - 4);
    await this.walkTo(x, FRONT_Z);
    await this.turnTo(Math.PI, 0.16);
  }

  /** 높은 줄은 깡충 — 꼭대기에서 atTop 을 하고 내려온다 */
  private async jumpUp(height: number, atTop: () => Promise<void>) {
    const av = this.avatar;
    if (!av) return;
    const up = riseTime(height) + 0.06;
    await this.tween(0.09, (p) => (av.squash = 0.12 * p));
    await this.tween(
      up,
      (p) => {
        av.root.position.y = height * p;
        av.squash = 0.12 - 0.26 * p;
      },
      ease.out,
    );
    await atTop();
    await this.tween(
      up * 0.85,
      (p) => {
        av.root.position.y = height * (1 - p);
        av.squash = -0.14 * (1 - p);
      },
      ease.in,
    );
    av.root.position.y = 0;
    await this.tween(0.14, (p) => (av.squash = 0.16 * Math.sin(Math.PI * p)));
    av.squash = 0;
  }

  private grab(b: Book3D) {
    const av = this.avatar;
    if (!av) return;
    b.out = true;
    av.hold.attach(b.group);
    this.held = b;
  }

  /** 책장에서 빼내 손에 든다 */
  private async takeFromShelf(b: Book3D) {
    const av = this.avatar;
    if (!av) return;
    av.setPose("reach");
    const slide = async () => {
      const z0 = b.slot.z;
      await this.tween(0.22, (p) => (b.group.position.z = z0 + b.slot.d * 0.6 * p), ease.out);
      this.grab(b);
    };
    const h = jumpFor(b.slot);
    if (h > 0) await this.jumpUp(h, slide);
    else {
      await this.wait(0.16);
      await slide();
    }
    av.setPose("pull");
    await this.wait(0.14);
    av.setPose("carry");
    await this.holdBook(b, "carry", 0.22);
  }

  /** 들고 있던 책을 제자리에 꽂는다 (아바타는 그 책 앞에서 책장을 보고 있다) */
  private async putIntoShelf(b: Book3D) {
    const av = this.avatar;
    if (!av) return;
    av.setPose("reach");
    const insert = async () => {
      this.booksRoot.attach(b.group);
      const p0 = b.group.position.clone();
      const q0 = b.group.quaternion.clone();
      const s0 = b.group.scale.x;
      const front = b.pulledPosition();
      await this.tween(0.2, (p) => {
        b.group.position.lerpVectors(p0, front, p);
        b.group.quaternion.slerpQuaternions(q0, IDENTITY, p);
        b.group.scale.setScalar(s0 + (1 - s0) * p);
      });
      await this.tween(0.2, (p) => (b.group.position.z = front.z + (b.slot.z - front.z) * p));
      b.home();
      b.out = false;
      this.held = null;
    };
    const h = jumpFor(b.slot);
    if (h > 0) await this.jumpUp(h, insert);
    else {
      await this.wait(0.12);
      await insert();
    }
    av.setPose("stand");
  }

  private async returnHeld() {
    const b = this.held;
    const av = this.avatar;
    if (!b || !av) return;
    av.setExpr("normal");
    av.setPose("carry");
    await this.holdBook(b, "carry", 0.2);
    await this.goTo(b);
    await this.putIntoShelf(b);
    await this.turnTo(0, 0.18);
  }

  /** 손에 든 책 자리 — 앞표지(+x 면)가 아바타 앞을 보게 돌린다 */
  private holdBook(b: Book3D, kind: HoldKind, dur: number): Promise<void> {
    const k = kind === "read" ? 0.74 : 0.8;
    const rx = kind === "read" ? 0.2 : kind === "show" ? 0.04 : 0.05;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, -Math.PI / 2, 0, "XYZ"));
    const center = kind === "carry" ? new THREE.Vector3(0, 0.4, 0.6) : kind === "read" ? new THREE.Vector3(0, -0.8, 2.4) : new THREE.Vector3(0, 8.2, 2.6);
    const lift = new THREE.Vector3(0, (b.slot.h / 2) * k, 0).applyQuaternion(q);
    const pos = center.sub(lift);
    const p0 = b.group.position.clone();
    const q0 = b.group.quaternion.clone();
    const s0 = b.group.scale.x;
    return this.tween(dur, (p) => {
      b.group.position.lerpVectors(p0, pos, p);
      b.group.quaternion.slerpQuaternions(q0, q, p);
      b.group.scale.setScalar(s0 + (k - s0) * p);
    });
  }

  /** 별이 퐁퐁 (다 읽었을 때·선물 열 때) */
  private burstAt(head: THREE.Vector3) {
    if (this.instant) return;
    for (let i = 0; i < 7; i++) {
      const mat = new THREE.SpriteMaterial({ map: i % 2 ? this.shared.sparkle : this.shared.star, depthWrite: false, transparent: true });
      const s = new THREE.Sprite(mat);
      s.scale.setScalar(4);
      const a = (i / 7) * Math.PI * 2;
      const vel = new THREE.Vector3(Math.cos(a) * 26, 30 + (i % 3) * 8, Math.sin(a) * 12 + 10);
      this.fxRoot.add(s);
      this.fx.push({ obj: s, t: 0, dur: 1.1, from: head.clone().add(new THREE.Vector3(0, -6, 0)), vel, spin: (i % 2 ? 1 : -1) * 3 });
    }
  }

  // ── 매 프레임 ──

  private tick = (now: number) => {
    const raw = this.last ? Math.min(0.05, Math.max(0, (now - this.last) / 1000)) : 1 / 60;
    this.last = now;
    const dt = raw * this.timeScale;
    this.time += raw;

    const list = this.tweens;
    this.tweens = [];
    const keep: Tween[] = [];
    for (const tw of list) {
      tw.t += dt;
      const p = Math.min(1, tw.t / tw.dur);
      tw.fn(tw.ease(p));
      if (p >= 1) tw.done();
      else keep.push(tw);
    }
    this.tweens = keep.concat(this.tweens);

    this.avatar?.update(dt);
    this.guest?.update(dt);
    this.stepPet(dt);
    for (const b of this.books.values()) b.twinkle(this.time);
    for (const it of this.room.values()) it.tick?.(this.time);
    if (this.editing) {
      let i = 0;
      for (const b of this.books.values()) {
        i++;
        if (this.drag?.b !== b && !b.out) b.group.rotation.z = Math.sin(this.time * 13 + i * 1.7) * 0.022;
      }
    }
    if (this.arranging) {
      // 옮길 수 있는 물건이 살랑살랑 (책 정리 때 책이 들썩이듯)
      let i = 0;
      for (const [id, it] of this.room) {
        if (!canMove(id)) continue;
        i++;
        if (this.itemDrag?.id === id) continue;
        it.obj.rotation.z = (this.roomHome.get(id)?.rotZ ?? 0) + Math.sin(this.time * 9 + i * 1.9) * 0.04;
      }
    }
    if (this.giftBox && !this.opening) {
      this.giftBox.inner.position.y = Math.abs(Math.sin(this.time * 3)) * 1.4;
      this.giftBox.inner.rotation.y = Math.sin(this.time * 1.6) * 0.18;
    }
    this.stepFx(dt);
    this.stepOpenBook(dt);

    this.computeGoal();
    const k = this.snap ? 1 : 1 - Math.exp(-4.2 * raw);
    this.snap = false;
    this.view.pos.lerp(this.goal.pos, k);
    this.view.look.lerp(this.goal.look, k);
    this.camera.position.copy(this.view.pos);
    this.camera.lookAt(this.view.look);
    this.sun.target.position.copy(this.view.look);
    this.sun.position.copy(this.view.look).add(this.tmp.set(-70, 150, 110));
    this.renderer.render(this.scene, this.camera);
    this.emitFrame();
  };

  private renderOnce() {
    this.computeGoal();
    this.view.pos.copy(this.goal.pos);
    this.view.look.copy(this.goal.look);
    this.camera.position.copy(this.view.pos);
    this.camera.lookAt(this.view.look);
    this.avatar?.update(0);
    this.renderer.render(this.scene, this.camera);
    this.emitFrame();
  }

  private stepFx(dt: number) {
    if (!this.fx.length) return;
    this.fx = this.fx.filter((f) => {
      f.t += dt;
      const p = f.t / f.dur;
      if (p >= 1) {
        f.obj.removeFromParent();
        f.obj.material.dispose();
        return false;
      }
      f.obj.position.copy(f.from).addScaledVector(f.vel, f.t).add(this.tmp.set(0, -40 * f.t * f.t, 0));
      f.obj.material.opacity = 1 - p * p;
      f.obj.material.rotation += f.spin * dt;
      return true;
    });
  }

  private emitFrame() {
    const av = this.avatar;
    if (!av || !this.events.frame) return;
    const p = av.tagAnchor.getWorldPosition(this.tmp).project(this.camera);
    const x = ((p.x + 1) / 2) * this.w;
    const y = ((1 - p.y) / 2) * this.h;
    const tag = { x, y, visible: av.root.visible && p.z < 1 && x > -40 && x < this.w + 40 && y > -20 && y < this.h + 20 };
    let gift: { x: number; y: number } | null = null;
    if (this.giftBox && !this.opening && this.giftBox.outer.visible) {
      const q = this.tmp.copy(this.giftSpot).add(new THREE.Vector3(0, 14, 0)).project(this.camera);
      gift = { x: ((q.x + 1) / 2) * this.w, y: ((1 - q.y) / 2) * this.h };
    }
    let guest: { x: number; y: number; visible: boolean } | null = null;
    if (this.guest) {
      const q = this.guest.tagAnchor.getWorldPosition(new THREE.Vector3()).project(this.camera);
      const gx = ((q.x + 1) / 2) * this.w;
      const gy = ((1 - q.y) / 2) * this.h;
      guest = { x: gx, y: gy, visible: this.guest.root.visible && q.z < 1 && gx > -40 && gx < this.w + 40 && gy > -20 && gy < this.h + 20 };
    }
    this.events.frame(tag, gift, guest);
  }

  // ── 카메라 ──

  /** 목표 카메라 — 보여야 할 점들이 화면 칸(NDC) 안에 꽉 차게. 바뀔 때만 다시 잰다 */
  private goalKey = "";
  private computeGoal() {
    const u: UnitLayout = this.layout.units[this.unit] ?? this.layout.units[0];
    const key = `${this.guest ? "g" : ""}|${this.pet?.kind ?? "none"}|${this.mode}|${this.focus}|${this.readingView}|${this.shelfView}|${this.editing}|${this.arranging}|${this.standing}|${u.innerW}|${this.cushion.x}|${this.unit}|${this.w}x${this.h}|${u.x},${u.height}|${[...this.room.keys()].join()}|${this.giftBox ? 1 : 0}|${this.insets.top},${this.insets.bottom},${this.insets.left}|${this.house}|${this.readingSheet}|${this.userCam.yaw.toFixed(3)},${this.userCam.tilt.toFixed(3)},${this.userCam.zoom.toFixed(3)}`;
    if (key === this.goalKey) return;
    this.goalKey = key;
    const c = this.cushion;
    const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => {
      const out: THREE.Vector3[] = [];
      for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) out.push(new THREE.Vector3(x, y, z));
      return out;
    };
    const seated = box(c.x - 15, c.x + 15, 0, 41, c.z - 13, c.z + 13); // 방석에 앉은 아바타 + 들고 있는 책
    const seatedTall = box(c.x - 17, c.x + 17, 0, 50, c.z - 14, c.z + 14); // 머리 위 똥머리·이름표까지
    let pts: THREE.Vector3[];
    let rect: [number, number, number, number]; // 화면 칸 [왼, 오, 아래, 위] (-1 ~ 1)
    let tilt: number;
    let yaw: number;
    if (this.mode === "preview" && this.standing) {
      // 꾸미기 창 — 서 있는 아바타 (머리 가운데 ≈ 25.8cm · 눈 ≈ 24.8 · 코 ≈ 23.9 · 입 ≈ 22.8, 얼굴 앞 z ≈ 9)
      // 11-13 사용자: "부위별로 확대 확대 되면서 고르게" → 탭마다 그 부위로 다가간다 (좁고 긴 칸이라 폭에 맞춰 — 좁게 잡을수록 크게)
      const zoom: Partial<Record<typeof this.focus, { x: number; y0: number; y1: number; rect: [number, number, number, number] }>> = {
        hair: { x: 10.6, y0: 17, y1: 42, rect: [-1, 1, -0.25, 0.8] }, // 머리 전체 (똥머리·모자까지) — 비스듬히(뒷머리가 보이게)
        face: { x: 9.4, y0: 17.5, y1: 35, rect: [-1, 1, -0.15, 0.66] }, // 얼굴 가득
        eyes: { x: 6.8, y0: 23.2, y1: 26.4, rect: [-1, 1, 0.08, 0.42] }, // 두 눈만 (얼굴 양옆은 잘린다)
        mouth: { x: 5, y0: 21.2, y1: 25, rect: [-1, 1, 0.02, 0.4] }, // 코·입
      };
      const z = zoom[this.focus];
      if (z) {
        pts = box(c.x - z.x, c.x + z.x, z.y0, z.y1, c.z + 2, c.z + 9.5);
        rect = z.rect;
        tilt = 0.04;
        yaw = this.focus === "hair" ? 0.5 : 0; // 머리는 비스듬히 — 포니테일·땋은 머리·긴 머리가 보이게
      } else {
        pts = box(c.x - 10.5, c.x + 10.5, 0, 41, c.z - 5, c.z + 7);
        if (this.pet && this.focus === "pet") pts.push(...box(c.x + 10, c.x + 24, 0, 16, c.z + 2, c.z + 16));
        rect = [-0.9, 0.9, -0.94, 0.86];
        tilt = 0.12;
        yaw = 0.1;
      }
    } else if (this.mode === "preview" && this.focus === "face") {
      // 얼굴 꾸미기 — 머리만 크게 (앉은 아바타 머리 가운데 ≈ 27cm)
      pts = box(c.x - 12.5, c.x + 12.5, 15.5, 40, c.z - 4, c.z + 11);
      rect = [-0.8, 0.8, -0.86, 0.8];
      tilt = 0.06;
      yaw = 0;
    } else if (this.mode === "preview") {
      pts = this.pet ? [...seatedTall, ...box(c.x + 10, c.x + 24, 0, 16, c.z + 2, c.z + 16)] : seatedTall;
      rect = [-0.86, 0.86, -0.9, 0.84];
      tilt = 0.2;
      yaw = 0.18;
    } else if (this.readingView && this.readingSheet) {
      pts = seatedTall;
      rect = [-0.78, 0.78, 0.02, 0.8]; // 아래쪽은 '몇 쪽까지' 창이 덮는다
      tilt = 0.14;
      yaw = 0.1;
    } else if (this.readingView) {
      // 펼친 책을 들고 읽는 모습 — 위에는 타이머, 아래에는 작은 '책 덮기' 줄
      pts = seatedTall;
      rect = [-0.84, 0.84, -0.6, 0.5];
      tilt = 0.3;
      yaw = 0.08;
    } else if (this.arranging) {
      // 물건 자리 — 물건을 놓을 수 있는 바닥·벽이 다 보이게 (집 구도 그대로, 조금 멀리서)
      const f = this.roomFrame();
      pts = [
        ...box(f.floor.x0, f.floor.x1, 0, 2, f.floor.y0, f.floor.y1),
        new THREE.Vector3(f.wall.x0, f.wall.y1, f.floor.y0),
        new THREE.Vector3(f.wall.x1, f.wall.y1, f.floor.y0),
      ];
      rect = [-0.96, 0.96, -0.95, 0.74];
      tilt = HOUSE_CAM[this.house].tilt;
      yaw = HOUSE_CAM[this.house].yaw;
    } else if (this.shelfView || this.editing) {
      // 책장만 화면 가득 — 책등을 자세히 보고 고른다 (11-12 사용자: "책장을 크게, 책을 자세히 고르게")
      const half = u.innerW / 2 + 1.5;
      pts = box(u.x - half, u.x + half, u.rowFloors[u.rows - 1] - 2.5, u.rowFloors[0] + this.layout.rowH + 1, -3, 1);
      rect = [-0.97, 0.97, -0.9, 0.7];
      tilt = 0.08;
      yaw = 0;
    } else {
      const half = u.width / 2;
      pts = [...box(u.x - half, u.x + half, 0, u.height, -CASE.depth, 0)];
      if (this.unit === 0) {
        pts.push(...seated, new THREE.Vector3(c.x, 0, c.z + 18));
        if (this.pet) pts.push(this.petSpot().add(new THREE.Vector3(6, 14, 6)));
        if (this.guest) {
          const gs = this.guestSpot();
          pts.push(gs.clone().add(new THREE.Vector3(-13, 40, -10)), gs.clone().add(new THREE.Vector3(-13, 0, 14)));
        }
        // 책장 위·옆 물건만 (벽 위 창문·액자는 조금 잘려도 책장이 크게 보이는 게 먼저)
        for (const [id, it] of this.room) if (id !== "window" && id !== "frame" && id !== "lights") pts.push(...it.focus);
        if (this.giftBox) pts.push(this.giftSpot.clone().add(new THREE.Vector3(-6, 0, 6)), this.giftSpot.clone().add(new THREE.Vector3(6, 18, 6)));
        if (this.shell && !this.shelfView && !this.editing) pts.push(...this.shell.focus); // 집마다 꼭 보여야 할 창·천장
      }
      else pts.push(new THREE.Vector3(u.x, 0, 30));
      rect = [-0.96, 0.96, -0.95, 0.74]; // 위쪽은 이름판 자리
      const cam = this.unit === 0 ? HOUSE_CAM[this.house] : HOUSE_CAM.grid; // 옆 책장(둘째부터)은 정면으로
      tilt = cam.tilt;
      yaw = cam.yaw;
    }
    // 손으로 돌리고 당긴 만큼 (방 보기 · 물건 자리에서만)
    const roomView = this.mode !== "preview" && !this.readingView && !this.shelfView && !this.editing;
    const uc = roomView ? this.userCam : { yaw: 0, tilt: 0, zoom: 1 };
    tilt = clamp(tilt + uc.tilt, 0.06, 1.15);
    yaw += uc.yaw;
    if (this.mode !== "preview" && !this.readingView) {
      const { top, bottom, left } = this.insets;
      rect = [Math.max(rect[0], -1 + (2 * left) / this.w), rect[1], Math.max(rect[2], -1 + (2 * bottom) / this.h), Math.min(rect[3], 1 - (2 * top) / this.h)];
    }
    this.fit(pts, rect, tilt, yaw, uc.zoom);
  }

  /** 점들이 rect 안에 들어오게 — 바라보는 점과 거리를 몇 번 고쳐 맞춘다 */
  private fit(pts: THREE.Vector3[], rect: [number, number, number, number], tilt: number, yaw: number, zoom = 1) {
    const cam = new THREE.PerspectiveCamera(FOV, this.w / this.h, 1, 6000);
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt));
    const look = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    const tanV = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const [rl, rr, rb, rt] = rect;
    let dist = 300;
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const q = new THREE.Vector3();
    for (let it = 0; it < 6; it++) {
      cam.position.copy(look).addScaledVector(dir, dist);
      cam.lookAt(look);
      cam.updateMatrixWorld();
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const p of pts) {
        q.copy(p).project(cam);
        x0 = Math.min(x0, q.x);
        x1 = Math.max(x1, q.x);
        y0 = Math.min(y0, q.y);
        y1 = Math.max(y1, q.y);
      }
      // 가운데 맞추기 (rect 가운데로)
      const halfH = dist * tanV;
      const halfW = halfH * cam.aspect;
      right.setFromMatrixColumn(cam.matrixWorld, 0);
      up.setFromMatrixColumn(cam.matrixWorld, 1);
      look.addScaledVector(right, ((x0 + x1) / 2 - (rl + rr) / 2) * halfW);
      look.addScaledVector(up, ((y0 + y1) / 2 - (rb + rt) / 2) * halfH);
      // 크기 맞추기
      const k = Math.max((x1 - x0) / (rr - rl), (y1 - y0) / (rt - rb));
      dist *= k;
    }
    this.goal.look.copy(look);
    this.goal.pos.copy(look).addScaledVector(dir, dist * zoom);
  }

  // ── 누르기 ──

  private onDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY, id: e.pointerId };
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2 && this.camAdjustable()) {
      // 두 손가락 — 가까이/멀리 시작 (끌던 건 멈춘다)
      const [a, b] = [...this.pointers.values()];
      this.pinch = { dist: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), zoom: this.userCam.zoom };
      this.orbit = null;
      return;
    }
    if (this.arranging) {
      if (!this.running && !this.itemDrag) {
        const r = this.canvas.getBoundingClientRect();
        const id = this.itemAt(e.clientX - r.left, e.clientY - r.top);
        if (id) {
          e.preventDefault();
          this.startItemDrag(id, e);
        }
      }
      if (!this.itemDrag && this.camAdjustable()) this.orbit = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: this.userCam.yaw, tilt: this.userCam.tilt, on: false };
      return;
    }
    if (this.editing && !this.running && !this.drag) {
      const r = this.canvas.getBoundingClientRect();
      const id = this.bookAt(e.clientX - r.left, e.clientY - r.top);
      if (id) {
        e.preventDefault();
        this.startDrag(id, e);
      }
    }
    if (!this.drag && !this.itemDrag && this.camAdjustable()) this.orbit = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: this.userCam.yaw, tilt: this.userCam.tilt, on: false };
  };

  private onMove = (e: PointerEvent) => {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.itemDrag && e.pointerId === this.itemDrag.pointerId) {
      this.moveItemDrag(e);
      return;
    }
    if (this.drag && e.pointerId === this.drag.pointerId) {
      this.moveDrag(e);
      return;
    }
    // 두 손가락 — 가까이/멀리
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist > 10) this.setUserZoom((this.pinch.zoom * this.pinch.dist) / dist);
      return;
    }
    // 한 손가락 끌기 — 살짝 돌리기 (옆 책장이 여럿이면 옆으로 미는 건 책장 넘기기라 위아래만)
    const o = this.orbit;
    if (!o || o.id !== e.pointerId || !this.camAdjustable()) return;
    const dx = e.clientX - o.x;
    const dy = e.clientY - o.y;
    if (!o.on && Math.hypot(dx, dy) < 9) return;
    const sideSwipe = this.layout.units.length > 1 && Math.abs(dx) > Math.abs(dy);
    if (!o.on && sideSwipe) return;
    o.on = true;
    this.userCam.yaw = clamp(o.yaw - (this.layout.units.length > 1 ? 0 : dx * 0.0042), -0.75, 0.75);
    this.userCam.tilt = clamp(o.tilt + dy * 0.0032, -0.32, 0.38);
    this.goalKey = "";
    this.camNote();
  };

  /** 화면 가득한 무대(홈·친구 집)에서만 휠로 가까이/멀리 — 꾸미기·상점처럼 화면이 내려가는 곳에선 휠은 화면 내리기 (11-13 사용자: 상점에서 아래로 안 내려감) */
  wheelZoom = false;

  /** 마우스 휠 — 가까이/멀리 */
  private onWheel = (e: WheelEvent) => {
    if (!this.wheelZoom || !this.camAdjustable()) return;
    e.preventDefault();
    this.setUserZoom(this.userCam.zoom * Math.exp(e.deltaY * 0.0012));
  };

  /** 방 보기에서만 손으로 카메라를 만진다 (읽는 중·크게 보기·책 정리·미리보기는 그대로) */
  private camAdjustable(): boolean {
    return this.mode !== "preview" && !this.readingView && !this.shelfView && !this.editing && !this.itemDrag && !this.drag;
  }

  private setUserZoom(z: number) {
    this.userCam.zoom = clamp(z, 0.62, 1.7);
    this.goalKey = "";
    this.camNote();
  }

  /** 확대·축소 버튼 (휴대폰엔 휠이 없어서) — +1 이면 다가가고 −1 이면 물러난다 */
  zoomStep(dir: 1 | -1) {
    if (!this.camAdjustable()) return;
    this.setUserZoom(this.userCam.zoom * (dir > 0 ? 0.8 : 1.25));
  }

  /** 카메라를 처음 구도로 */
  resetCamera() {
    this.userCam = { yaw: 0, tilt: 0, zoom: 1 };
    this.goalKey = "";
    this.camNote();
  }

  private camWasMoved = false;
  /** 손으로 옮겼는지 바뀌었을 때만 알린다 (제자리 버튼을 보이고 숨기기) */
  private camNote() {
    const u = this.userCam;
    const moved = Math.abs(u.zoom - 1) > 0.02 || Math.abs(u.yaw) > 0.02 || Math.abs(u.tilt) > 0.02;
    if (moved === this.camWasMoved) return;
    this.camWasMoved = moved;
    this.events.cam?.(moved);
  }

  private onCancel = (e?: PointerEvent) => {
    this.down = null;
    if (e) this.pointers.delete(e.pointerId);
    this.pinch = null;
    this.orbit = null;
    this.cancelDrag();
    this.cancelItemDrag();
  };

  private onUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    this.pointers.delete(e.pointerId);
    if (this.pinch) {
      if (this.pointers.size < 2) this.pinch = null;
      this.orbit = null;
      return; // 두 손가락으로 당긴 건 누르기가 아니다
    }
    const orbited = this.orbit?.on && this.orbit.id === e.pointerId;
    this.orbit = null;
    if (this.itemDrag && e.pointerId === this.itemDrag.pointerId) {
      this.endItemDrag();
      return;
    }
    if (this.drag && e.pointerId === this.drag.pointerId) {
      this.endDrag();
      return;
    }
    if (orbited) return; // 끌어서 돌린 건 누르기가 아니다
    if (this.editing || this.arranging) return;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    const n = this.layout.units.length;
    if (n > 1 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5 && !this.running && !this.readingView) {
      this.setUnit(this.unit + (dx < 0 ? 1 : -1));
      return;
    }
    if (Math.hypot(dx, dy) > 10) return;
    const r = this.canvas.getBoundingClientRect();
    this.tap(e.clientX - r.left, e.clientY - r.top);
  };

  private toScreen(v: THREE.Vector3): { x: number; y: number } {
    const p = this.tmp.copy(v).project(this.camera);
    return { x: ((p.x + 1) / 2) * this.w, y: ((1 - p.y) / 2) * this.h };
  }

  private tap(x: number, y: number) {
    if (this.running) {
      this.hurry();
      return;
    }
    if (this.readingView) return;
    // 두 번 누르기 — 물건이면 그 물건 옮기기(홈), 빈 곳이면 카메라 처음대로
    const now = performance.now();
    const lt = this.lastTap;
    this.lastTap = { x, y, t: now };
    if (lt && now - lt.t < 340 && Math.hypot(x - lt.x, y - lt.y) < 34) {
      this.lastTap = null;
      const item = this.mode === "home" ? this.itemAt(x, y) : null;
      if (item) {
        this.events.itemDoubleTap?.(item);
        return;
      }
      if (!this.bookAt(x, y)) {
        this.resetCamera();
        return;
      }
    }
    // 선물 상자
    if (this.giftBox && this.mode === "home") {
      const gc = this.giftSpot.clone().add(new THREE.Vector3(0, 5, 0));
      const sc = this.toScreen(gc);
      const sx = sc.x;
      const sy = sc.y;
      const edge = this.toScreen(gc.clone().add(new THREE.Vector3(8, 0, 0)));
      if (Math.hypot(x - sx, y - sy) < Math.abs(edge.x - sx) * 1.4) {
        this.events.gift?.();
        return;
      }
    }
    // 아바타
    const av = this.avatar;
    if (av) {
      const c = av.center();
      const sc = this.toScreen(c);
      const edge = this.toScreen(c.clone().add(new THREE.Vector3(av.hitRadius, 0, 0)));
      const rad = Math.abs(edge.x - sc.x);
      if (Math.hypot(x - sc.x, y - sc.y) < rad) {
        this.events.avatarTap?.();
        if (this.mode !== "visit" || !this.held) void this.greet();
        return;
      }
    }
    if (this.mode === "preview") return;
    // 책 — 책등 앞면을 화면에 비춰 가장 가까운 것 (얇은 책도 누르기 쉽게 6px 여유)
    const hit = this.bookAt(x, y);
    if (hit) {
      this.events.pick?.(hit);
      return;
    }
    if (this.addMesh) {
      const a = this.layout.add;
      if (a) {
        const p0 = this.toScreen(new THREE.Vector3(a.x - a.w / 2, a.y, -SPINE_INSET));
        const p1 = this.toScreen(new THREE.Vector3(a.x + a.w / 2, a.y + a.h, -SPINE_INSET));
        if (x > Math.min(p0.x, p1.x) - 6 && x < Math.max(p0.x, p1.x) + 6 && y > Math.min(p0.y, p1.y) - 4 && y < Math.max(p0.y, p1.y) + 4) this.events.add?.();
      }
    }
  }
}

function pick<T>(xs: T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}
