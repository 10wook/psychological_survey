import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { badRequest, forbidden, handler, notFound, ok } from "@/lib/http";
import { shouldLockScaleVersion } from "@/lib/lock";
import { writeAudit, getClientIp } from "@/lib/audit";
import { assertOwnsScaleVersion } from "@/lib/ownership";

type Params = { params: Promise<{ versionId: string }> };

// 척도 버전 잠금 해제.
// 진행 중(게시·잠금) 설문에 사용 중이면 응답 여부와 무관하게 차단 (이슈 #10).
// 연결된 설문이 모두 종료·보관·초안이면 해제 가능.
export const POST = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { versionId } = await params;
  await assertOwnsScaleVersion(user, versionId);

  const version = await prisma.scaleVersion.findUnique({ where: { id: versionId } });
  if (!version) throw notFound("척도 버전을 찾을 수 없습니다.");
  if (version.status !== "LOCKED") {
    throw badRequest("잠긴(LOCKED) 버전만 잠금 해제할 수 있습니다.");
  }

  if (await shouldLockScaleVersion(versionId)) {
    throw forbidden(
      "진행 중인 설문에 사용 중인 척도 버전은 잠금 해제할 수 없습니다. 설문을 종료하거나 새 버전을 생성하세요.",
    );
  }

  const updated = await prisma.scaleVersion.update({
    where: { id: versionId },
    data: { status: "PUBLISHED", lockedAt: null },
  });

  await writeAudit({
    actorUserId: user.id,
    entityType: "ScaleVersion",
    entityId: versionId,
    action: "SCALE_VERSION_UNLOCKED",
    ipAddress: getClientIp(req),
  });

  return ok({ version: updated });
});
