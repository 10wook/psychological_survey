import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { badRequest, handler, notFound, ok } from "@/lib/http";
import { writeAudit, getClientIp } from "@/lib/audit";

type Params = { params: Promise<{ versionId: string }> };

// 척도 버전 잠금 (문서 6.17).
export const POST = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { versionId } = await params;

  const version = await prisma.scaleVersion.findUnique({ where: { id: versionId } });
  if (!version) throw notFound("척도 버전을 찾을 수 없습니다.");
  if (version.status === "DRAFT") throw badRequest("게시된 버전만 잠글 수 있습니다.");

  const updated = await prisma.scaleVersion.update({
    where: { id: versionId },
    data: { status: "LOCKED", lockedAt: new Date() },
  });

  await writeAudit({
    actorUserId: user.id,
    entityType: "ScaleVersion",
    entityId: versionId,
    action: "SCALE_VERSION_LOCKED",
    ipAddress: getClientIp(req),
  });

  return ok({ version: updated });
});
