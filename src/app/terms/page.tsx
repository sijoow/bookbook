// 이용약관 · 개인정보 처리방침 — 초안 (출시 전에 정식 문서로 바꾼다). 처음 가입 화면·마이페이지에서 연다.
// 실제로 하는 일과 같게: 닉네임·로그인 식별자·독서 기록만, 탈퇴하면 바로 모두 지움(DELETE /api/me), YES24 출처 표기.

import Link from "next/link";
import ui from "@/components/ui.module.css";
import s from "../login/login.module.css";

export const metadata = { title: "이용약관 · 개인정보 처리방침 — bookbook" };

const box = { width: "100%", textAlign: "left" as const, marginTop: 22, fontSize: 14.5, lineHeight: 1.7 };

export default function Terms() {
  return (
    <main className={s.wrap}>
      <p className={s.logo}>bookbook</p>
      <h1 className={s.title} style={{ fontSize: 28, marginTop: 10 }}>
        약속 (초안)
      </h1>
      <p className={s.lead}>출시 전에 정식 문서로 바꿔요. 지금은 앱이 실제로 하는 일을 그대로 적었어요.</p>

      <section id="terms" className={ui.paper} style={box}>
        <span className={ui.paperLabel}>이용약관</span>
        <ol style={{ paddingLeft: 18 }}>
          <li>bookbook 은 내가 읽은 책을 기록하고, 나만의 도서관을 꾸미고, 친구 도서관에 놀러 가는 서비스예요.</li>
          <li>만 14세 이상이면 가입할 수 있어요.</li>
          <li>친구 도서관은 서로 친구인 사람끼리만 보이고, 메모는 친구에게도 보이지 않아요.</li>
          <li>다른 사람에게 상처를 주는 닉네임·한줄평·발도장 한마디는 운영자가 숨기거나 고칠 수 있고, 되풀이하면 이용을 멈출 수 있어요.</li>
          <li>책을 읽으면 포인트가 쌓이고, 포인트로 앱 안의 꾸미기 물건을 살 수 있어요. 포인트는 돈으로 바꾸거나 남에게 넘길 수 없고, 탈퇴하면 사라져요.</li>
          <li>책 정보와 표지·책등 그림은 YES24 에서 그때그때 불러와 보여 주고, 화면에 출처를 적어요.</li>
        </ol>
      </section>

      <section id="privacy" className={ui.paper} style={box}>
        <span className={ui.paperLabel}>개인정보 처리방침</span>
        <ul style={{ paddingLeft: 18 }}>
          <li>
            <b>모으는 것</b>: 아이디와 비밀번호(비밀번호는 되돌릴 수 없게 바꿔서만 저장해요 — 운영자도 원래 비밀번호를 볼 수 없어요), 닉네임, 한 줄 소개, 내가 남긴 독서 기록(책·읽은 시간·쪽·별점·한줄평·메모), 아바타·집·꾸미기 설정, 포인트 내역, 마지막 접속 시각
          </li>
          <li>
            <b>쓰는 곳</b>: 내 도서관과 기록을 보여 주고, 친구 도서관과 통로를 잇는 데만 써요. 광고에 쓰거나 남에게 넘기지 않아요.
          </li>
          <li>
            <b>내 사진으로 아바타</b>(지금은 꺼 둠): 켜면 사진은 내 기기 안에서만 색을 읽고 바로 지워요. 서버나 AI 로 보내지 않고 저장하지도 않아요.
          </li>
          <li>
            <b>지우는 때</b>: 마이페이지 → 회원 탈퇴를 누르면 위의 것을 모두 바로 지워요.
          </li>
          <li>
            <b>문의</b>: 출시 전에 문의처를 적어요.
          </li>
        </ul>
      </section>

      <p style={{ marginTop: 22 }}>
        <Link href="/" className={ui.textBtn}>
          돌아가기 ›
        </Link>
      </p>
    </main>
  );
}
