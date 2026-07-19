import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { createScaleSchema } from "@/lib/validation";
import { writeAudit, getClientIp } from "@/lib/audit";
import { normalizeLikertLabels, usesLikertRange } from "@/lib/likertLabels";

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
          scaleType: true,
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

  const likert = usesLikertRange(input.scaleType);
  const minScore = likert ? input.minScore : 1;
  const maxScore = likert ? input.maxScore : 5;
  const likertLabels = normalizeLikertLabels(
    input.scaleType,
    minScore,
    maxScore,
    input.likertLabels,
  );

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
          scaleType: input.scaleType,
          minScore,
          maxScore,
          likertLabels: (likertLabels ?? undefined) as Prisma.InputJsonValue | undefined,
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
    after: { name: scale.name, scaleType: input.scaleType },
    ipAddress: getClientIp(req),
  });

  return ok({ scale }, 201);
});
