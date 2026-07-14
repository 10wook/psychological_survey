import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handler, notFound, ok } from "@/lib/http";
import { updateSubfactorSchema } from "@/lib/validation";
import { assertScaleVersionEditable } from "@/lib/lock";

type Params = { params: Promise<{ subfactorId: string }> };

export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  await requireStaff();
  const { subfactorId } = await params;

  const existing = await prisma.subfactor.findUnique({ where: { id: subfactorId } });
  if (!existing) throw notFound("하위요인을 찾을 수 없습니다.");
  await assertScaleVersionEditable(existing.scaleVersionId);

  const input = updateSubfactorSchema.parse(await req.json());
  const subfactor = await prisma.subfactor.update({
    where: { id: subfactorId },
    data: input,
  });
  return ok({ subfactor });
});

export const DELETE = handler(async (_req: NextRequest, { params }: Params) => {
  await requireStaff();
  const { subfactorId } = await params;

  const existing = await prisma.subfactor.findUnique({ where: { id: subfactorId } });
  if (!existing) throw notFound("하위요인을 찾을 수 없습니다.");
  await assertScaleVersionEditable(existing.scaleVersionId);

  // 문항의 subfactorId 는 onDelete: SetNull 로 자동 해제
  await prisma.subfactor.delete({ where: { id: subfactorId } });
  return ok({ deleted: true });
});
