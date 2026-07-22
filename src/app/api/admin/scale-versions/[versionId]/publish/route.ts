import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { badRequest, handler, notFound, ok } from "@/lib/http";
import { writeAudit, getClientIp } from "@/lib/audit";
import { assertOwnsScaleVersion } from "@/lib/ownership";

type Params = { params: Promise<{ versionId: string }> };

// 척도 버전 게시 (문서 6.2). 활성 문항이 하나 이상 있어야 게시 가능.
export const POST = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { versionId } = await params;
  await assertOwnsScaleVersion(user, versionId);

  const version = await prisma.scaleVersion.findUnique({
    where: { id: versionId },
    include: { _count: { select: { questions: { where: { isActive: true } } } } },
  });
  if (!version) throw notFound("척도 버전을 찾을 수 없습니다.");
  if (version.status !== "DRAFT") throw badRequest("DRAFT 상태만 게시할 수 있습니다.");
  if (version._count.questions < 1) {
    throw badRequest("활성 문항이 하나 이상 있어야 게시할 수 있습니다.");
  }
  if (version.minScore >= version.maxScore) {
    throw badRequest("응답 범위 설정이 올바르지 않습니다. (최솟값 < 최댓값)");
  }

  const updated = await prisma.scaleVersion.update({
    where: { id: versionId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  await writeAudit({
    actorUserId: user.id,
    entityType: "ScaleVersion",
    entityId: versionId,
    action: "SCALE_VERSION_PUBLISHED",
    ipAddress: getClientIp(req),
  });

  return ok({ version: updated });
});
