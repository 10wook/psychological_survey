import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, forbidden, handler, notFound, ok } from "@/lib/http";
import {
  findUnansweredActiveQuestions,
  type AnswerValue,
  type ScoringQuestion,
} from "@/lib/scoring";
import { scoreAndSaveResponse } from "@/lib/scoreResponse";
import { assertCanAccessResponse } from "@/lib/responseAuth";

type Params = { params: Promise<{ responseId: string }> };

export const preferredRegion = "icn1";
export const runtime = "nodejs";
/** 채점 시 원격 DB 왕복이 있어 Hobby 기본 10초를 넘길 수 있다 (이슈 #22). */
export const maxDuration = 60;

// 설문 제출. 서버 재검증 → 채점(LIKERT만) → 결과 저장.
export const POST = handler(async (_req: NextRequest, { params }: Params) => {
  const { responseId } = await params;

  const response = await prisma.surveyResponse.findUnique({
    where: { id: responseId },
    include: {
      participant: true,
      answers: true,
      survey: {
        include: {
          surveyScales: { include: { scaleVersion: { include: { questions: true } } } },
        },
      },
    },
  });
  if (!response) throw notFound("응답을 찾을 수 없습니다.");
  await assertCanAccessResponse(response);
  if (response.status === "COMPLETED") throw badRequest("이미 완료된 응답입니다.");

  const survey = response.survey;
  const now = new Date();
  if (survey.status !== "PUBLISHED") throw forbidden("현재 제출할 수 없는 설문입니다.");
  if (survey.endAt && survey.endAt < now) throw forbidden("종료된 설문입니다.");

  const answerMap: Record<string, AnswerValue> = {};
  for (const a of response.answers) {
    answerMap[a.questionId] = {
      rawScore: a.rawScore,
      textValue: a.textValue,
      selectedValues: a.selectedValues,
    };
  }

  for (const ss of survey.surveyScales) {
    if (!ss.isRequired) continue;
    const questions: ScoringQuestion[] = ss.scaleVersion.questions.map((q) => ({
      id: q.id,
      type: q.type,
      isReverse: q.isReverse,
      isActive: q.isActive,
      isRequired: q.isRequired,
      subfactorId: q.subfactorId,
      minScore: q.minScore,
      maxScore: q.maxScore,
      minSelect: q.minSelect,
      maxSelect: q.maxSelect,
    }));
    const missing = findUnansweredActiveQuestions(questions, answerMap);
    if (missing.length > 0) {
      throw badRequest(
        `필수 척도의 모든 문항에 응답해야 합니다. (미응답 ${missing.length}개)`,
      );
    }
  }

  const durationSeconds = Math.max(
    0,
    Math.round((now.getTime() - response.startedAt.getTime()) / 1000),
  );

  // 긴 interactive transaction 은 Supabase 풀러에서 타임아웃/연결 끊김으로
  // 제출만 실패하고 답변은 남는 '응답 중' 상태를 만든다 (이슈 #22).
  // 채점은 delete+재생성으로 멱등이므로 완료 갱신과 분리해도 재시도 안전하다.
  await scoreAndSaveResponse(prisma, responseId);
  await prisma.surveyResponse.update({
    where: { id: responseId },
    data: {
      status: "COMPLETED",
      completedAt: now,
      lastSavedAt: now,
      durationSeconds,
    },
  });

  return ok({ completed: true, showResult: survey.showResult });
});
