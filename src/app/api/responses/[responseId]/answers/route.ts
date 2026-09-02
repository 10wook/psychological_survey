import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, handler, notFound, ok } from "@/lib/http";
import { saveAnswersSchema } from "@/lib/validation";
import { assertCanAccessResponse } from "@/lib/responseAuth";
import { normalizeAndValidateAnswer } from "@/lib/answerValidation";

type Params = { params: Promise<{ responseId: string }> };

export const preferredRegion = "icn1";
export const runtime = "nodejs";
/** 제출 직전 전체 답변 저장은 원격 DB 왕복이 있어 Hobby 기본 10초를 넘길 수 있다 (이슈 #24). */
export const maxDuration = 60;

// 자동 저장. 삭제 후 일괄 생성 + 멱등. 유형별 검증.
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

  // 문항별 upsert 루프는 문항 수만큼 DB 왕복이 생겨, 제출 직전 전체 저장
  // (80문항 이상)에서 interactive transaction 기본 5초를 초과해 500 오류를
  // 만든다 (이슈 #22, #24). 대상 문항을 한 번에 지우고 빈 답변을 제외해
  // 일괄 생성하면 문항 수와 무관하게 상수 회 왕복으로 저장된다.
  const toCreate = normalized.filter((a) => !a.isEmpty);
  await prisma.$transaction([
    prisma.answer.deleteMany({
      where: { surveyResponseId: responseId, questionId: { in: questionIds } },
    }),
    ...(toCreate.length > 0
      ? [
          prisma.answer.createMany({
            data: toCreate.map((a) => ({
              surveyResponseId: responseId,
              questionId: a.questionId,
              rawScore: a.rawScore,
              textValue: a.textValue,
              selectedValues: a.selectedValues,
            })),
          }),
        ]
      : []),
    prisma.surveyResponse.update({
      where: { id: responseId },
      data: { lastSavedAt: new Date() },
    }),
  ]);

  return ok({ saved: true, savedAt: new Date().toISOString() });
});
