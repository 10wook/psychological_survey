import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { badRequest, forbidden, handler, notFound, ok } from "@/lib/http";
import { shouldLockScaleVersion } from "@/lib/lock";
import { writeAudit, getClientIp } from "@/lib/audit";

type Params = { params: Promise<{ versionId: string }> };

// 척도 버전 잠금 해제. 응답/채점 또는 게시·종료·잠금·보관 설문에 쓰이면 차단.
export const POST = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { versionId } = await params;

  const version = await prisma.scaleVersion.findUnique({ where: { id: versionId } });
  if (!version) throw notFound("척도 버전을 찾을 수 없습니다.");
  if (version.status !== "LOCKED") {
    throw badRequest("잠긴(LOCKED) 버전만 잠금 해제할 수 있습니다.");
  }

  if (await shouldLockScaleVersion(versionId)) {
    throw forbidden(
      "응답이 있거나 설문에 사용 중인 척도 버전은 잠금 해제할 수 없습니다. 수정하려면 새 버전을 생성하세요.",
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
