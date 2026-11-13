import { describe, expect, it } from "vitest";
import { makeSaver } from "./saver";

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

describe("마지막 것만 저장", () => {
  it("빠르게 여러 번 바꿔도 한 번에 하나씩, 끝 값이 마지막에 저장된다", async () => {
    const sent: number[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const save = makeSaver(async (v: number) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await tick(10);
      sent.push(v);
      inFlight--;
    });
    for (let i = 1; i <= 5; i++) save(i);
    await tick(80);
    expect(maxInFlight).toBe(1);
    expect(sent[0]).toBe(1); // 처음 것은 바로 보내고
    expect(sent.at(-1)).toBe(5); // 그사이 바뀐 것 중 마지막만
    expect(sent.length).toBeLessThanOrEqual(2);
  });

  it("실패해도 다음 값은 보낸다", async () => {
    const errors: string[] = [];
    const sent: string[] = [];
    const save = makeSaver(
      async (v: string) => {
        await tick(5);
        if (v === "bad") throw new Error("실패");
        sent.push(v);
      },
      (e) => errors.push(e.message),
    );
    save("bad");
    save("good");
    await tick(40);
    expect(errors).toEqual(["실패"]);
    expect(sent).toEqual(["good"]);
  });
});
