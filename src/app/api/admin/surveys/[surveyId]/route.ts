import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { badRequest, forbidden, handler, notFound, ok } from "@/lib/http";
import { updateSurveySchema } from "@/lib/validation";

type Params = { params: Promise<{ surveyId: string }> };

export const GET = handler(async (_req: NextRequest, { params }: Params) => {
  await requireStaff();
  const { surveyId } = await params;
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      surveyScales: {
        orderBy: { displayOrder: "asc" },
        include: {
          scaleVersion: {
            include: {
              scale: true,
              _count: { select: { questions: { where: { isActive: true } } } },
            },
          },
        },
      },
      _count: { select: { responses: true } },
    },
  });
  if (!survey) throw notFound("설문을 찾을 수 없습니다.");
  return ok({ survey });
});

export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  await requireStaff();
  const { surveyId } = await params;

  const existing = await prisma.survey.findUnique({ where: { id: surveyId } });
  if (!existing) throw notFound("설문을 찾을 수 없습니다.");
  if (existing.status === "LOCKED" || existing.status === "ARCHIVED") {
    throw forbidden("잠기거나 보관된 설문은 수정할 수 없습니다.");
  }

  const input = updateSurveySchema.parse(await req.json());

  const survey = await prisma.$transaction(async (tx) => {
    // 척도 구성이 함께 오면 교체 (게시 전 DRAFT 에서만 허용)
    if (input.scales) {
      if (existing.status !== "DRAFT") {
        throw badRequest("게시된 설문의 척도 구성은 변경할 수 없습니다.");
      }
      await tx.surveyScale.deleteMany({ where: { surveyId } });
      await tx.surveyScale.createMany({
        data: input.scales.map((s, idx) => ({
          surveyId,
          scaleVersionId: s.scaleVersionId,
          displayOrder: s.displayOrder ?? idx + 1,
          isRequired: s.isRequired ?? true,
          shuffleQuestions: s.shuffleQuestions ?? false,
        })),
      });
    }

    return tx.survey.update({
      where: { id: surveyId },
      data: {
        title: input.title,
        description: input.description,
        instructions: input.instructions,
        requireLogin: input.requireLogin,
        allowResume: input.allowResume,
        allowDuplicate: input.allowDuplicate,
        showResult: input.showResult,
        targetResponseCount: input.targetResponseCount,
        startAt: input.startAt ? new Date(input.startAt) : input.startAt === "" ? null : undefined,
        endAt: input.endAt ? new Date(input.endAt) : input.endAt === "" ? null : undefined,
      },
    });
  });

  return ok({ survey });
});
