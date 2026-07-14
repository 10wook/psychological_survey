import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handler, notFound, ok } from "@/lib/http";
import { updateScaleVersionSchema } from "@/lib/validation";
import { assertScaleVersionEditable, shouldLockScaleVersion } from "@/lib/lock";
import type { Prisma } from "@prisma/client";

type Params = { params: Promise<{ versionId: string }> };

export const GET = handler(async (_req: NextRequest, { params }: Params) => {
  await requireStaff();
  const { versionId } = await params;
  const version = await prisma.scaleVersion.findUnique({
    where: { id: versionId },
    include: {
      scale: true,
      subfactors: { orderBy: { displayOrder: "asc" } },
      questions: {
        orderBy: { displayOrder: "asc" },
        include: { options: { orderBy: { displayOrder: "asc" } } },
      },
    },
  });
  if (!version) throw notFound("척도 버전을 찾을 수 없습니다.");
  const locked = await shouldLockScaleVersion(versionId);
  return ok({ version, locked });
});

export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  await requireStaff();
  const { versionId } = await params;
  await assertScaleVersionEditable(versionId);
  const input = updateScaleVersionSchema.parse(await req.json());

  const version = await prisma.scaleVersion.update({
    where: { id: versionId },
    data: {
      minScore: input.minScore,
      maxScore: input.maxScore,
      requiredByDefault: input.requiredByDefault,
      shuffleQuestions: input.shuffleQuestions,
      estimatedSeconds: input.estimatedSeconds,
      interpretationConfig:
        input.interpretationConfig === undefined
          ? undefined
          : (input.interpretationConfig as Prisma.InputJsonValue),
    },
  });
  return ok({ version });
});
