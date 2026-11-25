import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handler, notFound, ok } from "@/lib/http";
import { assertCanReadSharedScale } from "@/lib/ownership";

type Params = { params: Promise<{ scaleId: string }> };

/** 공유 척도 상세 (읽기 전용) (이슈 #39) */
export const GET = handler(async (_req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { scaleId } = await params;
  await assertCanReadSharedScale(user, scaleId);

  const scale = await prisma.scale.findUnique({
    where: { id: scaleId },
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
          profile: { select: { name: true } },
        },
      },
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        include: {
          subfactors: { orderBy: { displayOrder: "asc" } },
          questions: {
            where: { isActive: true },
            orderBy: { displayOrder: "asc" },
            include: { options: { orderBy: { displayOrder: "asc" } } },
          },
        },
      },
    },
  });
  if (!scale || (!scale.isShared && scale.createdById !== user.id && user.role !== "ADMIN")) {
    throw notFound("공유된 척도를 찾을 수 없습니다.");
  }

  return ok({ scale });
});
