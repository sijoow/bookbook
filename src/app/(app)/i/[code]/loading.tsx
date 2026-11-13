// /i/[code] 는 주소(useParams)를 미리 모르는 화면이라 Suspense 경계가 필요하다 — 이 파일이 그 경계
import ui from "@/components/ui.module.css";

export default function Loading() {
  return (
    <p className={ui.muted} style={{ marginTop: 72, textAlign: "center" }}>
      초대장 여는 중…
    </p>
  );
}
