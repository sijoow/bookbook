// 이미지 바이트에서 가로·세로 픽셀만 읽는다 (JPEG SOF / PNG IHDR). 서버·브라우저 어디서나 쓰는 순수 함수.
// YES24 책등 이미지는 JPEG, 세로 400px 로 맞춰져 온다 (11-12 실측).

export type ImageSize = { w: number; h: number };

const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

export function imageSize(buf: Uint8Array): ImageSize | null {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  // PNG: 8바이트 서명 뒤 IHDR 의 너비·높이
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const w = dv.getUint32(16);
    const h = dv.getUint32(20);
    return w > 0 && h > 0 ? { w, h } : null;
  }

  // JPEG: FFD8 로 시작, 세그먼트를 건너뛰며 SOF 를 찾는다
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 3 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const m = buf[i + 1];
    if (m === 0xff) {
      i++; // 채움 바이트
      continue;
    }
    if (m === 0xd9 || m === 0xda) return null; // 끝·스캔 시작 전에 SOF 가 없었다
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
      i += 2; // 길이 없는 표지
      continue;
    }
    const len = dv.getUint16(i + 2);
    if (SOF.has(m)) {
      if (i + 8 >= buf.length) return null;
      const h = dv.getUint16(i + 5);
      const w = dv.getUint16(i + 7);
      return w > 0 && h > 0 ? { w, h } : null;
    }
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}
