import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { createScaleSchema } from "@/lib/validation";
import { writeAudit, getClientIp } from "@/lib/audit";

// GET: 척도 목록 (최신 버전 요약 포함)
export const GET = handler(async () => {
  await requireStaff();
  const scales = await prisma.scale.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          versionNumber: true,
          status: true,
          _count: { select: { questions: true } },
        },
      },
    },
  });
  return ok({ scales });
});

// POST: 척도 생성 (+ 버전 1 DRAFT 자동 생성)
export const POST = handler(async (req: NextRequest) => {
  const user = await requireStaff();
  const input = createScaleSchema.parse(await req.json());

  const scale = await prisma.scale.create({
    data: {
      name: input.name,
      description: input.description,
      sourceTitle: input.sourceTitle,
      sourceAuthor: input.sourceAuthor,
      sourceYear: input.sourceYear,
      sourceUrl: input.sourceUrl || null,
      licenseNote: input.licenseNote,
      createdById: user.id,
      versions: {
        create: {
          versionNumber: 1,
          status: "DRAFT",
          minScore: input.minScore,
          maxScore: input.maxScore,
        },
      },
    },
    include: { versions: true },
  });

  await writeAudit({
    actorUserId: user.id,
    entityType: "Scale",
    entityId: scale.id,
    action: "SCALE_CREATED",
    after: { name: scale.name },
    ipAddress: getClientIp(req),
  });

  return ok({ scale }, 201);
});
