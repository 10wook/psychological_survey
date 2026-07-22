import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { badRequest, conflict, handler, notFound, ok } from "@/lib/http";
import { createQuestionSchema } from "@/lib/validation";
import { assertScaleVersionEditable } from "@/lib/lock";
import { labelForLikertValue, parseLikertLabels } from "@/lib/likertLabels";
import { assertOwnsScaleVersion } from "@/lib/ownership";

type Params = { params: Promise<{ versionId: string }> };

function defaultOptionsForType(
  type: string,
  min: number,
  max: number,
  provided?: Array<{ value: number; label: string; displayOrder?: number }>,
  likertLabels?: string[] | null,
) {
  if (provided && provided.length > 0) return provided;
  if (type === "LIKERT") {
    return Array.from({ length: max - min + 1 }, (_, i) => {
      const value = min + i;
      return {
        value,
        label: labelForLikertValue(value, min, likertLabels),
        displayOrder: i + 1,
      };
    });
  }
  if (type === "SINGLE" || type === "MULTIPLE") {
    return [
      { value: 1, label: "옵션 1", displayOrder: 1 },
      { value: 2, label: "옵션 2", displayOrder: 2 },
    ];
  }
  return [];
}

// 문항 추가. 유형별 기본 선택지 자동 생성.
export const POST = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { versionId } = await params;
  await assertOwnsScaleVersion(user, versionId);
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
  const likertLabels = parseLikertLabels(version.likertLabels);
  const opts = defaultOptionsForType(input.type, min, max, input.options, likertLabels);

  const question = await prisma.question.create({
    data: {
      scaleVersionId: versionId,
      subfactorId: input.subfactorId ?? null,
      code: input.code,
      content: input.content,
      type: input.type,
      isReverse: input.type === "LIKERT" ? input.isReverse : false,
      isActive: input.isActive,
      isRequired: input.isRequired,
      displayOrder: input.displayOrder ?? count + 1,
      minScore: input.minScore ?? null,
      maxScore: input.maxScore ?? null,
      minSelect: input.type === "MULTIPLE" ? (input.minSelect ?? null) : null,
      maxSelect: input.type === "MULTIPLE" ? (input.maxSelect ?? null) : null,
      options: {
        create: opts.map((o, idx) => ({
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
