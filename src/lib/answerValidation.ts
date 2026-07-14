import type { Question, QuestionOption } from "@prisma/client";
import { badRequest } from "@/lib/http";
import { isRawScoreInRange } from "@/lib/scoring";

type Q = Pick<
  Question,
  "id" | "code" | "type" | "minScore" | "maxScore" | "minSelect" | "maxSelect"
> & {
  scaleVersion: { minScore: number; maxScore: number };
  options: Pick<QuestionOption, "value">[];
};

export interface SaveAnswerInput {
  questionId: string;
  rawScore?: number | null;
  textValue?: string | null;
  selectedValues?: number[];
}

export interface NormalizedAnswer {
  rawScore: number | null;
  textValue: string | null;
  selectedValues: number[];
  isEmpty: boolean;
}

/** 유형별 입력 검증 후 DB 저장 형태로 정규화 */
export function normalizeAndValidateAnswer(
  q: Q,
  input: SaveAnswerInput,
): NormalizedAnswer {
  const optionValues = new Set(q.options.map((o) => o.value));

  switch (q.type) {
    case "TEXT": {
      const text = input.textValue?.trim() ?? "";
      return {
        rawScore: null,
        textValue: text.length > 0 ? text : null,
        selectedValues: [],
        isEmpty: text.length === 0,
      };
    }
    case "MULTIPLE": {
      const selected = [...new Set(input.selectedValues ?? [])].sort((a, b) => a - b);
      for (const v of selected) {
        if (!optionValues.has(v)) {
          throw badRequest(`유효하지 않은 선택지입니다: ${q.code}`);
        }
      }
      if (selected.length > 0) {
        if (q.minSelect != null && selected.length < q.minSelect) {
          throw badRequest(`${q.code}: 최소 ${q.minSelect}개 선택해야 합니다.`);
        }
        if (q.maxSelect != null && selected.length > q.maxSelect) {
          throw badRequest(`${q.code}: 최대 ${q.maxSelect}개까지 선택할 수 있습니다.`);
        }
      }
      return {
        rawScore: null,
        textValue: null,
        selectedValues: selected,
        isEmpty: selected.length === 0,
      };
    }
    case "SINGLE":
    case "LIKERT":
    default: {
      const raw = input.rawScore;
      if (raw === null || raw === undefined) {
        return { rawScore: null, textValue: null, selectedValues: [], isEmpty: true };
      }
      if (optionValues.size > 0 && !optionValues.has(raw)) {
        throw badRequest(`유효하지 않은 선택지입니다: ${q.code}`);
      }
      const min = q.minScore ?? q.scaleVersion.minScore;
      const max = q.maxScore ?? q.scaleVersion.maxScore;
      if (!isRawScoreInRange(raw, min, max)) {
        throw badRequest(`응답값이 허용 범위(${min}~${max})를 벗어났습니다: ${q.code}`);
      }
      return { rawScore: raw, textValue: null, selectedValues: [], isEmpty: false };
    }
  }
}
