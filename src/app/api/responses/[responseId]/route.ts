import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { handler, notFound, ok } from "@/lib/http";
import { assertCanAccessResponse } from "@/lib/responseAuth";
import { scaleDisplayLabel } from "@/lib/scaleDisplay";
import { readOrderSections, type OrderInputScale } from "@/lib/questionOrder";

type Params = { params: Promise<{ responseId: string }> };

// 응답 로드 (문서 6.10 이어하기). 저장된 문항 순서대로 문항을 구성해 반환.
export const GET = handler(async (_req: NextRequest, { params }: Params) => {
  const { responseId } = await params;

  const response = await prisma.surveyResponse.findUnique({
    where: { id: responseId },
    include: {
      participant: true,
      answers: true,
      survey: {
        include: {
          surveyScales: {
            orderBy: { displayOrder: "asc" },
            include: {
              scaleVersion: {
                include: {
                  scale: true,
                  questions: {
                    include: { options: { orderBy: { displayOrder: "asc" } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!response) throw notFound("응답을 찾을 수 없습니다.");
  await assertCanAccessResponse(response);

  const answerMap = new Map(response.answers.map((a) => [a.questionId, a]));
  const surveyScales = response.survey.surveyScales;

  // 문항 ID → { 문항, 소속 척도 } 전역 매핑 (전체 셔플 병합 섹션 조회용)
  type LoadedQuestion = (typeof surveyScales)[number]["scaleVersion"]["questions"][number];
  const questionById = new Map<string, LoadedQuestion>();
  const scaleLabelById = new Map<string, string>();
  for (const ss of surveyScales) {
    scaleLabelById.set(
      ss.id,
      scaleDisplayLabel(ss.displayMode, {
        name: ss.scaleVersion.scale.name,
        description: ss.scaleVersion.scale.description,
        displayLabel: ss.displayLabel,
      }),
    );
    for (const q of ss.scaleVersion.questions) questionById.set(q.id, q);
  }

  const orderInputs: OrderInputScale[] = surveyScales.map((ss) => ({
    surveyScaleId: ss.id,
    scaleVersionId: ss.scaleVersionId,
    isRequired: ss.isRequired,
    shuffleQuestions: ss.shuffleQuestions,
    includeInGlobalShuffle: ss.includeInGlobalShuffle,
    scaleVersion: {
      shuffleQuestions: ss.scaleVersion.shuffleQuestions,
      questions: ss.scaleVersion.questions,
    },
  }));

  const sections = readOrderSections(response.questionOrderJson, orderInputs);

  const scales = sections.map((section) => {
    const questions = section.questionIds
      .map((id) => questionById.get(id))
      .filter((q): q is LoadedQuestion => Boolean(q) && q!.isActive)
      .map((q) => {
        const a = answerMap.get(q.id);
        return {
          id: q.id,
          code: q.code,
          content: q.content,
          type: q.type,
          isRequired: q.isRequired,
          minSelect: q.minSelect,
          maxSelect: q.maxSelect,
          rawScore: a?.rawScore ?? null,
          textValue: a?.textValue ?? null,
          selectedValues: a?.selectedValues ?? [],
          options: q.options.map((o) => ({ value: o.value, label: o.label })),
        };
      });

    return {
      surveyScaleId: section.surveyScaleId,
      scaleVersionId: section.scaleVersionId,
      // 병합(전체 셔플) 섹션은 척도명을 노출하지 않는다.
      scaleName: section.surveyScaleId
        ? scaleLabelById.get(section.surveyScaleId) ?? null
        : null,
      isRequired: section.isRequired,
      questions,
    };
  });

  return ok({
    response: {
      id: response.id,
      status: response.status,
      surveyTitle: response.survey.title,
      instructions: response.survey.instructions,
      showResult: response.survey.showResult,
      scales,
    },
  });
});
