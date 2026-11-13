// 입체 화면(three.js 는 WebGL2)을 열 수 있나 — 못 열면 화면들이 2D 책장으로 간다.
// 서버에서 미리 그릴 때는 false (그때는 책 목록이 아직 없어 화면이 같다).

export function hasWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
