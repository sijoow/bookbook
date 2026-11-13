import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VOICE_LINES } from "./lines";

const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

describe("캐릭터 목소리 말 목록", () => {
  it("입체 화면이 말하는 줄은 모두 목록에 있다 (빠지면 그 말만 소리가 안 난다)", () => {
    const world = src("components/library3d/world.ts");
    const said = new Set<string>();
    for (const m of world.matchAll(/(?:say|sayGuest\?\.)\("([^"]+)"\)/g)) said.add(m[1]);
    for (const m of world.matchAll(/pick\(\[([^\]]+)\]\)/g)) for (const q of m[1].matchAll(/"([^"]+)"/g)) said.add(q[1]);
    for (const m of world.matchAll(/guestCheer\(line = "([^"]+)"\)/g)) said.add(m[1]);
    expect(said.size).toBeGreaterThan(10);
    for (const line of said) expect(VOICE_LINES, line).toContain(line);
  });

  it("화면에서 넘기는 말(덮기·담기·어때)도 목록에 있다", () => {
    const home = src("app/(app)/page.tsx");
    const closing = home.match(/CLOSE_LINES = \[([^\]]+)\]/)?.[1] ?? "";
    for (const q of closing.matchAll(/"([^"]+)"/g)) expect(VOICE_LINES).toContain(q[1]);
    expect(VOICE_LINES).toContain("잘 읽어!");
    expect(VOICE_LINES).toContain("어때?");
  });

  it("굽는 스크립트와 같은 목록", () => {
    const script = src("../scripts/voice.mts");
    for (const line of VOICE_LINES.filter((l) => !l.endsWith(" 받았다!"))) expect(script).toContain(`"${line}"`);
    expect(new Set(VOICE_LINES).size).toBe(VOICE_LINES.length); // 겹친 줄 없음
  });
});
