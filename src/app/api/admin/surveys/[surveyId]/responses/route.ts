import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { canViewPii, requireStaff } from "@/lib/auth";
import { handler, notFound, ok } from "@/lib/http";
import { getMonitoringStats } from "@/lib/surveyStats";
import type { ResponseStatus } from "@prisma/client";

type Params = { params: Promise<{ surveyId: string }> };

// 응답 목록 + 모니터링 지표 (문서 6.13). 상태/기간 필터 지원.
export const GET = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { surveyId } = await params;

  const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
  if (!survey) throw notFound("설문을 찾을 수 없습니다.");

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") as ResponseStatus | null;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const wantsPii = url.searchParams.get("pii") === "1" && canViewPii(user);

  const responses = await prisma.surveyResponse.findMany({
    where: {
      surveyId,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(from || to
        ? {
            startedAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { startedAt: "desc" },
    include: {
      participant: {
        include: { user: { include: { profile: true } } },
      },
    },
  });

  const monitoring = await getMonitoringStats(surveyId);

  return ok({
    monitoring,
    canViewPii: canViewPii(user),
    piiIncluded: wantsPii,
    responses: responses.map((r) => ({
      id: r.id,
      anonymousCode: r.participant.anonymousCode,
      status: r.status,
      startedAt: r.startedAt,
      lastSavedAt: r.lastSavedAt,
      completedAt: r.completedAt,
      durationSeconds: r.durationSeconds,
      pii: wantsPii
        ? {
            email: r.participant.user?.email ?? null,
            birthYear: r.participant.user?.profile?.birthYear ?? null,
            gender: r.participant.user?.profile?.gender ?? null,
          }
        : null,
    })),
  });
});
