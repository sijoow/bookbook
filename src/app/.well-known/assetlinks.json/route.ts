/**
 * /.well-known/assetlinks.json — 안드로이드 앱(TWA)이 이 사이트를 주소창 없이 띄우게 하는 확인 파일.
 * 패키지·지문 = scripts/apk.cjs 의 서명 키 (2026-11-13 `node scripts/apk.cjs key`, 키는 저장소 밖 C:\Users\YOGIBO~1\bookbook-apk). 지문은 비밀이 아니다.
 * 키를 새로 만들면 여기 지문도 바꾸고 다시 배포해야 앱이 주소창 없이 뜬다. 플레이 스토어에 올리면 스토어 서명 지문도 덧붙인다.
 */

const PACKAGE = "kr.bookbook.app";
const FINGERPRINTS = ["97:B6:18:ED:99:83:32:53:DD:C7:D0:61:21:2B:2E:CF:1D:0F:4F:14:44:6F:0C:4E:1D:9B:88:8F:63:37:AE:42"];

export function GET() {
  const body = [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: PACKAGE, sha256_cert_fingerprints: FINGERPRINTS } }];
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
