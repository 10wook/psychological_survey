import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { badRequest, forbidden, handler, notFound, ok } from "@/lib/http";
import { writeAudit, getClientIp } from "@/lib/audit";

type Params = { params: Promise<{ surveyId: string }> };

// 설문 잠금 해제. 응답이 있으면 차단. 허용 시 CLOSED 로 되돌림.
export const POST = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { surveyId } = await params;

  const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
  if (!survey) throw notFound("설문을 찾을 수 없습니다.");
  if (survey.status !== "LOCKED") {
    throw badRequest("잠긴(LOCKED) 설문만 잠금 해제할 수 있습니다.");
  }

  const responseCount = await prisma.surveyResponse.count({ where: { surveyId } });
  if (responseCount > 0) {
    throw forbidden(
      "응답이 있는 설문은 잠금 해제할 수 없습니다. 척도를 수정하려면 새 척도 버전을 만들어 새 설문에 연결하세요.",
    );
  }

  const updated = await prisma.survey.update({
    where: { id: surveyId },
    data: { status: "CLOSED", lockedAt: null },
  });

  await writeAudit({
    actorUserId: user.id,
    entityType: "Survey",
    entityId: surveyId,
    action: "SURVEY_UNLOCKED",
    ipAddress: getClientIp(req),
  });

  return ok({ survey: updated });
});
