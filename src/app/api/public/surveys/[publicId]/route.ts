import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { handler, notFound, ok } from "@/lib/http";

type Params = { params: Promise<{ publicId: string }> };

// 설문 안내 정보 (문서 7.2). 게시되지 않은 설문은 접근 불가.
export const GET = handler(async (_req: NextRequest, { params }: Params) => {
  const { publicId } = await params;
  const survey = await prisma.survey.findUnique({
    where: { publicId },
    include: {
      surveyScales: {
        orderBy: { displayOrder: "asc" },
        include: {
          scaleVersion: {
            select: {
              estimatedSeconds: true,
              scale: { select: { name: true, description: true } },
              _count: { select: { questions: { where: { isActive: true } } } },
            },
          },
        },
      },
    },
  });

  if (!survey || survey.status === "DRAFT" || survey.status === "ARCHIVED") {
    throw notFound("존재하지 않거나 접근할 수 없는 설문입니다.");
  }

  const now = new Date();
  const notStarted = survey.startAt && survey.startAt > now;
  const ended =
    survey.status === "CLOSED" ||
    survey.status === "LOCKED" ||
    (survey.endAt ? survey.endAt < now : false);

  const totalQuestions = survey.surveyScales.reduce(
    (sum, ss) => sum + ss.scaleVersion._count.questions,
    0,
  );
  const estimatedSeconds = survey.surveyScales.reduce(
    (sum, ss) => sum + (ss.scaleVersion.estimatedSeconds ?? ss.scaleVersion._count.questions * 10),
    0,
  );

  return ok({
    survey: {
      title: survey.title,
      description: survey.description,
      instructions: survey.instructions,
      requireLogin: survey.requireLogin,
      showResult: survey.showResult,
      publicId: survey.publicId,
      notStarted,
      ended,
      totalQuestions,
      estimatedSeconds,
      scales: survey.surveyScales.map((ss) => ({
        name: ss.scaleVersion.scale.name,
        description: ss.scaleVersion.scale.description,
        questionCount: ss.scaleVersion._count.questions,
      })),
    },
  });
});
