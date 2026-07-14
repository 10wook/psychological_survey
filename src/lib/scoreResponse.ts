import type { Prisma, PrismaClient } from "@prisma/client";
import { scoreScale, type ScoringQuestion } from "@/lib/scoring";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * 하나의 설문 응답을 채점하고 결과를 저장한다 (문서 6.11 / 10장).
 * - Answer.convertedScore 갱신
 * - ScaleResult / SubfactorResult upsert
 * 트랜잭션 내에서 호출할 것.
 */
export async function scoreAndSaveResponse(tx: Tx, responseId: string): Promise<void> {
  const response = await tx.surveyResponse.findUnique({
    where: { id: responseId },
    include: {
      answers: true,
      survey: {
        include: {
          surveyScales: {
            include: {
              scaleVersion: {
                include: { questions: true },
              },
            },
          },
        },
      },
    },
  });
  if (!response) return;

  const rawByQuestion = new Map<string, number>();
  for (const a of response.answers) {
    if (a.rawScore !== null && a.rawScore !== undefined) {
      rawByQuestion.set(a.questionId, a.rawScore);
    }
  }

  // 기존 결과 제거 후 재계산 (재계산 API 지원 - 문서 6.5)
  await tx.scaleResult.deleteMany({ where: { surveyResponseId: responseId } });
  await tx.subfactorResult.deleteMany({ where: { surveyResponseId: responseId } });

  for (const ss of response.survey.surveyScales) {
    const version = ss.scaleVersion;
    const questions: ScoringQuestion[] = version.questions.map((q) => ({
      id: q.id,
      isReverse: q.isReverse,
      isActive: q.isActive,
      subfactorId: q.subfactorId,
      minScore: q.minScore,
      maxScore: q.maxScore,
    }));

    const rawScores: Record<string, number | null> = {};
    for (const q of version.questions) {
      rawScores[q.id] = rawByQuestion.has(q.id) ? rawByQuestion.get(q.id)! : null;
    }

    const result = scoreScale({
      versionMinScore: version.minScore,
      versionMaxScore: version.maxScore,
      questions,
      rawScores,
    });

    // 문항별 변환점수 저장
    for (const qs of result.questionScores) {
      await tx.answer.updateMany({
        where: { surveyResponseId: responseId, questionId: qs.questionId },
        data: { convertedScore: qs.convertedScore },
      });
    }

    if (result.completedQuestionCount > 0) {
      await tx.scaleResult.create({
        data: {
          surveyResponseId: responseId,
          scaleVersionId: version.id,
          rawTotal: result.rawTotal,
          convertedTotal: result.convertedTotal,
          averageScore: result.averageScore,
          completedQuestionCount: result.completedQuestionCount,
        },
      });
    }

    for (const sf of result.subfactorScores) {
      await tx.subfactorResult.create({
        data: {
          surveyResponseId: responseId,
          subfactorId: sf.subfactorId,
          totalScore: sf.totalScore,
          averageScore: sf.averageScore,
          completedQuestionCount: sf.completedQuestionCount,
        },
      });
    }
  }
}
