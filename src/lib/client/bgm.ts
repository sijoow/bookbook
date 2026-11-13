// 배경 음악 — 11-13 사용자: "music 폴더 안에 음원을 넣었거든 잔잔하게 흐르게만 해 줘"
// public/music/bgm.m4a (원본 music/music.mp4 에서 소리만 뽑아 64kbps · 소리 크기 맞춤, 약 65분). 끝나면 처음부터 다시.
// 브라우저는 첫 터치 전엔 소리를 막는다 → 첫 터치·클릭·키에 시작(BgmPlayer). 앱을 내리면(화면 숨김) 멈췄다가 돌아오면 이어서.
// 켜고 끄기는 이 기기에만 기억 (localStorage bookbook.music, 처음엔 켜짐). 들은 자리도 기억해 다음에 이어서.
// 캐릭터 목소리가 나올 땐 잠깐 작게 (duck).

const KEY = "bookbook.music";
const POS = "bookbook.musicAt";
const SRC = "/music/bgm.m4a";
const VOLUME = 0.28; // 잔잔하게

let audio: HTMLAudioElement | null = null;
let fade = 0;
let duckTimer = 0;
let lastSaved = 0;

export function musicOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

function el(): HTMLAudioElement {
  if (audio) return audio;
  const a = new Audio(SRC);
  a.loop = true;
  a.preload = "none";
  a.volume = 0;
  a.addEventListener("loadedmetadata", () => {
    try {
      const at = Number(localStorage.getItem(POS));
      if (at > 0 && at < a.duration - 5) a.currentTime = at; // 지난번 들은 자리부터
    } catch {
      // 기억이 막혀 있으면 처음부터
    }
  });
  a.addEventListener("timeupdate", () => {
    if (Math.abs(a.currentTime - lastSaved) < 5) return;
    lastSaved = a.currentTime;
    try {
      localStorage.setItem(POS, String(Math.floor(a.currentTime)));
    } catch {
      // 기억 못 해도 음악은 그대로
    }
  });
  audio = a;
  return a;
}

/** 소리 크기를 천천히 (ms 동안) */
function fadeTo(v: number, ms: number, then?: () => void) {
  const a = audio;
  if (!a) return;
  window.clearInterval(fade);
  if (ms <= 0) {
    a.volume = v;
    then?.();
    return;
  }
  const from = a.volume;
  const t0 = performance.now();
  fade = window.setInterval(() => {
    const p = Math.min(1, (performance.now() - t0) / ms);
    a.volume = Math.max(0, Math.min(1, from + (v - from) * p));
    if (p >= 1) {
      window.clearInterval(fade);
      then?.();
    }
  }, 40);
}

/** 켜져 있으면 틀기 (첫 터치 전엔 브라우저가 막는다 — 그땐 조용히 다음 터치를 기다린다) */
export function startMusic() {
  if (typeof window === "undefined" || !musicOn() || document.hidden) return;
  const a = el();
  if (!a.paused) return;
  a.play()
    .then(() => fadeTo(VOLUME, 1500))
    .catch(() => {});
}

export function stopMusic(soft = true) {
  const a = audio;
  if (!a || a.paused) return;
  fadeTo(0, soft ? 500 : 0, () => a.pause());
}

export function setMusic(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // 저장이 막히면 이번만
  }
  if (on) startMusic();
  else stopMusic();
}

/** 앱을 내리면 멈추고, 돌아오면 그때 틀던 것만 이어서 (안 틀던 음악을 화면이 보일 때 새로 받지 않게) */
let resumeOnShow = false;
export function pauseHidden() {
  resumeOnShow = Boolean(audio && !audio.paused);
  stopMusic(false);
}
export function resumeShown() {
  if (resumeOnShow) startMusic();
  resumeOnShow = false;
}

/** 캐릭터 목소리가 나오는 동안 잠깐 작게 */
export function duckMusic(ms = 1800) {
  const a = audio;
  if (!a || a.paused) return;
  fadeTo(VOLUME * 0.35, 150);
  window.clearTimeout(duckTimer);
  duckTimer = window.setTimeout(() => fadeTo(VOLUME, 700), ms);
}
