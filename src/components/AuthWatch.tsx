"use client";

// 로그인이 풀리면(API 401) 로그인 화면으로 — api() 가 'bookbook:auth' 신호를 보내면 돌아올 곳을 붙여 옮긴다.

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export const AUTH_EVENT = "bookbook:auth";

export function AuthWatch() {
  const router = useRouter();
  useEffect(() => {
    const go = () => {
      const p = window.location.pathname;
      if (p.startsWith("/login") || p.startsWith("/welcome") || p.startsWith("/terms")) return;
      router.replace(`/login?next=${encodeURIComponent(p + window.location.search)}`);
    };
    window.addEventListener(AUTH_EVENT, go);
    return () => window.removeEventListener(AUTH_EVENT, go);
  }, [router]);
  return null;
}
