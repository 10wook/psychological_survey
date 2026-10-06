import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { badRequest, handler, ok } from "@/lib/http";
import { updateScaleSchema } from "@/lib/validation";
import { writeAudit, getClientIp } from "@/lib/audit";
import { assertOwnsScale } from "@/lib/ownership";

type Params = { params: Promise<{ scaleId: string }> };

export const GET = handler(async (_req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { scaleId } = await params;
  await assertOwnsScale(user, scaleId);
  const scale = await prisma.scale.findUnique({
    where: { id: scaleId },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        include: {
          subfactors: { orderBy: { displayOrder: "asc" } },
          questions: {
            orderBy: { displayOrder: "asc" },
            include: { options: { orderBy: { displayOrder: "asc" } } },
          },
        },
      },
    },
  });
  return ok({ scale });
});

export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { scaleId } = await params;
  const input = updateScaleSchema.parse(await req.json());

  await assertOwnsScale(user, scaleId);
  const existing = await prisma.scale.findUniqueOrThrow({ where: { id: scaleId } });

  const scale = await prisma.scale.update({
    where: { id: scaleId },
    data: {
      ...input,
      sourceUrl: input.sourceUrl === "" ? null : input.sourceUrl,
    },
  });

  await writeAudit({
    actorUserId: user.id,
    entityType: "Scale",
    entityId: scaleId,
    action: "SCALE_UPDATED",
    before: { name: existing.name },
    after: { name: scale.name },
    ipAddress: getClientIp(req),
  });

  return ok({ scale });
});

// 완전 삭제 (이슈 #30): 비활성화된 척도만, 설문에 사용된 적이 없어야 한다.
export const DELETE = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { scaleId } = await params;
  await assertOwnsScale(user, scaleId);

  const scale = await prisma.scale.findUniqueOrThrow({
    where: { id: scaleId },
    select: { id: true, name: true, isActive: true },
  });
  if (scale.isActive) {
    throw badRequest("활성 상태의 척도는 완전 삭제할 수 없습니다. 먼저 비활성화하세요.");
  }

  const [usedInSurveys, hasResults] = await Promise.all([
    prisma.surveyScale.count({ where: { scaleVersion: { scaleId } } }),
    prisma.scaleResult.count({ where: { scaleVersion: { scaleId } } }),
  ]);
  if (usedInSurveys > 0 || hasResults > 0) {
    throw badRequest(
      "설문에 연결되었거나 응답 결과가 있는 척도는 완전 삭제할 수 없습니다. 해당 설문을 먼저 삭제하세요.",
    );
  }

  await prisma.scale.delete({ where: { id: scaleId } });

  await writeAudit({
    actorUserId: user.id,
    entityType: "Scale",
    entityId: scaleId,
    action: "SCALE_HARD_DELETED",
    before: { name: scale.name },
    ipAddress: getClientIp(req),
  });

  return ok({ deleted: true });
});
