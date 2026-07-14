// ===========================================================================
// 채점 도메인 로직 (순수 함수).
// UI / DB 에 의존하지 않는다. API·내보내기·테스트가 동일 모듈을 공유한다.
// 문서 6.5 / 10장 규칙 구현.
// ===========================================================================

export type QuestionKind = "LIKERT" | "SINGLE" | "MULTIPLE" | "TEXT";

export interface ScoringQuestion {
  id: string;
  type: QuestionKind;
  isReverse: boolean;
  isActive: boolean;
  isRequired: boolean;
  subfactorId: string | null;
  /** 문항 단위 범위. null 이면 척도 버전 min/max 상속 */
  minScore: number | null;
  maxScore: number | null;
  /** 체크박스(MULTIPLE) 선택 개수 제한 */
  minSelect?: number | null;
  maxSelect?: number | null;
}

/** 한 문항에 대한 응답 값 (유형별로 다른 필드 사용) */
export interface AnswerValue {
  rawScore?: number | null;
  textValue?: string | null;
  selectedValues?: number[];
}

/** 문항 유형에 맞춰 실제로 응답이 되었는지 판정 */
export function isQuestionAnswered(
  q: Pick<ScoringQuestion, "type" | "minSelect">,
  a: AnswerValue | undefined,
): boolean {
  if (!a) return false;
  switch (q.type) {
    case "TEXT":
      return typeof a.textValue === "string" && a.textValue.trim().length > 0;
    case "MULTIPLE": {
      const n = a.selectedValues?.length ?? 0;
      if (n === 0) return false;
      if (q.minSelect != null && n < q.minSelect) return false;
      return true;
    }
    case "SINGLE":
    case "LIKERT":
    default:
      return a.rawScore !== null && a.rawScore !== undefined;
  }
}

export interface ScoringInput {
  /** 척도 버전 기본 응답 범위 */
  versionMinScore: number;
  versionMaxScore: number;
  questions: ScoringQuestion[];
  /** questionId -> 원점수(raw). 미응답이면 키 없음 */
  rawScores: Record<string, number | null | undefined>;
}

export interface QuestionScore {
  questionId: string;
  rawScore: number;
  convertedScore: number;
  isReverse: boolean;
}

export interface SubfactorScore {
  subfactorId: string;
  totalScore: number;
  averageScore: number;
  completedQuestionCount: number;
}

export interface ScaleScoreResult {
  rawTotal: number;
  convertedTotal: number;
  averageScore: number;
  completedQuestionCount: number;
  questionScores: QuestionScore[];
  subfactorScores: SubfactorScore[];
}

/**
 * 역문항 변환 점수 계산.
 * convertedScore = maxScore + minScore - rawScore
 * 일반 문항은 원점수와 동일.
 */
export function convertScore(
  rawScore: number,
  isReverse: boolean,
  minScore: number,
  maxScore: number,
): number {
  if (!isReverse) return rawScore;
  return maxScore + minScore - rawScore;
}

/** 원점수가 문항 허용 범위 안에 있는지 검증 */
export function isRawScoreInRange(
  rawScore: number,
  minScore: number,
  maxScore: number,
): boolean {
  return Number.isInteger(rawScore) && rawScore >= minScore && rawScore <= maxScore;
}

function resolveRange(
  q: ScoringQuestion,
  versionMin: number,
  versionMax: number,
): { min: number; max: number } {
  return {
    min: q.minScore ?? versionMin,
    max: q.maxScore ?? versionMax,
  };
}

/**
 * 하나의 척도 버전에 대한 채점.
 * - 비활성 문항은 계산에서 제외
 * - 미응답 문항은 합계/평균에서 제외 (완료 응답 수 기준 평균)
 */
export function scoreScale(input: ScoringInput): ScaleScoreResult {
  // 채점 대상은 리커트 문항만. 자유 문항(SINGLE/MULTIPLE/TEXT)은 합계에서 제외.
  const activeQuestions = input.questions.filter(
    (q) => q.isActive && q.type === "LIKERT",
  );

  const questionScores: QuestionScore[] = [];
  let rawTotal = 0;
  let convertedTotal = 0;

  const subfactorAgg = new Map<string, { total: number; count: number }>();

  for (const q of activeQuestions) {
    const raw = input.rawScores[q.id];
    if (raw === null || raw === undefined) continue;

    const { min, max } = resolveRange(q, input.versionMinScore, input.versionMaxScore);
    const converted = convertScore(raw, q.isReverse, min, max);

    questionScores.push({
      questionId: q.id,
      rawScore: raw,
      convertedScore: converted,
      isReverse: q.isReverse,
    });

    rawTotal += raw;
    convertedTotal += converted;

    if (q.subfactorId) {
      const agg = subfactorAgg.get(q.subfactorId) ?? { total: 0, count: 0 };
      agg.total += converted;
      agg.count += 1;
      subfactorAgg.set(q.subfactorId, agg);
    }
  }

  const completedQuestionCount = questionScores.length;
  const averageScore =
    completedQuestionCount > 0 ? convertedTotal / completedQuestionCount : 0;

  const subfactorScores: SubfactorScore[] = [...subfactorAgg.entries()].map(
    ([subfactorId, agg]) => ({
      subfactorId,
      totalScore: agg.total,
      averageScore: agg.count > 0 ? agg.total / agg.count : 0,
      completedQuestionCount: agg.count,
    }),
  );

  return {
    rawTotal,
    convertedTotal,
    averageScore,
    completedQuestionCount,
    questionScores,
    subfactorScores,
  };
}

/**
 * 활성 + 필수 문항 중 응답되지 않은 문항 id 목록 (비어 있으면 완료).
 * 유형별 응답 판정을 사용한다.
 */
export function findUnansweredActiveQuestions(
  questions: ScoringQuestion[],
  answers: Record<string, AnswerValue | undefined>,
): string[] {
  return questions
    .filter((q) => q.isActive && q.isRequired)
    .filter((q) => !isQuestionAnswered(q, answers[q.id]))
    .map((q) => q.id);
}
