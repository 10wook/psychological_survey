import { prisma } from "@/lib/db";

// 문서 6.17: 잠금 조건 판정.
// 척도 버전이 (a) 게시된 설문에서 사용 중이거나 (b) 응답이 하나라도 시작/존재하면 잠긴다.
export async function shouldLockScaleVersion(versionId: string): Promise<boolean> {
  const usedInPublishedSurvey = await prisma.surveyScale.findFirst({
    where: {
      scaleVersionId: versionId,
      survey: { status: { in: ["PUBLISHED", "CLOSED", "LOCKED", "ARCHIVED"] } },
    },
    select: { id: true },
  });
  if (usedInPublishedSurvey) return true;

  const hasResponses = await prisma.scaleResult.findFirst({
    where: { scaleVersionId: versionId },
    select: { id: true },
  });
  if (hasResponses) return true;

  // 응답 시작(진행 중)도 잠금 사유
  const startedResponse = await prisma.surveyResponse.findFirst({
    where: { survey: { surveyScales: { some: { scaleVersionId: versionId } } } },
    select: { id: true },
  });
  return Boolean(startedResponse);
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
    throw forbidden("잠기거나 보관된 척도 버전은 수정할 수 없습니다. 새 버전을 생성하세요.");
  }
  if (await shouldLockScaleVersion(versionId)) {
    const { forbidden } = await import("@/lib/http");
    throw forbidden("응답이 시작되었거나 게시된 설문에 사용 중인 척도는 수정할 수 없습니다.");
  }
}
