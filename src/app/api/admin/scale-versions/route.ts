import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handler, ok } from "@/lib/http";

// 설문에 연결 가능한 척도 버전 목록 (게시됨 또는 잠김). DRAFT 제외.
export const GET = handler(async () => {
  await requireStaff();
  const versions = await prisma.scaleVersion.findMany({
    where: { status: { in: ["PUBLISHED", "LOCKED"] }, scale: { isActive: true } },
    orderBy: [{ scale: { name: "asc" } }, { versionNumber: "desc" }],
    include: {
      scale: { select: { name: true } },
      _count: { select: { questions: { where: { isActive: true } } } },
    },
  });
  return ok({ versions });
});
