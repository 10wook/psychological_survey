import { prisma } from "@/lib/db";

/**
 * 척도 버전 잠금 정책 (이슈 #1 / 문서 6.17 조정).
 *
 * 잠금 조건:
 * - 게시(PUBLISHED)·잠금(LOCKED) 설문에 연결되어 있고
 * - 응답이 시작되었거나 완료 응답이 존재하는 경우
 *
 * 잠금하지 않음 (수정·잠금 해제·비활성 삭제 가능):
 * - 설문이 아직 시작되지 않음 (활성 설문에 응답 없음)
 * - 연결된 설문이 모두 종료(CLOSED)·보관(ARCHIVED)·초안(DRAFT)인 경우
 */
export function evaluateScaleVersionLock(input: {
  usedInActiveSurvey: boolean;
  hasCompletedResults: boolean;
  hasStartedResponsesOnActiveSurvey: boolean;
}): boolean {
  if (!input.usedInActiveSurvey) return false;
  return input.hasCompletedResults || input.hasStartedResponsesOnActiveSurvey;
}

// 문서 6.17: 잠금 조건 판정.
export async function shouldLockScaleVersion(versionId: string): Promise<boolean> {
  const usedInActiveSurvey = await prisma.surveyScale.findFirst({
    where: {
      scaleVersionId: versionId,
      survey: { status: { in: ["PUBLISHED", "LOCKED"] } },
    },
    select: { id: true },
  });

  if (!usedInActiveSurvey) {
    return evaluateScaleVersionLock({
      usedInActiveSurvey: false,
      hasCompletedResults: false,
      hasStartedResponsesOnActiveSurvey: false,
    });
  }

  const hasResponses = await prisma.scaleResult.findFirst({
    where: { scaleVersionId: versionId },
    select: { id: true },
  });

  const startedResponse = hasResponses
    ? null
    : await prisma.surveyResponse.findFirst({
        where: {
          survey: {
            status: { in: ["PUBLISHED", "LOCKED"] },
            surveyScales: { some: { scaleVersionId: versionId } },
          },
        },
        select: { id: true },
      });

  return evaluateScaleVersionLock({
    usedInActiveSurvey: true,
    hasCompletedResults: Boolean(hasResponses),
    hasStartedResponsesOnActiveSurvey: Boolean(startedResponse),
  });
}

/** 척도 버전이 편집 가능한 상태인지. LOCKED/ARCHIVED 이거나 잠금 조건 충족 시 편집 불가 */
export async function assertScaleVersionEditable(versionId: string): Promise<void> {
  const version = await prisma.scaleVersion.findUnique({
    where: { id: versionId },
    select: { status: true },
  });
  if (!version) return;
  if (version.status === "LOCKED" || version.status === "ARCHIVED") {
    const { forbidden } = await import("@/lib/http");
    throw forbidden(
      "잠기거나 보관된 척도 버전은 수정할 수 없습니다. 잠금 해제하거나 새 버전을 생성하세요.",
    );
  }
  if (await shouldLockScaleVersion(versionId)) {
    const { forbidden } = await import("@/lib/http");
    throw forbidden(
      "진행 중인 설문에서 응답이 시작된 척도는 수정할 수 없습니다. 설문을 종료하거나 새 버전을 생성하세요.",
    );
  }
}
