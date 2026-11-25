import { describe, expect, it } from "vitest";
import { formatApaAuthors, formatApaCitation, splitAuthors } from "@/lib/apaCitation";

describe("apaCitation", () => {
  it("저자를 쉼표·and·및 등으로 분리", () => {
    expect(splitAuthors("Hong, Kim, and Lee")).toEqual(["Hong", "Kim", "Lee"]);
    expect(splitAuthors("홍길동, 김철수 및 이영희")).toEqual(["홍길동", "김철수", "이영희"]);
  });

  it("1~2명은 전체 표기", () => {
    expect(formatApaAuthors("홍길동")).toBe("홍길동");
    expect(formatApaAuthors("Smith; John")).toBe("Smith & John");
    expect(formatApaAuthors("홍길동, 김철수")).toBe("홍길동, 김철수");
  });

  it("3명 이상은 국문 외 / 영문 et al.", () => {
    expect(formatApaAuthors("홍길동, 김철수, 이영희")).toBe("홍길동 외");
    expect(formatApaAuthors("Smith, Jones, Brown")).toBe("Smith et al.");
    expect(formatApaAuthors("홍길동 외")).toBe("홍길동 외");
    expect(formatApaAuthors("Smith et al.")).toBe("Smith et al.");
  });

  it("APA 문자열에 저널 이탤릭 HTML 포함", () => {
    const c = formatApaCitation({
      sourceAuthor: "홍길동, 김철수, 이영희",
      sourceYear: 2020,
      sourceTitle: "우울 척도 개발",
      sourceJournal: "한국심리학회지",
      sourceVolume: "12",
      sourceIssue: "3",
      sourceUrl: "https://example.com",
    });
    expect(c.empty).toBe(false);
    expect(c.plain).toBe(
      "홍길동 외. (2020). 우울 척도 개발. 한국심리학회지, 12(3). https://example.com",
    );
    expect(c.html).toContain("<i>한국심리학회지</i>");
    expect(c.html).toContain("12(3)");
  });

  it("빈 출처는 empty", () => {
    expect(formatApaCitation({}).empty).toBe(true);
  });
});
