import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * 한 척도 버전의 구조(하위요인 + 문항 + 선택지)를 다른 버전으로 복제한다.
 * 새 버전 생성 / 척도 복제 시 사용. 문항의 subfactorId 는 새 하위요인 id 로 매핑.
 */
export async function cloneVersionContent(
  tx: Tx,
  sourceVersionId: string,
  targetVersionId: string,
): Promise<void> {
  const subfactors = await tx.subfactor.findMany({
    where: { scaleVersionId: sourceVersionId },
    orderBy: { displayOrder: "asc" },
  });

  const subfactorIdMap = new Map<string, string>();
  for (const sf of subfactors) {
    const created = await tx.subfactor.create({
      data: {
        scaleVersionId: targetVersionId,
        name: sf.name,
        description: sf.description,
        displayOrder: sf.displayOrder,
      },
    });
    subfactorIdMap.set(sf.id, created.id);
  }

  const questions = await tx.question.findMany({
    where: { scaleVersionId: sourceVersionId },
    orderBy: { displayOrder: "asc" },
    include: { options: { orderBy: { displayOrder: "asc" } } },
  });

  for (const q of questions) {
    await tx.question.create({
      data: {
        scaleVersionId: targetVersionId,
        subfactorId: q.subfactorId ? subfactorIdMap.get(q.subfactorId) ?? null : null,
        code: q.code,
        content: q.content,
        type: q.type,
        isReverse: q.isReverse,
        isActive: q.isActive,
        isRequired: q.isRequired,
        displayOrder: q.displayOrder,
        minSelect: q.minSelect,
        maxSelect: q.maxSelect,
        minScore: q.minScore,
        maxScore: q.maxScore,
        options: {
          create: q.options.map((o) => ({
            value: o.value,
            label: o.label,
            displayOrder: o.displayOrder,
          })),
        },
      },
    });
  }
}
