import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { badRequest, forbidden, handler, ok } from "@/lib/http";
import { updateSurveySchema } from "@/lib/validation";
import {
  assertOwnsSurvey,
  assertReadableScaleVersionForSurvey,
} from "@/lib/ownership";

type Params = { params: Promise<{ surveyId: string }> };

export const GET = handler(async (_req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { surveyId } = await params;
  await assertOwnsSurvey(user, surveyId);
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
  return ok({ survey });
});

export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { surveyId } = await params;

  await assertOwnsSurvey(user, surveyId);
  const existing = await prisma.survey.findUniqueOrThrow({ where: { id: surveyId } });
  if (existing.status === "LOCKED" || existing.status === "ARCHIVED") {
    throw forbidden("잠기거나 보관된 설문은 수정할 수 없습니다.");
  }

  const input = updateSurveySchema.parse(await req.json());

  const survey = await prisma.$transaction(async (tx) => {
    if (input.scales) {
      if (existing.status !== "DRAFT") {
        throw badRequest("게시된 설문의 척도 구성은 변경할 수 없습니다.");
      }
      for (const s of input.scales) {
        const version = await assertReadableScaleVersionForSurvey(user, s.scaleVersionId);
        if (version.status !== "PUBLISHED" && version.status !== "LOCKED") {
          throw badRequest("게시되지 않은 척도 버전은 설문에 추가할 수 없습니다.");
        }
      }
      await tx.surveyScale.deleteMany({ where: { surveyId } });
      await tx.surveyScale.createMany({
        data: input.scales.map((s, idx) => ({
          surveyId,
          scaleVersionId: s.scaleVersionId,
          displayOrder: s.displayOrder ?? idx + 1,
          isRequired: s.isRequired ?? true,
          shuffleQuestions: s.shuffleQuestions ?? false,
          includeInGlobalShuffle: s.includeInGlobalShuffle ?? true,
          pinPosition: s.pinPosition ?? "NONE",
          displayMode: s.displayMode ?? "NAME",
          displayLabel: s.displayMode === "CUSTOM" ? (s.displayLabel ?? null) : null,
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
        questionOrderMode: input.questionOrderMode,
        scaleOrderMode: input.scaleOrderMode,
        targetResponseCount: input.targetResponseCount,
        startAt: input.startAt ? new Date(input.startAt) : input.startAt === "" ? null : undefined,
        endAt: input.endAt ? new Date(input.endAt) : input.endAt === "" ? null : undefined,
      },
    });
  });

  return ok({ survey });
});
