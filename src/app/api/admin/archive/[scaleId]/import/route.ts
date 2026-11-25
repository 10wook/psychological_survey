import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handler, notFound, ok } from "@/lib/http";
import { cloneVersionContent } from "@/lib/scaleClone";
import { writeAudit, getClientIp } from "@/lib/audit";
import { assertCanImportScale } from "@/lib/ownership";

type Params = { params: Promise<{ scaleId: string }> };

/**
 * 공유 척도를 내 계정으로 Deep Copy (이슈 #39).
 * 원본과 독립된 새 척도+v1 DRAFT 를 생성한다.
 */
export const POST = handler(async (req: NextRequest, { params }: Params) => {
  const user = await requireStaff();
  const { scaleId } = await params;
  await assertCanImportScale(user, scaleId);

  const source = await prisma.scale.findUnique({
    where: { id: scaleId },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  if (!source) throw notFound("척도를 찾을 수 없습니다.");
  const latest = source.versions[0];

  const newScale = await prisma.$transaction(async (tx) => {
    const created = await tx.scale.create({
      data: {
        name: source.name,
        description: source.description,
        instructions: source.instructions,
        sourceTitle: source.sourceTitle,
        sourceAuthor: source.sourceAuthor,
        sourceYear: source.sourceYear,
        sourceUrl: source.sourceUrl,
        sourceJournal: source.sourceJournal,
        sourceVolume: source.sourceVolume,
        sourceIssue: source.sourceIssue,
        licenseNote: source.licenseNote,
        isShared: false,
        sharedAt: null,
        createdById: user.id,
        versions: {
          create: {
            versionNumber: 1,
            status: "DRAFT",
            scaleType: latest?.scaleType ?? "LIKERT",
            minScore: latest?.minScore ?? 1,
            maxScore: latest?.maxScore ?? 5,
            likertLabels: latest?.likertLabels ?? undefined,
            requiredByDefault: latest?.requiredByDefault ?? true,
            shuffleQuestions: latest?.shuffleQuestions ?? false,
            estimatedSeconds: latest?.estimatedSeconds ?? null,
            interpretationConfig: latest?.interpretationConfig ?? undefined,
          },
        },
      },
      include: { versions: true },
    });
    if (latest) {
      await cloneVersionContent(tx, latest.id, created.versions[0]!.id);
    }
    return created;
  });

  await writeAudit({
    actorUserId: user.id,
    entityType: "Scale",
    entityId: newScale.id,
    action: "SCALE_IMPORTED_FROM_ARCHIVE",
    after: { fromScaleId: scaleId },
    ipAddress: getClientIp(req),
  });

  return ok({ scale: newScale }, 201);
});
