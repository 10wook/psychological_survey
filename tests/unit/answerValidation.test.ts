import { describe, it, expect } from "vitest";
import { normalizeAndValidateAnswer } from "@/lib/answerValidation";

type Q = Parameters<typeof normalizeAndValidateAnswer>[0];

function makeQuestion(partial: Partial<Q>): Q {
  return {
    id: "q1",
    code: "Q1",
    type: "LIKERT",
    minScore: null,
    maxScore: null,
    minSelect: null,
    maxSelect: null,
    scaleVersion: { minScore: 1, maxScore: 5 },
    options: [],
    ...partial,
  } as Q;
}

describe("normalizeAndValidateAnswer - SINGLE 문항 (이슈 #14)", () => {
  const degree = makeQuestion({
    code: "Degree",
    type: "SINGLE",
    options: [1, 2, 3, 4, 5, 6].map((value) => ({ value })),
  });

  it("보기 값이 리커트 범위(1~5)를 벗어나도 등록된 선택지이면 저장된다", () => {
    const result = normalizeAndValidateAnswer(degree, {
      questionId: "q1",
      rawScore: 6,
    });
    expect(result.rawScore).toBe(6);
    expect(result.isEmpty).toBe(false);
  });

  it("등록되지 않은 보기 값은 거부한다", () => {
    expect(() =>
      normalizeAndValidateAnswer(degree, { questionId: "q1", rawScore: 7 }),
    ).toThrow(/유효하지 않은 선택지/);
  });

  it("미응답(null)은 isEmpty 로 정규화된다", () => {
    const result = normalizeAndValidateAnswer(degree, {
      questionId: "q1",
      rawScore: null,
    });
    expect(result.isEmpty).toBe(true);
  });
});

describe("normalizeAndValidateAnswer - LIKERT 문항", () => {
  const likert = makeQuestion({
    code: "L1",
    type: "LIKERT",
    options: [1, 2, 3, 4, 5].map((value) => ({ value })),
  });

  it("범위 내 값은 통과한다", () => {
    const result = normalizeAndValidateAnswer(likert, {
      questionId: "q1",
      rawScore: 3,
    });
    expect(result.rawScore).toBe(3);
  });

  it("선택지에 없는 값은 거부한다", () => {
    expect(() =>
      normalizeAndValidateAnswer(likert, { questionId: "q1", rawScore: 6 }),
    ).toThrow(/유효하지 않은 선택지/);
  });

  it("선택지가 없는 LIKERT 문항은 척도 범위로 검증한다", () => {
    const noOptions = makeQuestion({ code: "L2", type: "LIKERT", options: [] });
    expect(() =>
      normalizeAndValidateAnswer(noOptions, { questionId: "q1", rawScore: 6 }),
    ).toThrow(/허용 범위/);
    const ok = normalizeAndValidateAnswer(noOptions, {
      questionId: "q1",
      rawScore: 5,
    });
    expect(ok.rawScore).toBe(5);
  });
});
