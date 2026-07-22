import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handler, notFound, ok } from "@/lib/http";
import { updateQuestionSchema } from "@/lib/validation";
import { assertScaleVersionEditable } from "@/lib/lock";
import { assertOwnsQuestion } from "@/lib/ownership";

type Params = { params: Promise<{ questionId: string }> };

export const PATCH = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { questionId } = await params;
  await assertOwnsQuestion(user, questionId);

  const existing = await prisma.question.findUnique({ where: { id: questionId } });
  if (!existing) throw notFound("문항을 찾을 수 없습니다.");
  await assertScaleVersionEditable(existing.scaleVersionId);

  const input = updateQuestionSchema.parse(await req.json());
  const nextType = input.type ?? existing.type;

  const question = await prisma.$transaction(async (tx) => {
    const updated = await tx.question.update({
      where: { id: questionId },
      data: {
        code: input.code,
        content: input.content,
        type: input.type,
        isReverse: nextType === "LIKERT" ? input.isReverse : false,
        isActive: input.isActive,
        isRequired: input.isRequired,
        subfactorId: input.subfactorId === undefined ? undefined : input.subfactorId,
        minScore: input.minScore === undefined ? undefined : input.minScore,
        maxScore: input.maxScore === undefined ? undefined : input.maxScore,
        minSelect: nextType === "MULTIPLE" ? (input.minSelect ?? null) : null,
        maxSelect: nextType === "MULTIPLE" ? (input.maxSelect ?? null) : null,
        displayOrder: input.displayOrder,
      },
    });
    if (input.options) {
      await tx.questionOption.deleteMany({ where: { questionId } });
      if (nextType !== "TEXT") {
        await tx.questionOption.createMany({
          data: input.options.map((o, idx) => ({
            questionId,
            value: o.value,
            label: o.label,
            displayOrder: o.displayOrder ?? idx + 1,
          })),
        });
      }
    }
    return updated;
  });

  return ok({ question });
});

export const DELETE = handler(async (_req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { questionId } = await params;
  await assertOwnsQuestion(user, questionId);

  const existing = await prisma.question.findUnique({ where: { id: questionId } });
  if (!existing) throw notFound("문항을 찾을 수 없습니다.");
  await assertScaleVersionEditable(existing.scaleVersionId);

  await prisma.question.delete({ where: { id: questionId } });
  return ok({ deleted: true });
});
