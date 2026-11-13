// 만화풍 재료 꾸러미 — 3단 명암(MeshToonMaterial) + 갈색 펜 테두리(조금 크게 뒤집은 껍데기). 만든 것은 dispose 로 한 번에 치운다.

import * as THREE from "three";
import { PAL } from "./textures";

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

export class Kit {
  private trash: Array<{ dispose(): void }> = [];
  private outlines = new Map<number, THREE.ShaderMaterial>();

  constructor(private gradient: THREE.Texture) {}

  toon(color: string, opts: { side?: THREE.Side; emissive?: string; emissiveIntensity?: number } = {}): THREE.MeshToonMaterial {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: this.gradient, side: opts.side ?? THREE.FrontSide });
    if (opts.emissive) {
      m.emissive.set(opts.emissive);
      m.emissiveIntensity = opts.emissiveIntensity ?? 1;
    }
    this.trash.push(m);
    return m;
  }

  basic(params: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial {
    const m = new THREE.MeshBasicMaterial(params);
    this.trash.push(m);
    return m;
  }

  outline(thickness: number): THREE.ShaderMaterial {
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

  /** 겉면 + 테두리 (line 0 이면 테두리 없음) */
  part(geo: THREE.BufferGeometry, mat: THREE.Material, line = 0.35, shadow = true): THREE.Mesh {
    this.trash.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow;
    m.receiveShadow = shadow;
    if (line > 0) {
      const o = new THREE.Mesh(geo, this.outline(line));
      o.raycast = () => {};
      m.add(o);
    }
    return m;
  }

  keep<T extends { dispose(): void }>(x: T): T {
    this.trash.push(x);
    return x;
  }

  dispose() {
    for (const d of this.trash) d.dispose();
    this.trash = [];
    this.outlines.clear();
  }
}
