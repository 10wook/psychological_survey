import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handler, notFound, ok } from "@/lib/http";
import { updateScaleSchema } from "@/lib/validation";
import { writeAudit, getClientIp } from "@/lib/audit";

type Params = { params: Promise<{ scaleId: string }> };

export const GET = handler(async (_req: NextRequest, { params }: Params) => {
  await requireStaff();
  const { scaleId } = await params;
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
  if (!scale) throw notFound("척도를 찾을 수 없습니다.");
  return ok({ scale });
});

export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { scaleId } = await params;
  const input = updateScaleSchema.parse(await req.json());

  const existing = await prisma.scale.findUnique({ where: { id: scaleId } });
  if (!existing) throw notFound("척도를 찾을 수 없습니다.");

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
