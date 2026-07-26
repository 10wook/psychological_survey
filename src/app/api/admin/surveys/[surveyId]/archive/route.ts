import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { badRequest, handler, notFound, ok } from "@/lib/http";
import { writeAudit, getClientIp } from "@/lib/audit";
import { assertOwnsSurvey } from "@/lib/ownership";

type Params = { params: Promise<{ surveyId: string }> };

// 설문 삭제(보관). 물리 삭제 대신 ARCHIVED 로 soft-delete.
export const POST = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { surveyId } = await params;
  await assertOwnsSurvey(user, surveyId);

  const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
  if (!survey) throw notFound("설문을 찾을 수 없습니다.");
  if (survey.status === "PUBLISHED") {
    throw badRequest("진행 중인 설문은 먼저 종료한 뒤 삭제할 수 있습니다.");
  }
  if (survey.status === "ARCHIVED") {
    throw badRequest("이미 삭제된 설문입니다.");
  }

  const updated = await prisma.survey.update({
    where: { id: surveyId },
    data: { status: "ARCHIVED" },
  });

  await writeAudit({
    actorUserId: user.id,
    entityType: "Survey",
    entityId: surveyId,
    action: "SURVEY_ARCHIVED",
    ipAddress: getClientIp(req),
  });

  return ok({ survey: updated });
});
