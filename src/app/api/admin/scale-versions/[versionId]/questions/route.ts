import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { badRequest, conflict, handler, notFound, ok } from "@/lib/http";
import { createQuestionSchema } from "@/lib/validation";
import { assertScaleVersionEditable } from "@/lib/lock";

type Params = { params: Promise<{ versionId: string }> };

// 문항 추가 (문서 6.3). 선택지 미제공 시 척도 범위로 기본 선택지 생성.
export const POST = handler(async (req: NextRequest, { params }: Params) => {
  await requireStaff();
  const { versionId } = await params;
  await assertScaleVersionEditable(versionId);

  const version = await prisma.scaleVersion.findUnique({ where: { id: versionId } });
  if (!version) throw notFound("척도 버전을 찾을 수 없습니다.");

  const input = createQuestionSchema.parse(await req.json());

  const dup = await prisma.question.findUnique({
    where: { scaleVersionId_code: { scaleVersionId: versionId, code: input.code } },
  });
  if (dup) throw conflict(`문항 코드 '${input.code}' 가 이미 존재합니다.`);

  if (input.subfactorId) {
    const sf = await prisma.subfactor.findFirst({
      where: { id: input.subfactorId, scaleVersionId: versionId },
    });
    if (!sf) throw badRequest("해당 하위요인이 이 척도 버전에 없습니다.");
  }

  const count = await prisma.question.count({ where: { scaleVersionId: versionId } });
  const min = input.minScore ?? version.minScore;
  const max = input.maxScore ?? version.maxScore;

  const defaultOptions =
    input.options && input.options.length > 0
      ? input.options
      : Array.from({ length: max - min + 1 }, (_, i) => ({
          value: min + i,
          label: String(min + i),
          displayOrder: i + 1,
        }));

  const question = await prisma.question.create({
    data: {
      scaleVersionId: versionId,
      subfactorId: input.subfactorId ?? null,
      code: input.code,
      content: input.content,
      isReverse: input.isReverse,
      isActive: input.isActive,
      displayOrder: input.displayOrder ?? count + 1,
      minScore: input.minScore ?? null,
      maxScore: input.maxScore ?? null,
      options: {
        create: defaultOptions.map((o, idx) => ({
          value: o.value,
          label: o.label,
          displayOrder: o.displayOrder ?? idx + 1,
        })),
      },
    },
    include: { options: { orderBy: { displayOrder: "asc" } } },
  });

  return ok({ question }, 201);
});
