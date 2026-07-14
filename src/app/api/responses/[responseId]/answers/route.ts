import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { badRequest, forbidden, handler, notFound, ok } from "@/lib/http";
import { saveAnswersSchema } from "@/lib/validation";
import { isRawScoreInRange } from "@/lib/scoring";

type Params = { params: Promise<{ responseId: string }> };

// 자동 저장 (문서 6.10). upsert + 멱등. 범위 밖 값은 거부.
export const PUT = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireUser();
  const { responseId } = await params;

  const response = await prisma.surveyResponse.findUnique({
    where: { id: responseId },
    include: { participant: true },
  });
  if (!response) throw notFound("응답을 찾을 수 없습니다.");
  if (response.participant.userId !== user.id) throw forbidden();
  if (response.status !== "IN_PROGRESS") {
    throw badRequest("이미 제출되었거나 응답할 수 없는 상태입니다.");
  }

  const { answers } = saveAnswersSchema.parse(await req.json());

  // 문항 범위 로드
  const questionIds = answers.map((a) => a.questionId);
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    include: { scaleVersion: { select: { minScore: true, maxScore: true } } },
  });
  const qMap = new Map(questions.map((q) => [q.id, q]));

  for (const a of answers) {
    const q = qMap.get(a.questionId);
    if (!q) throw badRequest(`존재하지 않는 문항입니다: ${a.questionId}`);
    if (a.rawScore !== null) {
      const min = q.minScore ?? q.scaleVersion.minScore;
      const max = q.maxScore ?? q.scaleVersion.maxScore;
      if (!isRawScoreInRange(a.rawScore, min, max)) {
        throw badRequest(`응답값이 허용 범위(${min}~${max})를 벗어났습니다: ${q.code}`);
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const a of answers) {
      if (a.rawScore === null) {
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
          },
          update: { rawScore: a.rawScore },
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
