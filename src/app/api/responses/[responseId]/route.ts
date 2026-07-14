import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { forbidden, handler, notFound, ok } from "@/lib/http";

type Params = { params: Promise<{ responseId: string }> };

// 응답 로드 (문서 6.10 이어하기). 저장된 문항 순서대로 문항을 구성해 반환.
export const GET = handler(async (_req: NextRequest, { params }: Params) => {
  const user = await requireUser();
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
  if (response.participant.userId !== user.id) throw forbidden();

  const order = (response.questionOrderJson ?? {}) as Record<string, string[]>;
  const answerMap = new Map(response.answers.map((a) => [a.questionId, a.rawScore]));

  const scales = response.survey.surveyScales.map((ss) => {
    const version = ss.scaleVersion;
    const questionById = new Map(version.questions.map((q) => [q.id, q]));
    const orderedIds = order[ss.scaleVersionId] ??
      version.questions.filter((q) => q.isActive).map((q) => q.id);

    const questions = orderedIds
      .map((id) => questionById.get(id))
      .filter((q): q is NonNullable<typeof q> => Boolean(q) && q!.isActive)
      .map((q) => ({
        id: q.id,
        code: q.code,
        content: q.content,
        rawScore: answerMap.get(q.id) ?? null,
        options: q.options.map((o) => ({ value: o.value, label: o.label })),
      }));

    return {
      surveyScaleId: ss.id,
      scaleVersionId: version.id,
      scaleName: version.scale.name,
      isRequired: ss.isRequired,
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
