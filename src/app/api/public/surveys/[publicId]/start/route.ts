import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { badRequest, conflict, forbidden, handler, notFound, ok } from "@/lib/http";
import { buildQuestionOrder } from "@/lib/shuffle";
import { formatAnonymousCode } from "@/lib/ids";

type Params = { params: Promise<{ publicId: string }> };

// 응답 시작/이어하기 (문서 6.8 / 6.10). 문항 순서를 한 번만 생성해 저장한다.
export const POST = handler(async (_req: NextRequest, { params }: Params) => {
  const { publicId } = await params;

  const survey = await prisma.survey.findUnique({
    where: { publicId },
    include: {
      surveyScales: {
        orderBy: { displayOrder: "asc" },
        include: { scaleVersion: { include: { questions: true } } },
      },
    },
  });
  if (!survey) throw notFound("설문을 찾을 수 없습니다.");
  if (survey.status !== "PUBLISHED") throw forbidden("현재 응답할 수 없는 설문입니다.");

  const now = new Date();
  if (survey.startAt && survey.startAt > now) throw forbidden("아직 시작되지 않은 설문입니다.");
  if (survey.endAt && survey.endAt < now) throw forbidden("종료된 설문입니다.");

  // MVP: 로그인 필수 전제
  const user = await requireUser();

  // 참가자 확보
  let participant = await prisma.participant.findUnique({ where: { userId: user.id } });
  if (!participant) {
    const count = await prisma.participant.count();
    participant = await prisma.participant.create({
      data: { userId: user.id, anonymousCode: formatAnonymousCode(count + 1) },
    });
  }

  // 이어하기: 진행 중 응답이 있으면 반환
  const inProgress = await prisma.surveyResponse.findFirst({
    where: { surveyId: survey.id, participantId: participant.id, status: "IN_PROGRESS" },
  });
  if (inProgress) {
    return ok({ responseId: inProgress.id, resumed: true });
  }

  // 중복 응답 정책
  if (!survey.allowDuplicate) {
    const completed = await prisma.surveyResponse.findFirst({
      where: { surveyId: survey.id, participantId: participant.id, status: "COMPLETED" },
    });
    if (completed) throw conflict("이미 완료한 설문입니다. 중복 응답이 허용되지 않습니다.");
  }

  if (survey.surveyScales.length === 0) throw badRequest("설문에 척도가 없습니다.");

  // 응답 생성 후 응답 id 를 시드로 문항 순서 생성 (재현 가능)
  const response = await prisma.surveyResponse.create({
    data: {
      surveyId: survey.id,
      participantId: participant.id,
      status: "IN_PROGRESS",
    },
  });

  const questionOrder: Record<string, string[]> = {};
  for (const ss of survey.surveyScales) {
    const shuffleEnabled = ss.shuffleQuestions || ss.scaleVersion.shuffleQuestions;
    questionOrder[ss.scaleVersionId] = buildQuestionOrder(
      ss.scaleVersion.questions,
      shuffleEnabled,
      `${response.id}:${ss.scaleVersionId}`,
    );
  }

  await prisma.surveyResponse.update({
    where: { id: response.id },
    data: { questionOrderJson: questionOrder },
  });

  return ok({ responseId: response.id, resumed: false });
});
