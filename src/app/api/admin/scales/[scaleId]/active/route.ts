import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { writeAudit, getClientIp } from "@/lib/audit";
import { assertOwnsScale } from "@/lib/ownership";

type Params = { params: Promise<{ scaleId: string }> };
const schema = z.object({ isActive: z.boolean() });

// 척도 비활성화/활성화 (문서 6.2). 물리 삭제 대신 비활성화.
export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { scaleId } = await params;
  await assertOwnsScale(user, scaleId);
  const { isActive } = schema.parse(await req.json());

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
