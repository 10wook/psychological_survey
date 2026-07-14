import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { canViewPii, requireStaff } from "@/lib/auth";
import { handler, notFound, ok } from "@/lib/http";

type Params = { params: Promise<{ responseId: string }> };

// 개별 응답 상세 (문서 6.15). PII 는 권한 있는 관리자만.
export const GET = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { responseId } = await params;
  const wantsPii = new URL(req.url).searchParams.get("pii") === "1" && canViewPii(user);

  const response = await prisma.surveyResponse.findUnique({
    where: { id: responseId },
    include: {
      participant: { include: { user: { include: { profile: true } } } },
      survey: {
        include: {
          surveyScales: {
            orderBy: { displayOrder: "asc" },
            include: {
              scaleVersion: {
                include: { scale: true, subfactors: true, questions: true },
              },
            },
          },
        },
      },
      answers: true,
      scaleResults: { include: { scaleVersion: { include: { scale: true } } } },
      subfactorResults: { include: { subfactor: true } },
    },
  });
  if (!response) throw notFound("응답을 찾을 수 없습니다.");

  const answerMap = new Map(response.answers.map((a) => [a.questionId, a]));
  const order = (response.questionOrderJson ?? {}) as Record<string, string[]>;

  const scales = response.survey.surveyScales.map((ss) => {
    const version = ss.scaleVersion;
    const presented = order[ss.scaleVersionId] ?? [];
    const presentedIndex = new Map(presented.map((id, i) => [id, i + 1]));
    const questions = version.questions
      .filter((q) => q.isActive)
      .map((q) => {
        const a = answerMap.get(q.id);
        return {
          code: q.code,
          content: q.content,
          isReverse: q.isReverse,
          presentedOrder: presentedIndex.get(q.id) ?? null,
          rawScore: a?.rawScore ?? null,
          convertedScore: a?.convertedScore ?? null,
        };
      });
    const scaleResult = response.scaleResults.find((r) => r.scaleVersionId === version.id);
    const subfactorIds = new Set(version.subfactors.map((s) => s.id));
    const subfactors = response.subfactorResults
      .filter((r) => subfactorIds.has(r.subfactorId))
      .map((r) => ({
        name: r.subfactor.name,
        totalScore: r.totalScore,
        averageScore: Number(r.averageScore.toFixed(2)),
      }));

    return {
      scaleName: version.scale.name,
      versionNumber: version.versionNumber,
      questions: questions.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
      scaleResult: scaleResult
        ? {
            rawTotal: scaleResult.rawTotal,
            convertedTotal: scaleResult.convertedTotal,
            averageScore: Number(scaleResult.averageScore.toFixed(2)),
          }
        : null,
      subfactors,
    };
  });

  return ok({
    response: {
      id: response.id,
      anonymousCode: response.participant.anonymousCode,
      status: response.status,
      startedAt: response.startedAt,
      completedAt: response.completedAt,
      durationSeconds: response.durationSeconds,
      demographics: wantsPii
        ? {
            email: response.participant.user?.email ?? null,
            birthYear: response.participant.user?.profile?.birthYear ?? null,
            gender: response.participant.user?.profile?.gender ?? null,
          }
        : null,
      scales,
    },
  });
});
