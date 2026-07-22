import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { badRequest, forbidden, handler, notFound, ok } from "@/lib/http";
import { shouldLockScaleVersion } from "@/lib/lock";
import { writeAudit, getClientIp } from "@/lib/audit";

type Params = { params: Promise<{ versionId: string }> };

// 척도 버전 잠금 해제.
// 진행 중(게시·잠금) 설문에서 응답이 시작된 경우에만 차단.
// 설문이 종료되었거나 아직 응답이 없으면 해제 가능 (이슈 #1).
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
      "진행 중인 설문에서 응답이 시작된 척도 버전은 잠금 해제할 수 없습니다. 설문을 종료하거나 새 버전을 생성하세요.",
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
