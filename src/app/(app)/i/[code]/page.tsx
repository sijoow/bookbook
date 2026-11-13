"use client";

// 초대 링크 — 초대한 사람 도서관 미리보기(입체: 그 사람 아바타·꾸민 방·책장) → '친구 되기' → 친구 도서관으로 놀러 간다
// 11-12 사용자: "내 책장 공유하기 하면서 친구네 집 놀러 가서 방문하기"

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/Bars";
import { Bookshelf } from "@/components/Bookshelf";
import { Sparkle, Tape, Yes24Credit } from "@/components/Deco";
import ui from "@/components/ui.module.css";
import stage from "@/components/library3d/stage.module.css";
import type { AvatarConfig } from "@/lib/avatar/config";
import type { HouseId } from "@/lib/house/houses";
import type { ItemPos, PaintId } from "@/lib/deco/items";
import { api } from "@/lib/client/api";
import { hasWebGL } from "@/lib/client/webgl";
import type { LibraryBook } from "@/lib/books/types";
import s from "../../screens.module.css";

const LibraryStage = dynamic(() => import("@/components/library3d/LibraryStage"), {
  ssr: false,
  loading: () => <div className={stage.slot} />,
});

type View = {
  code: string;
  inviter: { handle: string; nickname: string; avatar: AvatarConfig; deco: { worn: string[]; placed: string[]; pos?: Record<string, ItemPos>; paint?: PaintId }; house?: HouseId };
  books: LibraryBook[];
  isSelf: boolean;
  alreadyFriend: boolean;
};

export default function Invite() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gl] = useState(hasWebGL);

  useEffect(() => {
    let alive = true;
    api<View>(`/api/invites/${encodeURIComponent(code)}`)
      .then((d) => alive && setV(d))
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [code]);

  async function accept() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ friend: { handle: string } }>(`/api/invites/${encodeURIComponent(code)}`, { method: "POST" });
      router.push(`/u/${r.friend.handle}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar back="/multiverse" title="책장 친구 초대" />
      {err && <p className={ui.error}>{err}</p>}

      {v && (
        <>
          <section className={s.hero} style={{ paddingBottom: 0 }}>
            <Sparkle size={20} style={{ position: "absolute", left: 24, top: 20 }} />
            <h1 className={s.handTitle}>{v.inviter.nickname}의 도서관 초대장</h1>
            <p className={ui.muted} style={{ marginTop: 6 }}>
              같은 책을 읽으면 우리 책장 사이에 통로가 열려요
            </p>
          </section>

          {gl ? (
            <LibraryStage mode="visit" books={v.books} avatar={v.inviter.avatar} deco={v.inviter.deco} house={v.inviter.house} name={v.inviter.nickname} title={`${v.inviter.nickname}의 도서관`} />
          ) : (
            <Bookshelf title={`${v.inviter.nickname}의 책장`} books={v.books} addSlot={false} />
          )}

          <section className={`${ui.paper} ${s.section}`}>
            <Tape color="coral" />
            {v.isSelf ? (
              <>
                <span className={ui.paperLabel}>내가 만든 초대장이에요</span>
                <p style={{ fontSize: 14 }}>이 링크를 친구에게 보내 주세요. (개발 중에는 &lsquo;나&rsquo; 탭에서 다른 시험 계정으로 바꿔 열어 보면 친구가 될 수 있어요)</p>
              </>
            ) : v.alreadyFriend ? (
              <>
                <span className={ui.paperLabel}>이미 책장 친구예요</span>
                <Link href={`/u/${v.inviter.handle}`} className={`${ui.btn} ${ui.btnWide}`} style={{ marginTop: 10 }}>
                  {v.inviter.nickname}의 도서관에 놀러 가기 ▸
                </Link>
              </>
            ) : (
              <>
                <span className={ui.paperLabel}>책장 친구가 될까요?</span>
                <p style={{ fontSize: 14 }}>서로의 책장에 놀러 가서 같은 책을 얼마나 걸려 읽었는지, 한줄평은 뭔지 볼 수 있어요. 메모는 보이지 않아요.</p>
                <button type="button" className={`${ui.btn} ${ui.btnWide}`} style={{ marginTop: 14 }} onClick={accept} disabled={busy}>
                  친구 되고 놀러 가기 ▸
                </button>
              </>
            )}
          </section>
          {v.books.some((b) => b.coverUrl || b.sideCoverUrl) && <Yes24Credit />}
        </>
      )}
    </>
  );
}
