import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { badRequest, handler, notFound, ok } from "@/lib/http";
import { writeAudit, getClientIp } from "@/lib/audit";
import { assertOwnsSurvey } from "@/lib/ownership";

type Params = { params: Promise<{ surveyId: string }> };

// 설문 종료 (문서 6.7). 종료되면 신규 응답 시작 차단.
export const POST = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { surveyId } = await params;
  await assertOwnsSurvey(user, surveyId);

  const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
  if (!survey) throw notFound("설문을 찾을 수 없습니다.");
  if (survey.status !== "PUBLISHED") throw badRequest("게시된 설문만 종료할 수 있습니다.");

  const updated = await prisma.survey.update({
    where: { id: surveyId },
    data: { status: "CLOSED" },
  });

  await writeAudit({
    actorUserId: user.id,
    entityType: "Survey",
    entityId: surveyId,
    action: "SURVEY_CLOSED",
    ipAddress: getClientIp(req),
  });

  return ok({ survey: updated });
});
