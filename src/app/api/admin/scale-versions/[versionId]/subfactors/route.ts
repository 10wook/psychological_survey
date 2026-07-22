import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handler, notFound, ok } from "@/lib/http";
import { createSubfactorSchema } from "@/lib/validation";
import { assertScaleVersionEditable } from "@/lib/lock";
import { assertOwnsScaleVersion } from "@/lib/ownership";

type Params = { params: Promise<{ versionId: string }> };

// 하위요인 추가 (문서 6.4).
export const POST = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { versionId } = await params;
  await assertOwnsScaleVersion(user, versionId);
  await assertScaleVersionEditable(versionId);

  const version = await prisma.scaleVersion.findUnique({ where: { id: versionId } });
  if (!version) throw notFound("척도 버전을 찾을 수 없습니다.");

  const input = createSubfactorSchema.parse(await req.json());
  const count = await prisma.subfactor.count({ where: { scaleVersionId: versionId } });

  const subfactor = await prisma.subfactor.create({
    data: {
      scaleVersionId: versionId,
      name: input.name,
      description: input.description,
      displayOrder: input.displayOrder ?? count + 1,
    },
  });

  return ok({ subfactor }, 201);
});
