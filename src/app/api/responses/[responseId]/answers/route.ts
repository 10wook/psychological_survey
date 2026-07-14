import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, handler, notFound, ok } from "@/lib/http";
import { saveAnswersSchema } from "@/lib/validation";
import { assertCanAccessResponse } from "@/lib/responseAuth";
import { normalizeAndValidateAnswer } from "@/lib/answerValidation";

type Params = { params: Promise<{ responseId: string }> };

// 자동 저장. upsert + 멱등. 유형별 검증.
export const PUT = handler(async (req: NextRequest, { params }: Params) => {
  const { responseId } = await params;

  const response = await prisma.surveyResponse.findUnique({
    where: { id: responseId },
    include: { participant: true },
  });
  if (!response) throw notFound("응답을 찾을 수 없습니다.");
  await assertCanAccessResponse(response);
  if (response.status !== "IN_PROGRESS") {
    throw badRequest("이미 제출되었거나 응답할 수 없는 상태입니다.");
  }

  const { answers } = saveAnswersSchema.parse(await req.json());
  const questionIds = answers.map((a) => a.questionId);
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    include: {
      options: true,
      scaleVersion: { select: { minScore: true, maxScore: true } },
    },
  });
  const qMap = new Map(questions.map((q) => [q.id, q]));

  const normalized = answers.map((a) => {
    const q = qMap.get(a.questionId);
    if (!q) throw badRequest(`존재하지 않는 문항입니다: ${a.questionId}`);
    return { questionId: a.questionId, ...normalizeAndValidateAnswer(q, a) };
  });

  await prisma.$transaction(async (tx) => {
    for (const a of normalized) {
      if (a.isEmpty) {
        await tx.answer.deleteMany({
          where: { surveyResponseId: responseId, questionId: a.questionId },
        });
      } else {
        await tx.answer.upsert({
          where: {
            surveyResponseId_questionId: {
              surveyResponseId: responseId,
              questionId: a.questionId,
            },
          },
          create: {
            surveyResponseId: responseId,
            questionId: a.questionId,
            rawScore: a.rawScore,
            textValue: a.textValue,
            selectedValues: a.selectedValues,
          },
          update: {
            rawScore: a.rawScore,
            textValue: a.textValue,
            selectedValues: a.selectedValues,
          },
        });
      }
    }
    await tx.surveyResponse.update({
      where: { id: responseId },
      data: { lastSavedAt: new Date() },
    });
  });

  return ok({ saved: true, savedAt: new Date().toISOString() });
});
