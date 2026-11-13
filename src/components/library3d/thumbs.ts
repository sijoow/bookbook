// 꾸미기 그림 칸 — 아바타를 작은 화면에 따로 그려 사진(data URL)으로. 머리 모양 · 추천 모습 · 안경 · 몸(여자아이/남자아이)
// 11-13 사용자: 동물의 숲처럼 "고를 것들을 그림 칸으로" — 머리 모양은 빈 얼굴에 머리만(face: false).
// 입체 화면 하나를 잠깐 열어 차례로 그리고 바로 닫는다 (WebGL 이 없으면 빈 배열 → 화면은 글자 칸으로).

import * as THREE from "three";
import type { AvatarConfig } from "@/lib/avatar/config";
import { Avatar } from "./avatar3d";
import { toonGradient } from "./textures";

export type ThumbShot = "head" | "bust";

/** 같은 그림을 다시 그리지 않게 (설정값 + 찍는 자리 → 그림) */
const cache = new Map<string, string>();

export async function avatarThumbs(cfgs: AvatarConfig[], shot: ThumbShot, opts: { face?: boolean; size?: number } = {}): Promise<string[]> {
  const size = opts.size ?? 168;
  const face = opts.face !== false;
  const keyOf = (c: AvatarConfig) => `${shot}|${face}|${size}|${JSON.stringify(c)}`;
  const todo = cfgs.filter((c) => !cache.has(keyOf(c)));
  if (todo.length) {
    let renderer: THREE.WebGLRenderer;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "low-power" });
    } catch {
      return cfgs.map((c) => cache.get(keyOf(c)) ?? "");
    }
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight("#fff6e6", "#d8b48c", 1.55));
    const sun = new THREE.DirectionalLight("#fffaf0", 1.7);
    sun.position.set(-50, 120, 110);
    scene.add(sun);
    const cam = new THREE.PerspectiveCamera(24, 1, 1, 1000);
    if (shot === "head") {
      // 머리 가운데(바닥에서 ≈ 26cm) 조금 위, 비스듬히 오른쪽에서 — 포니테일·땋은 머리·긴 머리 뒷모습도 보이게 (11-13)
      cam.position.set(Math.sin(0.55) * 62, 29.5, Math.cos(0.55) * 62);
      cam.lookAt(0, 27.2, 0);
    } else {
      cam.position.set(0, 27, 86); // 머리부터 허리까지
      cam.lookAt(0, 23, 0);
    }
    const gradient = toonGradient();
    for (const cfg of todo) {
      const av = new Avatar(cfg, gradient, { face });
      av.setPose("stand");
      for (let i = 0; i < 12; i++) av.update(0.05); // 자세가 자리 잡게 (깜빡이기 전에)
      scene.add(av.root);
      renderer.render(scene, cam);
      cache.set(keyOf(cfg), canvas.toDataURL("image/png"));
      scene.remove(av.root);
      av.dispose();
      await new Promise((r) => setTimeout(r, 0)); // 화면이 멈추지 않게 한 장씩
    }
    gradient.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
  return cfgs.map((c) => cache.get(keyOf(c)) ?? "");
}
