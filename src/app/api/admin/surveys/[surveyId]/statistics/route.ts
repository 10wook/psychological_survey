import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handler, notFound, ok } from "@/lib/http";
import { getMonitoringStats, getSurveyStatistics } from "@/lib/surveyStats";

type Params = { params: Promise<{ surveyId: string }> };

// 기술통계 (문서 6.14). 완료 응답 기준.
export const GET = handler(async (_req: NextRequest, { params }: Params) => {
  await requireStaff();
  const { surveyId } = await params;

  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    select: { id: true, title: true },
  });
  if (!survey) throw notFound("설문을 찾을 수 없습니다.");

  const [monitoring, statistics] = await Promise.all([
    getMonitoringStats(surveyId),
    getSurveyStatistics(surveyId),
  ]);

  return ok({ survey, monitoring, statistics });
});
