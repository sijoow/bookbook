// 입체 책 한 권 — 상자 여섯 면: 앞(+z) 책등 · 오른쪽(+x) 앞표지 · 왼쪽 뒤표지 · 위아래·앞마구리 종이.
// 책등·표지는 YES24 응답 URL 그대로 (없으면 2D 책장처럼 파스텔 + 세로 제목). 표지는 꺼낼 때만 불러온다.
// 읽는 중 = 위로 튀어나온 책갈피, 다 읽음 = 별 스티커, 친구와 같은 책 = 반짝이.

import * as THREE from "three";
import type { LibraryBook } from "@/lib/books/types";
import type { Slot } from "@/lib/library3d/layout";
import { PAL, PASTELS, fakeCoverTexture, fakeSpineTexture, loadTexture } from "./textures";

export type BookShared = {
  pages: THREE.Texture;
  star: THREE.Texture;
  sparkle: THREE.Texture;
  font: string;
};

function hash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h;
}

export class Book3D {
  readonly group = new THREE.Group(); // 원점 = 책 아래 가운데
  readonly mesh: THREE.Mesh;
  out = false; // 책장에서 나와 있다 (아바타 손에)
  private mats: THREE.MeshLambertMaterial[];
  private own: Array<{ dispose(): void }> = [];
  private ribbon: THREE.Mesh | null = null;
  private star: THREE.Sprite | null = null;
  private spark: THREE.Sprite | null = null;
  private coverAsked = false;
  private spineUrl: string | null = null;
  private tint: string;

  /** 앞표지 재료 (꺼낼 때 YES24 표지를 불러온다) — 펼친 책 바깥에 같이 쓴다. 이 책이 치운다 */
  get coverMaterial(): THREE.Material {
    return this.mats[0];
  }

  /** 책 바탕색 (표지 그림이 없을 때·펼친 책 표지) */
  get color(): string {
    return this.tint;
  }

  constructor(
    public book: LibraryBook,
    public slot: Slot,
    private shared: BookShared,
  ) {
    this.tint = PASTELS[hash(book.id) % PASTELS.length];
    const page = () => new THREE.MeshLambertMaterial({ map: shared.pages });
    this.mats = [
      new THREE.MeshLambertMaterial({ color: this.tint }), // +x 앞표지 (꺼낼 때 불러옴)
      new THREE.MeshLambertMaterial({ color: this.tint }), // -x 뒤표지
      page(),
      page(),
      new THREE.MeshLambertMaterial({ color: this.tint }), // +z 책등
      page(),
    ];
    this.own.push(...this.mats);
    const geo = new THREE.BoxGeometry(slot.t, slot.h, slot.d);
    this.own.push(geo);
    this.mesh = new THREE.Mesh(geo, this.mats);
    this.mesh.position.y = slot.h / 2;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
    this.group.userData.bookId = book.id;
    this.loadSpine();
    this.setStatus(book.status);
    this.home();
  }

  /** 책장 제자리로 (애니메이션 없이) */
  home() {
    this.group.position.set(this.slot.x, this.slot.y, this.slot.z);
    this.group.quaternion.identity();
    this.group.scale.setScalar(1);
  }

  /** 책장에서 반쯤 빼낸 자리 */
  pulledPosition(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(this.slot.x, this.slot.y, this.slot.z + this.slot.d * 0.6);
  }

  /** 같은 책인데 정보가 바뀌었을 때 (상태·책등) */
  update(book: LibraryBook, slot: Slot) {
    const sizeChanged = slot.t !== this.slot.t || slot.h !== this.slot.h || slot.d !== this.slot.d;
    this.book = book;
    this.slot = slot;
    if (sizeChanged) {
      const geo = new THREE.BoxGeometry(slot.t, slot.h, slot.d);
      this.own.push(geo);
      this.mesh.geometry = geo;
      this.mesh.position.y = slot.h / 2;
      this.placeMarks();
    }
    if (book.sideCoverUrl !== this.spineUrl) this.loadSpine();
    this.setStatus(book.status);
  }

