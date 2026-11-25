import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { badRequest, handler, ok } from "@/lib/http";
import { shareScaleSchema } from "@/lib/validation";
import { writeAudit, getClientIp } from "@/lib/audit";
import { assertOwnsScale } from "@/lib/ownership";

type Params = { params: Promise<{ scaleId: string }> };

/**
 * 잠긴 척도를 아카이브(공유 라이브러리)에 등록/해제 (이슈 #39).
 * 공유는 최신 버전이 LOCKED 일 때만 허용.
 */
export const POST = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { scaleId } = await params;
  const { shared } = shareScaleSchema.parse(await req.json());
  await assertOwnsScale(user, scaleId);

  const scale = await prisma.scale.findUniqueOrThrow({
    where: { id: scaleId },
    include: {
      versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { status: true } },
    },
  });

  if (shared) {
    if (!scale.isActive) {
      throw badRequest("비활성화된 척도는 공유할 수 없습니다.");
    }
    if (scale.versions[0]?.status !== "LOCKED") {
      throw badRequest("잠긴(LOCKED) 버전만 아카이브에 공유할 수 있습니다.");
    }
  }

  const updated = await prisma.scale.update({
    where: { id: scaleId },
    data: {
      isShared: shared,
      sharedAt: shared ? new Date() : null,
    },
  });

  await writeAudit({
    actorUserId: user.id,
    entityType: "Scale",
    entityId: scaleId,
    action: shared ? "SCALE_SHARED" : "SCALE_UNSHARED",
    after: { isShared: shared },
    ipAddress: getClientIp(req),
  });

  return ok({ scale: updated });
});
