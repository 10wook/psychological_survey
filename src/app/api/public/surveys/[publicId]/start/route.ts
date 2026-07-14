import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { badRequest, conflict, forbidden, handler, notFound, ok, unauthorized } from "@/lib/http";
import { buildQuestionOrder } from "@/lib/shuffle";
import { formatAnonymousCode } from "@/lib/ids";
import { guestStartSchema } from "@/lib/validation";
import { generateAccessToken, setResponseAccessCookie } from "@/lib/responseAuth";

type Params = { params: Promise<{ publicId: string }> };

async function createResponseWithOrder(
  surveyId: string,
  participantId: string,
  surveyScales: Array<{
    scaleVersionId: string;
    shuffleQuestions: boolean;
    scaleVersion: { shuffleQuestions: boolean; questions: Array<{ id: string; isActive: boolean; displayOrder: number }> };
  }>,
  accessToken?: string,
) {
  const response = await prisma.surveyResponse.create({
    data: {
      surveyId,
      participantId,
      status: "IN_PROGRESS",
      accessToken: accessToken ?? null,
    },
  });

  const questionOrder: Record<string, string[]> = {};
  for (const ss of surveyScales) {
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

  return response;
}

// 응답 시작/이어하기. 회원(로그인) 또는 비회원(게스트) 모두 지원.
export const POST = handler(async (req: NextRequest, { params }: Params) => {
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
  if (survey.surveyScales.length === 0) throw badRequest("설문에 척도가 없습니다.");

  const user = await getCurrentUser();
  const body = await req.json().catch(() => ({}));

  // --- 회원 응답 ---
  if (user) {
    let participant = await prisma.participant.findUnique({ where: { userId: user.id } });
    if (!participant) {
      const count = await prisma.participant.count();
      participant = await prisma.participant.create({
        data: { userId: user.id, anonymousCode: formatAnonymousCode(count + 1) },
      });
    }

    const inProgress = await prisma.surveyResponse.findFirst({
      where: { surveyId: survey.id, participantId: participant.id, status: "IN_PROGRESS" },
    });
    if (inProgress) return ok({ responseId: inProgress.id, resumed: true });

    if (!survey.allowDuplicate) {
      const completed = await prisma.surveyResponse.findFirst({
        where: { surveyId: survey.id, participantId: participant.id, status: "COMPLETED" },
      });
      if (completed) throw conflict("이미 완료한 설문입니다. 중복 응답이 허용되지 않습니다.");
    }

    const response = await createResponseWithOrder(survey.id, participant.id, survey.surveyScales);
    return ok({ responseId: response.id, resumed: false });
  }

  // --- 비회원 응답 ---
  if (survey.requireLogin) {
    throw unauthorized("로그인이 필요한 설문입니다.");
  }

  const guest = guestStartSchema.parse(body);
  const count = await prisma.participant.count();
  const participant = await prisma.participant.create({
    data: {
      anonymousCode: formatAnonymousCode(count + 1),
      isGuest: true,
      guestName: guest.name,
      guestEmail: guest.email,
      guestPhone: guest.phone,
      guestAffiliation: guest.affiliation,
      guestBirthYear: guest.birthYear,
      guestBirthMonth: guest.birthMonth,
      guestBirthDay: guest.birthDay,
      guestGender: guest.gender,
    },
  });

  const accessToken = generateAccessToken();
  const response = await createResponseWithOrder(
    survey.id,
    participant.id,
    survey.surveyScales,
    accessToken,
  );
  await setResponseAccessCookie(response.id, accessToken);

  return ok({ responseId: response.id, resumed: false, guest: true });
});
