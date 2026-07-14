import { describe, it, expect } from "vitest";
import {
  convertScore,
  isRawScoreInRange,
  scoreScale,
  findUnansweredActiveQuestions,
  type ScoringQuestion,
} from "@/lib/scoring";

describe("convertScore (역문항 계산)", () => {
  it("일반 문항은 원점수와 동일", () => {
    expect(convertScore(3, false, 1, 5)).toBe(3);
    expect(convertScore(1, false, 1, 5)).toBe(1);
  });

  it("1~5 역문항 공식: max+min-raw", () => {
    expect(convertScore(1, true, 1, 5)).toBe(5);
    expect(convertScore(2, true, 1, 5)).toBe(4);
    expect(convertScore(3, true, 1, 5)).toBe(3);
    expect(convertScore(4, true, 1, 5)).toBe(2);
    expect(convertScore(5, true, 1, 5)).toBe(1);
  });

  it("0~6 역문항도 올바르게 변환", () => {
    expect(convertScore(0, true, 0, 6)).toBe(6);
    expect(convertScore(6, true, 0, 6)).toBe(0);
  });
});

describe("isRawScoreInRange", () => {
  it("범위 내/외 판별", () => {
    expect(isRawScoreInRange(1, 1, 5)).toBe(true);
    expect(isRawScoreInRange(5, 1, 5)).toBe(true);
    expect(isRawScoreInRange(0, 1, 5)).toBe(false);
    expect(isRawScoreInRange(6, 1, 5)).toBe(false);
    expect(isRawScoreInRange(2.5, 1, 5)).toBe(false);
  });
});

function q(
  id: string,
  opts: Partial<ScoringQuestion> = {},
): ScoringQuestion {
  return {
    id,
    type: "LIKERT",
    isReverse: false,
    isActive: true,
    isRequired: true,
    subfactorId: null,
    minScore: null,
    maxScore: null,
    ...opts,
  };
}

describe("scoreScale (척도 총점/평균/하위요인)", () => {
  it("일반+역문항 혼합 총점 계산", () => {
    const result = scoreScale({
      versionMinScore: 1,
      versionMaxScore: 5,
      questions: [
        q("q1"),
        q("q2", { isReverse: true }),
        q("q3"),
      ],
      rawScores: { q1: 3, q2: 1, q3: 5 },
    });
    // convertedTotal = 3 + (6-1)=5 + 5 = 13
    expect(result.convertedTotal).toBe(13);
    expect(result.rawTotal).toBe(9);
    expect(result.completedQuestionCount).toBe(3);
    expect(result.averageScore).toBeCloseTo(13 / 3);
  });

  it("비활성 문항은 계산에서 제외", () => {
    const result = scoreScale({
      versionMinScore: 1,
      versionMaxScore: 5,
      questions: [q("q1"), q("q2", { isActive: false })],
      rawScores: { q1: 4, q2: 5 },
    });
    expect(result.completedQuestionCount).toBe(1);
    expect(result.convertedTotal).toBe(4);
  });

  it("미응답 문항은 합계/평균에서 제외", () => {
    const result = scoreScale({
      versionMinScore: 1,
      versionMaxScore: 5,
      questions: [q("q1"), q("q2"), q("q3")],
      rawScores: { q1: 5, q2: null, q3: undefined },
    });
    expect(result.completedQuestionCount).toBe(1);
    expect(result.convertedTotal).toBe(5);
    expect(result.averageScore).toBe(5);
  });

  it("하위요인별 점수 집계", () => {
    const result = scoreScale({
      versionMinScore: 1,
      versionMaxScore: 5,
      questions: [
        q("q1", { subfactorId: "sfA" }),
        q("q2", { subfactorId: "sfA", isReverse: true }),
        q("q3", { subfactorId: "sfB" }),
      ],
      rawScores: { q1: 4, q2: 2, q3: 3 },
    });
    const sfA = result.subfactorScores.find((s) => s.subfactorId === "sfA")!;
    const sfB = result.subfactorScores.find((s) => s.subfactorId === "sfB")!;
    // sfA: 4 + (6-2)=4 → total 8, avg 4
    expect(sfA.totalScore).toBe(8);
    expect(sfA.averageScore).toBe(4);
    expect(sfA.completedQuestionCount).toBe(2);
    // sfB: 3
    expect(sfB.totalScore).toBe(3);
  });

  it("문항 단위 범위가 척도 버전 범위를 덮어쓴다", () => {
    const result = scoreScale({
      versionMinScore: 1,
      versionMaxScore: 5,
      questions: [q("q1", { isReverse: true, minScore: 0, maxScore: 6 })],
      rawScores: { q1: 0 },
    });
    // 0~6 역문항: 6+0-0 = 6
    expect(result.convertedTotal).toBe(6);
  });
});

describe("findUnansweredActiveQuestions (필수 응답 검증)", () => {
  it("미응답 활성 문항 id 반환", () => {
    const questions = [q("q1"), q("q2"), q("q3", { isActive: false })];
    const unanswered = findUnansweredActiveQuestions(questions, {
      q1: { rawScore: 3 },
    });
    expect(unanswered).toEqual(["q2"]); // q3 비활성이라 제외
  });

  it("선택 응답(isRequired=false)은 미응답이어도 제외", () => {
    const questions = [q("q1"), q("q2", { isRequired: false })];
    expect(findUnansweredActiveQuestions(questions, { q1: { rawScore: 1 } })).toEqual([]);
  });

  it("줄글/체크박스 유형 응답 판정", () => {
    const questions = [
      q("t1", { type: "TEXT" }),
      q("m1", { type: "MULTIPLE", minSelect: 2 }),
    ];
    // 줄글 비어있음, 체크박스 1개(최소 2 미달) → 둘 다 미응답
    expect(
      findUnansweredActiveQuestions(questions, {
        t1: { textValue: "  " },
        m1: { selectedValues: [1] },
      }),
    ).toEqual(["t1", "m1"]);
    // 충족 시 빈 배열
    expect(
      findUnansweredActiveQuestions(questions, {
        t1: { textValue: "응답" },
        m1: { selectedValues: [1, 2] },
      }),
    ).toEqual([]);
  });

  it("모두 응답하면 빈 배열", () => {
    const questions = [q("q1"), q("q2")];
    expect(
      findUnansweredActiveQuestions(questions, {
        q1: { rawScore: 1 },
        q2: { rawScore: 2 },
      }),
    ).toEqual([]);
  });
});
