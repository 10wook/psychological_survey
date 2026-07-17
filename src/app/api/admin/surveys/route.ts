import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { badRequest, handler, ok } from "@/lib/http";
import { createSurveySchema } from "@/lib/validation";
import { generatePublicId } from "@/lib/ids";
import { writeAudit, getClientIp } from "@/lib/audit";

export const GET = handler(async () => {
  await requireStaff();
  const surveys = await prisma.survey.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { responses: true, surveyScales: true } },
    },
  });
  return ok({ surveys });
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireStaff();
  const input = createSurveySchema.parse(await req.json());

  // 연결하려는 척도 버전이 게시/잠금 상태인지 확인 (DRAFT 척도는 설문에 넣지 않음)
  if (input.scales.length > 0) {
    const versionIds = input.scales.map((s) => s.scaleVersionId);
    const versions = await prisma.scaleVersion.findMany({
      where: { id: { in: versionIds } },
      select: { id: true, status: true },
    });
    if (versions.length !== versionIds.length) {
      throw badRequest("존재하지 않는 척도 버전이 포함되어 있습니다.");
    }
    const draft = versions.find((v) => v.status === "DRAFT");
    if (draft) throw badRequest("게시되지 않은(DRAFT) 척도 버전은 설문에 추가할 수 없습니다.");
  }

  const survey = await prisma.survey.create({
    data: {
      title: input.title,
      description: input.description,
      instructions: input.instructions,
      publicId: generatePublicId(),
      requireLogin: input.requireLogin,
      allowResume: input.allowResume,
      allowDuplicate: input.allowDuplicate,
      showResult: input.showResult,
      targetResponseCount: input.targetResponseCount,
      startAt: input.startAt ? new Date(input.startAt) : null,
      endAt: input.endAt ? new Date(input.endAt) : null,
      createdById: user.id,
      surveyScales: {
        create: input.scales.map((s, idx) => ({
          scaleVersionId: s.scaleVersionId,
          displayOrder: s.displayOrder ?? idx + 1,
          isRequired: s.isRequired ?? true,
          shuffleQuestions: s.shuffleQuestions ?? false,
          displayMode: s.displayMode ?? "NAME",
          displayLabel: s.displayMode === "CUSTOM" ? (s.displayLabel ?? null) : null,
        })),
      },
    },
  });

  await writeAudit({
    actorUserId: user.id,
    entityType: "Survey",
    entityId: survey.id,
    action: "SURVEY_CREATED",
    after: { title: survey.title },
    ipAddress: getClientIp(req),
  });

  return ok({ survey }, 201);
});
