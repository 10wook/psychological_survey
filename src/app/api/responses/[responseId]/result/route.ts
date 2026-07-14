import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, forbidden, handler, notFound, ok } from "@/lib/http";
import { assertCanAccessResponse } from "@/lib/responseAuth";

type Params = { params: Promise<{ responseId: string }> };

const MIN_FOR_COMPARISON = 5; // 초기 응답 적을 때 전체 평균 비교 숨김 (문서 6.12)

interface Band {
  min: number;
  max: number;
  label: string;
  description?: string;
}

export const GET = handler(async (_req: NextRequest, { params }: Params) => {
  const { responseId } = await params;

  const response = await prisma.surveyResponse.findUnique({
    where: { id: responseId },
    include: {
      participant: true,
      survey: true,
      scaleResults: {
        include: {
          scaleVersion: {
            include: { scale: true, subfactors: true },
          },
        },
      },
      subfactorResults: { include: { subfactor: true } },
    },
  });

  if (!response) throw notFound("응답을 찾을 수 없습니다.");
  await assertCanAccessResponse(response);
  if (response.status !== "COMPLETED") throw badRequest("완료된 응답만 결과를 볼 수 있습니다.");
  if (!response.survey.showResult) throw forbidden("이 설문은 결과를 공개하지 않습니다.");

  const scales = await Promise.all(
    response.scaleResults.map(async (sr) => {
      const version = sr.scaleVersion;
      const config = (version.interpretationConfig ?? null) as { bands?: Band[] } | null;
      const band = config?.bands?.find(
        (b) => sr.convertedTotal >= b.min && sr.convertedTotal <= b.max,
      );

      // 전체 완료 응답의 이 척도 평균 (비교용)
      const agg = await prisma.scaleResult.aggregate({
        where: {
          scaleVersionId: version.id,
          surveyResponse: { surveyId: response.surveyId, status: "COMPLETED" },
        },
        _avg: { convertedTotal: true },
        _count: { _all: true },
      });
      const showComparison = agg._count._all >= MIN_FOR_COMPARISON;

      const subfactorIds = new Set(version.subfactors.map((s) => s.id));
      const subfactors = response.subfactorResults
        .filter((x) => subfactorIds.has(x.subfactorId))
        .map((x) => ({
          name: x.subfactor.name,
          totalScore: x.totalScore,
          averageScore: Number(x.averageScore.toFixed(2)),
        }));

      return {
        scaleName: version.scale.name,
        rawTotal: sr.rawTotal,
        convertedTotal: sr.convertedTotal,
        averageScore: Number(sr.averageScore.toFixed(2)),
        completedQuestionCount: sr.completedQuestionCount,
        interpretation: band ? { label: band.label, description: band.description } : null,
        comparison: showComparison
          ? { overallAverage: Number((agg._avg.convertedTotal ?? 0).toFixed(2)) }
          : null,
        subfactors,
      };
    }),
  );

  return ok({
    result: {
      surveyTitle: response.survey.title,
      completedAt: response.completedAt,
      scales,
      disclaimer:
        "본 결과는 연구 및 참고 목적으로 제공되며, 의학적 또는 임상적 진단을 대체하지 않습니다.",
    },
  });
});
