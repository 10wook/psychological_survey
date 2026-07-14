import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { scoreAndSaveResponse } from "@/lib/scoreResponse";

// DB 기반 통합 테스트 (문서 12.2). 로컬/CI Postgres 필요.
const prisma = new PrismaClient();

const createdScaleIds: string[] = [];
const createdSurveyIds: string[] = [];
const createdParticipantIds: string[] = [];

afterAll(async () => {
  await prisma.surveyResponse.deleteMany({ where: { surveyId: { in: createdSurveyIds } } });
  await prisma.survey.deleteMany({ where: { id: { in: createdSurveyIds } } });
  await prisma.scale.deleteMany({ where: { id: { in: createdScaleIds } } });
  await prisma.participant.deleteMany({ where: { id: { in: createdParticipantIds } } });
  await prisma.$disconnect();
});

describe("채점 파이프라인 통합 (DB)", () => {
  it("역문항 변환 + 하위요인 점수를 저장한다", async () => {
    // 척도 v1: 1~5, 문항 3개(1 역문항), 하위요인 1개
    const scale = await prisma.scale.create({
      data: {
        name: `테스트척도_${Date.now()}`,
        versions: {
          create: { versionNumber: 1, status: "PUBLISHED", minScore: 1, maxScore: 5 },
        },
      },
      include: { versions: true },
    });
    createdScaleIds.push(scale.id);
    const version = scale.versions[0]!;

    const sub = await prisma.subfactor.create({
      data: { scaleVersionId: version.id, name: "요인A", displayOrder: 1 },
    });
    const q1 = await prisma.question.create({
      data: { scaleVersionId: version.id, subfactorId: sub.id, code: "Q1", content: "문항1", displayOrder: 1 },
    });
    const q2 = await prisma.question.create({
      data: { scaleVersionId: version.id, subfactorId: sub.id, code: "Q2", content: "문항2", isReverse: true, displayOrder: 2 },
    });
    const q3 = await prisma.question.create({
      data: { scaleVersionId: version.id, code: "Q3", content: "문항3", displayOrder: 3 },
    });

    const survey = await prisma.survey.create({
      data: {
        title: "통합테스트설문",
        status: "PUBLISHED",
        publicId: `it_${Date.now()}`,
        surveyScales: { create: { scaleVersionId: version.id, displayOrder: 1, isRequired: true } },
      },
    });
    createdSurveyIds.push(survey.id);

    const participant = await prisma.participant.create({
      data: { anonymousCode: `IT-${Date.now()}` },
    });
    createdParticipantIds.push(participant.id);

    const response = await prisma.surveyResponse.create({
      data: {
        surveyId: survey.id,
        participantId: participant.id,
        status: "IN_PROGRESS",
        answers: {
          create: [
            { questionId: q1.id, rawScore: 4 },
            { questionId: q2.id, rawScore: 2 }, // 역문항 → 6-2=4
            { questionId: q3.id, rawScore: 5 },
          ],
        },
      },
    });

    await prisma.$transaction((tx) => scoreAndSaveResponse(tx, response.id));

    const scaleResult = await prisma.scaleResult.findFirst({
      where: { surveyResponseId: response.id },
    });
    // convertedTotal = 4 + 4 + 5 = 13
    expect(scaleResult?.convertedTotal).toBe(13);
    expect(scaleResult?.rawTotal).toBe(11);
    expect(scaleResult?.completedQuestionCount).toBe(3);

    const subResult = await prisma.subfactorResult.findFirst({
      where: { surveyResponseId: response.id, subfactorId: sub.id },
    });
    // 요인A: q1(4) + q2(4) = 8
    expect(subResult?.totalScore).toBe(8);

    // 문항별 변환점수 저장 확인 (역문항)
    const a2 = await prisma.answer.findFirst({
      where: { surveyResponseId: response.id, questionId: q2.id },
    });
    expect(a2?.convertedScore).toBe(4);
  });
});
