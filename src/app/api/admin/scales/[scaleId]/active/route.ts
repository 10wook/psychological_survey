import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handler, notFound, ok } from "@/lib/http";
import { writeAudit, getClientIp } from "@/lib/audit";

type Params = { params: Promise<{ scaleId: string }> };
const schema = z.object({ isActive: z.boolean() });

// 척도 비활성화/활성화 (문서 6.2). 물리 삭제 대신 비활성화.
export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { scaleId } = await params;
  const { isActive } = schema.parse(await req.json());

  const existing = await prisma.scale.findUnique({ where: { id: scaleId } });
  if (!existing) throw notFound("척도를 찾을 수 없습니다.");

  const scale = await prisma.scale.update({
    where: { id: scaleId },
    data: { isActive },
  });

  await writeAudit({
    actorUserId: user.id,
    entityType: "Scale",
    entityId: scaleId,
    action: isActive ? "SCALE_ACTIVATED" : "SCALE_DEACTIVATED",
    ipAddress: getClientIp(req),
  });

  return ok({ scale });
});
