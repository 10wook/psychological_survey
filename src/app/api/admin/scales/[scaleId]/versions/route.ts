import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handler, notFound, ok } from "@/lib/http";
import { cloneVersionContent } from "@/lib/scaleClone";
import { writeAudit, getClientIp } from "@/lib/audit";

type Params = { params: Promise<{ scaleId: string }> };

// 새 척도 버전 생성. 최신 버전의 구조를 복제한 DRAFT 를 만든다 (문서 2.3).
export const POST = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { scaleId } = await params;

  const scale = await prisma.scale.findUnique({
    where: { id: scaleId },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  if (!scale) throw notFound("척도를 찾을 수 없습니다.");

  const latest = scale.versions[0];
  const nextNumber = (latest?.versionNumber ?? 0) + 1;

  const version = await prisma.$transaction(async (tx) => {
    const created = await tx.scaleVersion.create({
      data: {
        scaleId,
        versionNumber: nextNumber,
        status: "DRAFT",
        minScore: latest?.minScore ?? 1,
        maxScore: latest?.maxScore ?? 5,
        requiredByDefault: latest?.requiredByDefault ?? true,
        shuffleQuestions: latest?.shuffleQuestions ?? false,
        estimatedSeconds: latest?.estimatedSeconds ?? null,
        interpretationConfig: latest?.interpretationConfig ?? undefined,
      },
    });
    if (latest) {
      await cloneVersionContent(tx, latest.id, created.id);
    }
    return created;
  }, {
    // 문항/선택지 복제는 순차 쿼리가 많아, 서버리스↔DB 지연 시 기본 5초
    // 트랜잭션 제한을 넘겨 500이 발생할 수 있어 여유를 둔다.
    maxWait: 15000,
    timeout: 30000,
  });

  await writeAudit({
    actorUserId: user.id,
    entityType: "ScaleVersion",
    entityId: version.id,
    action: "SCALE_VERSION_CREATED",
    after: { versionNumber: nextNumber },
    ipAddress: getClientIp(req),
  });

  return ok({ version }, 201);
});
