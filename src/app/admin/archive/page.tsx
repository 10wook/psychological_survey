import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Badge, Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

/** 공유 척도 아카이브 (이슈 #39) */
export default async function ArchivePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/archive");

  const scales = await prisma.scale.findMany({
    where: { isShared: true, isActive: true },
    orderBy: [{ sharedAt: "desc" }, { updatedAt: "desc" }],
    include: {
      createdBy: {
        select: { email: true, profile: { select: { name: true } } },
      },
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: {
          versionNumber: true,
          status: true,
          scaleType: true,
          _count: { select: { questions: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">아카이브</h1>
        <p className="mt-1 text-sm text-slate-500">
          다른 이용자가 공유한 잠긴 척도입니다. 가져오면 내 척도 관리에 독립 복사본이 추가됩니다.
        </p>
      </div>

      {scales.length === 0 ? (
        <EmptyState
          title="공유된 척도가 없습니다."
          description="척도 관리에서 잠근 뒤 [공유하기]를 누르면 여기에 등록됩니다."
        />
      ) : (
        <div className="grid gap-3">
          {scales.map((s) => {
            const latest = s.versions[0];
            const owner =
              s.createdBy?.profile?.name || s.createdBy?.email || "알 수 없음";
            return (
              <Card key={s.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/archive/${s.id}`}
                      className="font-medium text-slate-900 hover:text-brand-600"
                    >
                      {s.name}
                    </Link>
                    {s.description && (
                      <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-slate-500">
                        {s.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {latest && (
                        <>
                          <span>v{latest.versionNumber}</span>
                          <Badge value={latest.status} />
                          <span>{latest._count.questions}문항</span>
                        </>
                      )}
                      <span>· 공유자 {owner}</span>
                      {(s.sourceAuthor || s.sourceYear) && (
                        <span>
                          · {[s.sourceAuthor, s.sourceYear].filter(Boolean).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/admin/archive/${s.id}`}
                    className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    보기
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
