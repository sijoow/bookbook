import { describe, expect, it } from "vitest";
import { imageSize } from "./imageSize";

// 최소 JPEG 머리: SOI + APP0(JFIF) + SOF0(세로 400, 가로 19)
function jpeg(w: number, h: number, sof = 0xc0): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const sofSeg = [0xff, sof, 0x00, 0x11, 0x08, h >> 8, h & 0xff, w >> 8, w & 0xff, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sofSeg, 0xff, 0xda, 0x00, 0x02]);
}

function png(w: number, h: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const dv = new DataView(b.buffer);
  dv.setUint32(16, w);
  dv.setUint32(20, h);
  return b;
}

describe("imageSize", () => {
  it("JPEG SOF0·SOF2 에서 가로·세로", () => {
    expect(imageSize(jpeg(19, 400))).toEqual({ w: 19, h: 400 });
    expect(imageSize(jpeg(280, 400, 0xc2))).toEqual({ w: 280, h: 400 }); // 프로그레시브
  });

  it("PNG IHDR 에서 가로·세로", () => {
    expect(imageSize(png(51, 400))).toEqual({ w: 51, h: 400 });
  });

  it("이미지가 아니거나 잘린 바이트는 null", () => {
    expect(imageSize(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(imageSize(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toBeNull(); // SOF 없이 스캔 시작
    expect(imageSize(new Uint8Array(0))).toBeNull();
  });
});
