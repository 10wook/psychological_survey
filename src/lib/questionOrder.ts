import { buildQuestionOrder, shuffle, type OrderableQuestion } from "@/lib/shuffle";

// ===========================================================================
// 문항 제시 순서 계획 (questionOrderJson).
//
// 응답 시작 시 한 번만 계산되어 SurveyResponse.questionOrderJson 에 저장된다.
// v2 구조: 제시 "섹션" 목록. 섹션은 하나의 척도이거나(surveyScaleId != null),
// 여러 척도를 합쳐 전체 셔플한 병합 섹션(surveyScaleId == null)이다.
//
// 채점/제출 검증은 문항 ID 기준이라 제시 순서/그룹핑과 무관하다.
// 과거(v1) 응답은 { [scaleVersionId]: string[] } 형태이며 하위 호환으로 처리한다.
// ===========================================================================

export type QuestionOrderMode = "SCALE_GROUPED" | "SHUFFLE_ALL";

export interface OrderSection {
  /** 병합(전체 셔플) 섹션이면 null */
  surveyScaleId: string | null;
  scaleVersionId: string | null;
  isRequired: boolean;
  questionIds: string[];
}

export interface QuestionOrderV2 {
  v: 2;
  mode: QuestionOrderMode;
  sections: OrderSection[];
}

type QuestionOrderV1 = Record<string, string[]>;

export interface OrderInputScale {
  surveyScaleId: string;
  scaleVersionId: string;
  isRequired: boolean;
  shuffleQuestions: boolean;
  includeInGlobalShuffle: boolean;
  scaleVersion: {
    shuffleQuestions: boolean;
    questions: OrderableQuestion[];
  };
}

function isV2(json: unknown): json is QuestionOrderV2 {
  return (
    typeof json === "object" &&
    json !== null &&
    (json as { v?: unknown }).v === 2 &&
    Array.isArray((json as { sections?: unknown }).sections)
  );
}

/** 응답 시작 시 제시 계획 생성. seed 로 결정적(재현 가능) 셔플. */
export function buildOrderPlan(
  mode: QuestionOrderMode,
  scales: OrderInputScale[],
  seed: string,
): QuestionOrderV2 {
  const groupedSection = (ss: OrderInputScale): OrderSection => ({
    surveyScaleId: ss.surveyScaleId,
    scaleVersionId: ss.scaleVersionId,
    isRequired: ss.isRequired,
    questionIds: buildQuestionOrder(
      ss.scaleVersion.questions,
      ss.shuffleQuestions || ss.scaleVersion.shuffleQuestions,
      `${seed}:${ss.scaleVersionId}`,
    ),
  });

  if (mode === "SHUFFLE_ALL") {
    const included = scales.filter((s) => s.includeInGlobalShuffle);
    // 포함된 척도가 2개 미만이면 사실상 척도별 묶음과 동일 → 병합 섹션 불필요.
    if (included.length >= 1) {
      const pool: string[] = [];
      let mergedRequired = false;
      for (const ss of included) {
        for (const id of buildQuestionOrder(ss.scaleVersion.questions, false)) {
          pool.push(id);
        }
        if (ss.isRequired) mergedRequired = true;
      }
      const mergedIds = shuffle(pool, `${seed}:__all__`);
      const mergedSection: OrderSection = {
        surveyScaleId: null,
        scaleVersionId: null,
        isRequired: mergedRequired,
        questionIds: mergedIds,
      };

      const sections: OrderSection[] = [];
      let mergedInserted = false;
      for (const ss of scales) {
        if (ss.includeInGlobalShuffle) {
          if (!mergedInserted) {
            sections.push(mergedSection);
            mergedInserted = true;
          }
          continue;
        }
        sections.push(groupedSection(ss));
      }
      return { v: 2, mode, sections };
    }
  }

  return { v: 2, mode: "SCALE_GROUPED", sections: scales.map(groupedSection) };
}

/** 저장된 순서를 v2 섹션 목록으로 정규화. v1(과거) 응답도 처리. */
export function readOrderSections(
  stored: unknown,
  scales: OrderInputScale[],
): OrderSection[] {
  if (isV2(stored)) return stored.sections;

  const v1 = (stored ?? {}) as QuestionOrderV1;
  return scales.map((ss) => ({
    surveyScaleId: ss.surveyScaleId,
    scaleVersionId: ss.scaleVersionId,
    isRequired: ss.isRequired,
    questionIds:
      v1[ss.scaleVersionId] ??
      buildQuestionOrder(ss.scaleVersion.questions, false),
  }));
}

/** 문항 ID → 전체 제시 순번(1-base). export/통계용. v1/v2 모두 처리. */
export function presentedIndexMap(stored: unknown): Map<string, number> {
  const map = new Map<string, number>();
  if (isV2(stored)) {
    let i = 0;
    for (const section of stored.sections) {
      for (const id of section.questionIds) map.set(id, ++i);
    }
    return map;
  }
  const v1 = (stored ?? {}) as QuestionOrderV1;
  for (const ids of Object.values(v1)) {
    ids.forEach((id, i) => map.set(id, i + 1));
  }
  return map;
}
