// 오늘의 미션 · 이번 주 읽은 날 — 11-13 사용자: "이런 식으로 간단한 미션들도 주고 거기서 포인트 주고"
// 하루 미션 3개(20쪽 읽기는 늘 + 날마다 둘이 돌아가며) · 셋 다 하면 보너스 · 이번 주 5일 읽으면 보너스
// 날짜는 한국 날짜(kstDay). 순수 계산만 — 진행은 서버(lib/server/missions)가 센다

export type MissionId = "read20" | "memo" | "shelve" | "visit" | "stamp";

export type MissionDef = { title: string; goal: number; unit: string; reward: number; go: string; hint: string };

export const MISSIONS: Record<MissionId, MissionDef> = {
  read20: { title: "책 20쪽 넘게 읽기", goal: 20, unit: "쪽", reward: 20, go: "/", hint: "책장에서 책을 눌러 읽고, 덮을 때 몇 쪽까지 적어요" },
  memo: { title: "마음에 남은 문장 메모하기", goal: 1, unit: "개", reward: 15, go: "/library", hint: "책 상세 → 메모" },
  shelve: { title: "새 책 한 권 꽂기", goal: 1, unit: "권", reward: 10, go: "/add", hint: "읽고 싶은 책도 돼요" },
  visit: { title: "친구 집 놀러 가기", goal: 1, unit: "번", reward: 10, go: "/multiverse", hint: "멀티버스에서 친구 우주를 눌러요" },
  stamp: { title: "친구 집에 발도장 남기기", goal: 1, unit: "개", reward: 10, go: "/multiverse", hint: "친구 집 → 발도장" },
};

export const ALL_DONE_BONUS = 20; // 오늘의 미션 셋을 다 받으면
export const ATTEND_REWARD = 10; // 출석 체크 (하루 한 번)
export const STREAK_GOAL = 7; // 며칠 이어서 들어오면
export const STREAK_REWARD = 50;
/** 받기 단추 — 오늘의 미션 · 이번 주 읽은 날 · 출석 */
export type ClaimId = MissionId | "week" | "attend";
export const WEEK_GOAL = 5; // 이번 주 며칠 읽으면
export const WEEK_REWARD = 50;
export const WEEKDAY = ["월", "화", "수", "목", "금", "토", "일"] as const;

/** '2026-11-13' → 1970-01-01 부터 며칠 */
export function dayNumber(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}

const dayString = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);

/** 오늘까지 며칠 이어서 들어왔나 (오늘 포함) */
export function streakOf(days: Set<string>, today: string): number {
  let n = 0;
  for (let d = dayNumber(today); days.has(dayString(d)); d--) n++;
  return n;
}

/** 오늘의 미션 셋 — 20쪽 읽기는 늘, 나머지 둘은 날마다 돌아가며 (친구가 없으면 친구 미션은 빼고) */
export function todaysMissions(day: string, hasFriends: boolean): MissionId[] {
  const pool: MissionId[] = hasFriends ? ["memo", "shelve", "visit", "stamp"] : ["memo", "shelve"];
  const n = dayNumber(day);
  const a = pool[((n % pool.length) + pool.length) % pool.length];
  const b = pool[(((n + 1) % pool.length) + pool.length) % pool.length];
  return ["read20", a, b];
}

/** 그 날이 든 주의 월~일 (한국 날짜 문자열 7개) */
export function weekDays(day: string): string[] {
  const n = dayNumber(day);
  const dow = (((n + 3) % 7) + 7) % 7; // 1970-01-01 은 목요일 → 월요일 0
  return Array.from({ length: 7 }, (_, i) => dayString(n - dow + i));
}

/** 한국 날짜의 0시 (UTC 시각) */
export function kstStart(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00+09:00`));
}

export type MissionView = { id: MissionId; title: string; hint: string; go: string; reward: number; now: number; goal: number; unit: string; done: boolean; claimed: boolean };
export type WeekView = { days: { day: string; label: string; read: boolean; today: boolean; future: boolean }[]; count: number; goal: number; reward: number; done: boolean; claimed: boolean };
export type AttendView = { claimed: boolean; streak: number; reward: number; bonus: number; goal: number; days: { day: string; label: string; on: boolean; today: boolean; future: boolean }[] };
export type MissionsView = { day: string; attend: AttendView; missions: MissionView[]; bonus: { reward: number; claimed: boolean }; week: WeekView; ready: number };

/** 화면에 보낼 모양 — 진행(now)·받았나(claimed)는 서버가 센 값 */
export function missionsView(
  day: string,
  ids: MissionId[],
  now: Record<MissionId, number>,
  claimed: Set<string>,
  readDays: Set<string>,
  seenDays: Set<string> = new Set(),
): MissionsView {
  const missions = ids.map((id) => {
    const d = MISSIONS[id];
    const n = Math.max(0, now[id] ?? 0);
    return { id, title: d.title, hint: d.hint, go: d.go, reward: d.reward, now: Math.min(n, d.goal), goal: d.goal, unit: d.unit, done: n >= d.goal, claimed: claimed.has(id) };
  });
  const days = weekDays(day).map((d, i) => ({ day: d, label: WEEKDAY[i], read: readDays.has(d), today: d === day, future: d > day }));
  const count = days.filter((d) => d.read).length;
  const week = { days, count, goal: WEEK_GOAL, reward: WEEK_REWARD, done: count >= WEEK_GOAL, claimed: claimed.has("week") };
  // 출석 — 들어온 날(오늘은 늘 들어온 날). 7일째·14일째… 도장을 찍는 날엔 보너스
  const seen = new Set(seenDays).add(day);
  const streak = streakOf(seen, day);
  const attend: AttendView = {
    claimed: claimed.has("attend"),
    streak,
    reward: ATTEND_REWARD,
    bonus: streak > 0 && streak % STREAK_GOAL === 0 ? STREAK_REWARD : 0,
    goal: STREAK_GOAL,
    days: weekDays(day).map((d, i) => ({ day: d, label: WEEKDAY[i], on: seen.has(d), today: d === day, future: d > day })),
  };
  const ready = missions.filter((m) => m.done && !m.claimed).length + (week.done && !week.claimed ? 1 : 0) + (attend.claimed ? 0 : 1);
  return { day, attend, missions, bonus: { reward: ALL_DONE_BONUS, claimed: claimed.has("all") }, week, ready };
}

/** 포인트 장부 ref — 같은 날 같은 미션은 한 번만 (pointLog unique) */
export function missionRef(day: string, id: MissionId | "all" | "week" | "attend" | "streak"): string {
  return id === "week" ? `week:${weekDays(day)[0]}` : `${day}:${id}`;
}
