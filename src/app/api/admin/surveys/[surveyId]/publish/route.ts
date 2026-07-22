import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { badRequest, handler, notFound, ok } from "@/lib/http";
import { writeAudit, getClientIp } from "@/lib/audit";
import { assertOwnsSurvey } from "@/lib/ownership";

type Params = { params: Promise<{ surveyId: string }> };

// 설문 게시 (문서 6.7). 최소 1개 척도 연결 필요. 사용된 척도 버전은 잠근다.
export const POST = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { surveyId } = await params;
  await assertOwnsSurvey(user, surveyId);

  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: { surveyScales: true },
  });
  if (!survey) throw notFound("설문을 찾을 수 없습니다.");
  if (survey.status !== "DRAFT") throw badRequest("DRAFT 설문만 게시할 수 있습니다.");
  if (survey.surveyScales.length < 1) {
    throw badRequest("최소 하나의 척도를 연결해야 게시할 수 있습니다.");
  }

  const versionIds = survey.surveyScales.map((s) => s.scaleVersionId);

  const updated = await prisma.$transaction(async (tx) => {
    // 게시된 설문에 사용되는 척도 버전을 잠금 (PUBLISHED → LOCKED)
    await tx.scaleVersion.updateMany({
      where: { id: { in: versionIds }, status: "PUBLISHED" },
      data: { status: "LOCKED", lockedAt: new Date() },
    });
    return tx.survey.update({
      where: { id: surveyId },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
  });

  await writeAudit({
    actorUserId: user.id,
    entityType: "Survey",
    entityId: surveyId,
    action: "SURVEY_PUBLISHED",
    ipAddress: getClientIp(req),
  });

  return ok({ survey: updated });
});
