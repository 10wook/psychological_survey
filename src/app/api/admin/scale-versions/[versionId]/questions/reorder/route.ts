import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { reorderQuestionsSchema } from "@/lib/validation";
import { assertScaleVersionEditable } from "@/lib/lock";

type Params = { params: Promise<{ versionId: string }> };

// 문항 순서 변경 (문서 6.3).
export const POST = handler(async (req: NextRequest, { params }: Params) => {
  await requireStaff();
  const { versionId } = await params;
  await assertScaleVersionEditable(versionId);

  const { orderedIds } = reorderQuestionsSchema.parse(await req.json());

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.question.updateMany({
        where: { id, scaleVersionId: versionId },
        data: { displayOrder: index + 1 },
      }),
    ),
  );

  return ok({ reordered: orderedIds.length });
});
