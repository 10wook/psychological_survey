import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
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
