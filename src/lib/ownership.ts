import type { Prisma, ScaleVersionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SafeUser } from "@/lib/auth";
import { forbidden, notFound } from "@/lib/http";

function isAdmin(user: SafeUser): boolean {
  return user.role === "ADMIN";
}

/** 목록 조회용: ADMIN은 전체, RESEARCHER는 본인 생성분만 */
export function ownedSurveyWhere(user: SafeUser): Prisma.SurveyWhereInput {
  if (isAdmin(user)) return {};
  return { createdById: user.id };
}

export function ownedScaleWhere(user: SafeUser): Prisma.ScaleWhereInput {
  if (isAdmin(user)) return {};
  return { createdById: user.id };
}

export async function assertOwnsSurvey(user: SafeUser, surveyId: string) {
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    select: { id: true, createdById: true },
  });
  if (!survey) throw notFound("설문을 찾을 수 없습니다.");
  if (!isAdmin(user) && survey.createdById !== user.id) {
    throw forbidden();
  }
  return survey;
}

export async function assertOwnsScale(user: SafeUser, scaleId: string) {
  const scale = await prisma.scale.findUnique({
    where: { id: scaleId },
    select: { id: true, createdById: true },
  });
  if (!scale) throw notFound("척도를 찾을 수 없습니다.");
  if (!isAdmin(user) && scale.createdById !== user.id) {
    throw forbidden();
  }
  return scale;
}

export async function assertOwnsScaleVersion(user: SafeUser, versionId: string) {
  const version = await prisma.scaleVersion.findUnique({
    where: { id: versionId },
    select: {
      id: true,
      status: true,
      scaleId: true,
      scale: { select: { createdById: true } },
    },
  });
  if (!version) throw notFound("척도 버전을 찾을 수 없습니다.");
  if (!isAdmin(user) && version.scale.createdById !== user.id) {
    throw forbidden();
  }
  return version;
}

export async function assertOwnsQuestion(user: SafeUser, questionId: string) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      scaleVersion: {
        select: { scale: { select: { createdById: true } } },
      },
    },
  });
  if (!question) throw notFound("문항을 찾을 수 없습니다.");
  if (!isAdmin(user) && question.scaleVersion.scale.createdById !== user.id) {
    throw forbidden();
  }
  return question;
}

export async function assertOwnsSubfactor(user: SafeUser, subfactorId: string) {
  const subfactor = await prisma.subfactor.findUnique({
    where: { id: subfactorId },
    select: {
      id: true,
      scaleVersion: {
        select: { scale: { select: { createdById: true } } },
      },
    },
  });
  if (!subfactor) throw notFound("하위요인을 찾을 수 없습니다.");
  if (!isAdmin(user) && subfactor.scaleVersion.scale.createdById !== user.id) {
    throw forbidden();
  }
  return subfactor;
}

export async function assertOwnsSurveyResponse(user: SafeUser, responseId: string) {
  const response = await prisma.surveyResponse.findUnique({
    where: { id: responseId },
    select: {
      id: true,
      surveyId: true,
      survey: { select: { createdById: true } },
    },
  });
  if (!response) throw notFound("응답을 찾을 수 없습니다.");
  if (!isAdmin(user) && response.survey.createdById !== user.id) {
    throw forbidden();
  }
  return response;
}

const ATTACHABLE: ScaleVersionStatus[] = ["PUBLISHED", "LOCKED"];

/**
 * 설문에 척도 버전을 부착할 수 있는지.
 * - ADMIN: 항상 허용(존재만 확인)
 * - 본인 Scale: 소유면 허용 (DRAFT 여부는 호출부에서 검증)
 * - 타 연구자 Scale: PUBLISHED/LOCKED 만 읽기·부착 허용
 */
export async function assertReadableScaleVersionForSurvey(
  user: SafeUser,
  versionId: string,
) {
  const version = await prisma.scaleVersion.findUnique({
    where: { id: versionId },
    select: {
      id: true,
      status: true,
      scale: { select: { createdById: true, isActive: true } },
    },
  });
  if (!version) throw notFound("척도 버전을 찾을 수 없습니다.");

  if (isAdmin(user)) return version;

  const owns = version.scale.createdById === user.id;
  if (owns) return version;

  if (!ATTACHABLE.includes(version.status)) {
    throw forbidden("다른 연구자의 게시되지 않은 척도 버전은 사용할 수 없습니다.");
  }
  return version;
}

/** Clone: 본인 척도 또는 ADMIN만 */
export async function assertCanReadScaleForClone(user: SafeUser, scaleId: string) {
  const scale = await prisma.scale.findUnique({
    where: { id: scaleId },
    select: { id: true, createdById: true },
  });
  if (!scale) throw notFound("척도를 찾을 수 없습니다.");
  if (!isAdmin(user) && scale.createdById !== user.id) {
    throw forbidden();
  }
  return scale;
}
