import { Suspense } from "react";
import { AuthWatch } from "@/components/AuthWatch";
import { BgmPlayer } from "@/components/BgmPlayer";
import { TabBar, TabNav } from "@/components/Bars";
import s from "@/components/ui.module.css";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={s.shell}>
      <main className={s.main}>{children}</main>
      <AuthWatch />
      <BgmPlayer />
      {/* 탭은 주소(usePathname)를 읽는다 — /book/[id] 처럼 주소를 미리 모르는 화면에서도 미리 그릴 수 있게 Suspense + 탭 모양 그대로 */}
      <Suspense fallback={<TabNav path={null} />}>
        <TabBar />
      </Suspense>
    </div>
  );
}
