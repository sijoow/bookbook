import { describe, expect, it } from "vitest";
import { cleanIsbn, isValidIsbn10, isValidIsbn13, toIsbn13 } from "./isbn";

describe("isbn", () => {
  it("하이픈·공백을 지운다", () => {
    expect(cleanIsbn("978-89-374-6044-9")).toBe("9788937460449");
    expect(cleanIsbn(" 0-8044-2957-x ")).toBe("080442957X");
  });

  it("ISBN-13 체크섬과 978·979 접두를 본다", () => {
    expect(isValidIsbn13("9788937460449")).toBe(true);
    expect(isValidIsbn13("9788936434120")).toBe(true);
    expect(isValidIsbn13("9788937460448")).toBe(false); // 체크섬 틀림
    expect(isValidIsbn13("8801234567890")).toBe(false); // 책이 아닌 바코드
  });

  it("ISBN-10 체크섬 (X 포함)", () => {
    expect(isValidIsbn10("0306406152")).toBe(true);
    expect(isValidIsbn10("080442957X")).toBe(true);
    expect(isValidIsbn10("0306406153")).toBe(false);
  });

  it("ISBN-10 은 13 으로 바꾸고, 틀리면 null", () => {
    expect(toIsbn13("0306406152")).toBe("9780306406157");
    expect(toIsbn13("0-8044-2957-X")).toBe("9780804429573");
    expect(toIsbn13("978-89-374-6044-9")).toBe("9788937460449");
    expect(toIsbn13("abc")).toBeNull();
    expect(toIsbn13("")).toBeNull();
  });
});