  private loadSpine() {
    const url = this.book.sideCoverUrl;
    this.spineUrl = url;
    const m = this.mats[4];
    const fake = () => {
      const t = fakeSpineTexture(this.book.title, this.tint, this.shared.font);
      this.own.push(t);
      m.map = t;
      m.color.set("#ffffff");
      m.needsUpdate = true;
    };
    if (!url) return fake();
    loadTexture(url)
      .then((t) => {
        if (this.spineUrl !== url) return;
        m.map = t;
        m.color.set("#ffffff");
        m.needsUpdate = true;
      })
      .catch(fake);
  }

  /** 앞표지 — 꺼낼 때 한 번 */
  ensureCover() {
    if (this.coverAsked) return;
    this.coverAsked = true;
    const m = this.mats[0];
    const fake = () => {
      const t = fakeCoverTexture(this.book.title, this.tint, this.shared.font);
      this.own.push(t);
      m.map = t;
      m.color.set("#ffffff");
      m.needsUpdate = true;
    };
    if (!this.book.coverUrl) return fake();
    loadTexture(this.book.coverUrl)
      .then((t) => {
        m.map = t;
        m.color.set("#ffffff");
        m.needsUpdate = true;
      })
      .catch(fake);
  }

  setStatus(status: LibraryBook["status"]) {
    const reading = status === "reading";
    const read = status === "read";
    if (reading && !this.ribbon) {
      const geo = new THREE.BoxGeometry(0.75, 6.5, 0.14);
      const mat = new THREE.MeshLambertMaterial({ color: PAL.coral });
      this.own.push(geo, mat);
      this.ribbon = new THREE.Mesh(geo, mat);
      this.group.add(this.ribbon);
    }
    if (this.ribbon) this.ribbon.visible = reading;
    if (read && !this.star) {
      const mat = new THREE.SpriteMaterial({ map: this.shared.star, depthWrite: false });
      this.own.push(mat);
      this.star = new THREE.Sprite(mat);
      this.star.renderOrder = 3;
      this.group.add(this.star);
    }
    if (this.star) this.star.visible = read;
    this.placeMarks();
  }

  setMarked(on: boolean) {
    if (on && !this.spark) {
      const mat = new THREE.SpriteMaterial({ map: this.shared.sparkle, depthWrite: false });
      this.own.push(mat);
      this.spark = new THREE.Sprite(mat);
      this.spark.renderOrder = 3;
      this.group.add(this.spark);
      this.placeMarks();
    }
    if (this.spark) this.spark.visible = on;
  }

  private placeMarks() {
    const { t, h, d } = this.slot;
    this.ribbon?.position.set(t * 0.18, h + 1.4, d / 2 - 1.3);
    if (this.star) {
      const s = Math.min(3.4, Math.max(2.2, t + 0.6));
      this.star.scale.set(s, s, 1);
      this.star.position.set(0, 3.1, d / 2 + 0.6);
    }
    if (this.spark) {
      this.spark.scale.set(3.8, 3.8, 1);
      this.spark.position.set(0, h + 3.6, d / 2);
    }
  }

  /** 반짝이 깜빡 (매 프레임) */
  twinkle(time: number) {
    if (!this.spark?.visible) return;
    const k = 0.82 + 0.2 * Math.sin(time * 3 + (hash(this.book.id) % 7));
    this.spark.scale.set(3.8 * k, 3.8 * k, 1);
    this.spark.material.rotation = Math.sin(time * 1.4) * 0.25;
  }

  /** 책등 앞면 네 귀퉁이 (화면 좌표로 바꿔 누르기 판정) */
  spineCorners(): THREE.Vector3[] {
    const { x, y, z, t, h, d } = this.slot;
    const zf = z + d / 2;
    return [new THREE.Vector3(x - t / 2, y, zf), new THREE.Vector3(x + t / 2, y, zf), new THREE.Vector3(x - t / 2, y + h, zf), new THREE.Vector3(x + t / 2, y + h, zf)];
  }

  dispose() {
    this.group.removeFromParent();
    for (const d of this.own) d.dispose();
    this.own = [];
  }
}
