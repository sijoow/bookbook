import { describe, expect, it } from "vitest";
import { portalCounts, portalsBetween } from "./portals";
import type { BookStatus } from "./types";

const b = (id: string, workKey: string, status: BookStatus) => ({ id, workKey, status });

describe("portalsBetween", () => {
  const mine = [b("m1", "데미안|헤르만헤세", "read"), b("m2", "아몬드|손원평", "reading"), b("m3", "급류|정대건", "stopped"), b("m4", "모순|양귀자", "read")];
  const theirs = [b("t1", "데미안|헤르만헤세", "read"), b("t2", "아몬드|손원평", "read"), b("t3", "급류|정대건", "read"), b("t4", "가호|무라카미하루키", "read")];

  it("같은 책만, 둘 다 읽었으면 열린 통로·아니면 희미, 중단이면 없음", () => {
    const ps = portalsBetween(mine, theirs);
    expect(ps.map((p) => [p.workKey, p.open])).toEqual([
      ["데미안|헤르만헤세", true],
      ["아몬드|손원평", false],
    ]);
    expect(ps[0].mine.id).toBe("m1");
    expect(ps[0].theirs.id).toBe("t1");
  });

  it("판본이 달라도(같은 workKey) 하나의 통로", () => {
    const ps = portalsBetween([b("a", "데미안|헤르만헤세", "read"), b("b", "데미안|헤르만헤세", "want")], [b("t", "데미안|헤르만헤세", "read")]);
    expect(ps).toHaveLength(1);
  });

  it("세기", () => {
    expect(portalCounts(portalsBetween(mine, theirs))).toEqual({ open: 1, faint: 1 });
    expect(portalCounts([])).toEqual({ open: 0, faint: 0 });
  });
});
