import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { badRequest, handler, notFound, ok } from "@/lib/http";
import { writeAudit, getClientIp } from "@/lib/audit";
import { assertOwnsSurvey } from "@/lib/ownership";

type Params = { params: Promise<{ surveyId: string }> };

// 종료된 설문을 다시 게시(진행 중) 상태로 되돌린다.
export const POST = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { surveyId } = await params;
  await assertOwnsSurvey(user, surveyId);

  const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
  if (!survey) throw notFound("설문을 찾을 수 없습니다.");
  if (survey.status !== "CLOSED") {
    throw badRequest("종료된 설문만 다시 게시할 수 있습니다.");
  }

  const updated = await prisma.survey.update({
    where: { id: surveyId },
    data: { status: "PUBLISHED", publishedAt: survey.publishedAt ?? new Date() },
  });

  await writeAudit({
    actorUserId: user.id,
    entityType: "Survey",
    entityId: surveyId,
    action: "SURVEY_REOPENED",
    ipAddress: getClientIp(req),
  });

  return ok({ survey: updated });
});
