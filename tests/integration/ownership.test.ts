import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient, type User } from "@prisma/client";
import { hashPassword } from "@/lib/password";
import {
  assertOwnsScale,
  assertOwnsSurvey,
  assertOwnsSurveyResponse,
  assertReadableScaleVersionForSurvey,
  ownedScaleWhere,
  ownedSurveyWhere,
} from "@/lib/ownership";
import { ApiError } from "@/lib/http";
import type { SafeUser } from "@/lib/auth";

const prisma = new PrismaClient();
const stamp = Date.now();
const createdUserIds: string[] = [];
const createdScaleIds: string[] = [];
const createdSurveyIds: string[] = [];
const createdParticipantIds: string[] = [];

function asSafe(user: User): SafeUser {
  const { passwordHash: _, ...rest } = user;
  return rest;
}

afterAll(async () => {
  await prisma.surveyResponse.deleteMany({ where: { surveyId: { in: createdSurveyIds } } });
  await prisma.survey.deleteMany({ where: { id: { in: createdSurveyIds } } });
  await prisma.scale.deleteMany({ where: { id: { in: createdScaleIds } } });
  await prisma.participant.deleteMany({ where: { id: { in: createdParticipantIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("연구자 소유권 격리", () => {
  it(
    "RESEARCHER 는 타 연구자 설문/척도/응답에 403, ADMIN 은 통과",
    async () => {
    const pw = await hashPassword("TestPass123!");
    const researcherA = await prisma.user.create({
      data: {
        email: `own_a_${stamp}@example.com`,
        passwordHash: pw,
        role: "RESEARCHER",
      },
    });
    const researcherB = await prisma.user.create({
      data: {
        email: `own_b_${stamp}@example.com`,
        passwordHash: pw,
        role: "RESEARCHER",
      },
    });
    const admin = await prisma.user.create({
      data: {
        email: `own_admin_${stamp}@example.com`,
        passwordHash: pw,
        role: "ADMIN",
      },
    });
    createdUserIds.push(researcherA.id, researcherB.id, admin.id);

    const scaleB = await prisma.scale.create({
      data: {
        name: `B척도_${stamp}`,
        createdById: researcherB.id,
        versions: {
          create: { versionNumber: 1, status: "PUBLISHED", minScore: 1, maxScore: 5 },
        },
      },
      include: { versions: true },
    });
    createdScaleIds.push(scaleB.id);
    const versionB = scaleB.versions[0]!;

    const draftB = await prisma.scaleVersion.create({
      data: {
        scaleId: scaleB.id,
        versionNumber: 2,
        status: "DRAFT",
        minScore: 1,
        maxScore: 5,
      },
    });

    const surveyB = await prisma.survey.create({
      data: {
        title: `B설문_${stamp}`,
        publicId: `own_b_${stamp}`,
        status: "PUBLISHED",
        createdById: researcherB.id,
        surveyScales: { create: { scaleVersionId: versionB.id, displayOrder: 1 } },
      },
    });
    createdSurveyIds.push(surveyB.id);

    const participant = await prisma.participant.create({
      data: { anonymousCode: `OWN-${stamp}` },
    });
    createdParticipantIds.push(participant.id);
    const responseB = await prisma.surveyResponse.create({
      data: {
        surveyId: surveyB.id,
        participantId: participant.id,
        status: "COMPLETED",
      },
    });

    const a = asSafe(researcherA);
    const b = asSafe(researcherB);
    const adm = asSafe(admin);

    await expect(assertOwnsSurvey(a, surveyB.id)).rejects.toMatchObject({ status: 403 } satisfies Partial<ApiError>);
    await expect(assertOwnsScale(a, scaleB.id)).rejects.toMatchObject({ status: 403 });
    await expect(assertOwnsSurveyResponse(a, responseB.id)).rejects.toMatchObject({ status: 403 });

    await expect(assertOwnsSurvey(b, surveyB.id)).resolves.toBeTruthy();
    await expect(assertOwnsSurvey(adm, surveyB.id)).resolves.toBeTruthy();
    await expect(assertOwnsScale(adm, scaleB.id)).resolves.toBeTruthy();

    // 타 연구자 PUBLISHED 부착 허용, DRAFT 거부
    await expect(assertReadableScaleVersionForSurvey(a, versionB.id)).resolves.toBeTruthy();
    await expect(assertReadableScaleVersionForSurvey(a, draftB.id)).rejects.toMatchObject({
      status: 403,
    });

    // 목록 where
    const aSurveys = await prisma.survey.findMany({ where: ownedSurveyWhere(a) });
    expect(aSurveys.every((s) => s.createdById === a.id)).toBe(true);
    expect(aSurveys.some((s) => s.id === surveyB.id)).toBe(false);

    const aScales = await prisma.scale.findMany({ where: ownedScaleWhere(a) });
    expect(aScales.some((s) => s.id === scaleB.id)).toBe(false);

    const adminSurveys = await prisma.survey.findMany({ where: ownedSurveyWhere(adm) });
    expect(adminSurveys.some((s) => s.id === surveyB.id)).toBe(true);
  },
    30000,
  );
});
