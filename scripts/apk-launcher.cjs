/* eslint-disable @typescript-eslint/no-require-imports -- 빌드 도구(bubblewrap)를 경로로 불러오는 CommonJS 스크립트 */
// 생성된 LauncherActivity.java 에 덧대기 — scripts/apk.cjs 가 프로젝트를 만든 뒤 부른다 (숫자놀이 patch-launcher.cjs 에서 크롬 고르기만 가져옴).
// 앱 엔진은 크롬으로: 크롬이 있고 TWA 를 하면 크롬, 없으면 기본 브라우저. 삼성 인터넷은 TWA 설정 일부를 무시했다(2026-10-21 숫자놀이).
// bookbook 은 상태 표시줄이 보이는 standalone 이라 몰입(카메라 자리) 덧대기는 뺐다.
const fs = require("fs");
module.exports = function patchLauncher(file) {
  let s = fs.readFileSync(file, "utf8");
  if (s.includes("pickBrowser()")) return;
  const imports = [
    "import android.content.Intent;",
    "import android.content.pm.PackageManager;",
    "import android.content.pm.ResolveInfo;",
    "import androidx.browser.customtabs.CustomTabsService;",
    "import com.google.androidbrowserhelper.trusted.LauncherActivityMetadata;",
    "import com.google.androidbrowserhelper.trusted.SessionStore;",
    "import com.google.androidbrowserhelper.trusted.SharedPreferencesTokenStore;",
    "import com.google.androidbrowserhelper.trusted.TwaLauncher;",
  ].join("\n");
  s = s.replace("import android.os.Bundle;", "import android.os.Bundle;\n" + imports);
  const method = `
    private static final String CHROME = "com.android.chrome";

    /**
     * 앱을 띄울 브라우저 — 크롬이 깔려 있고 켜져 있고 TWA 를 하면 크롬, 아니면 null(androidbrowserhelper 가 기본 브라우저로 고른다).
     * 삼성 인터넷은 카메라 자리 설정을 무시해 흰 띠가 남았다(2026-10-21 화면 진단).
     */
    private String pickBrowser() {
        String fixed = LauncherActivityMetadata.parse(this).launchingBrowser;
        if (fixed != null) return fixed;
        Intent probe = new Intent(CustomTabsService.ACTION_CUSTOM_TABS_CONNECTION).setPackage(CHROME);
        for (ResolveInfo info : getPackageManager().queryIntentServices(probe, PackageManager.GET_RESOLVED_FILTER)) {
            if (info.filter != null && info.filter.hasCategory(CustomTabsService.TRUSTED_WEB_ACTIVITY_CATEGORY)) {
                return CHROME;
            }
        }
        return null;
    }

    /**
     * 나머지는 androidbrowserhelper 의 createTwaLauncher 와 같다(세션·토큰 저장소). 브라우저는 pickBrowser.
     */
    @Override
    protected TwaLauncher createTwaLauncher() {
        return new TwaLauncher(this, pickBrowser(),
                SessionStore.makeSessionId(getTaskId()), new SharedPreferencesTokenStore(this));
    }
`;
  const at = s.lastIndexOf("}");
  s = s.slice(0, at) + method + "}\n";
  fs.writeFileSync(file, s);
  const out = fs.readFileSync(file, "utf8");
  if (!out.includes("pickBrowser()")) throw new Error("LauncherActivity 덧대기 실패");
};
