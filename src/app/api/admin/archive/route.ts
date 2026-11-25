import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handler, ok } from "@/lib/http";

/** 공유된 척도(아카이브) 목록 (이슈 #39) */
export const GET = handler(async () => {
  await requireStaff();

  const scales = await prisma.scale.findMany({
    where: { isShared: true, isActive: true },
    orderBy: [{ sharedAt: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      description: true,
      sourceTitle: true,
      sourceAuthor: true,
      sourceYear: true,
      sourceJournal: true,
      sharedAt: true,
      createdBy: {
        select: {
          id: true,
          email: true,
          profile: { select: { name: true } },
        },
      },
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: {
          id: true,
          versionNumber: true,
          status: true,
          scaleType: true,
          _count: { select: { questions: true } },
        },
      },
    },
  });

  return ok({ scales });
});
