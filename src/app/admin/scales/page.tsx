import Link from "next/link";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ownedScaleWhere } from "@/lib/ownership";
import { Badge, Card, EmptyState, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ScalesPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "RESEARCHER")) redirect("/login?next=/admin");
  const scales = await prisma.scale.findMany({
    where: ownedScaleWhere(user),
    orderBy: { updatedAt: "desc" },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true, status: true, _count: { select: { questions: true } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">척도 관리</h1>
        <LinkButton href="/admin/scales/new" size="sm">
          새 척도
        </LinkButton>
      </div>

      {scales.length === 0 ? (
        <EmptyState
          title="등록된 척도가 없습니다."
          description="첫 척도를 만들어 문항과 하위요인을 구성하세요."
          action={<LinkButton href="/admin/scales/new" size="sm">새 척도 만들기</LinkButton>}
        />
      ) : (
        <div className="grid gap-3">
          {scales.map((s) => {
            const latest = s.versions[0];
            return (
              <Card key={s.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Link
                      href={`/admin/scales/${s.id}`}
                      className="font-medium text-slate-900 hover:text-brand-600"
                    >
                      {s.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500">
                      최신 v{latest?.versionNumber ?? "-"} · 문항 {latest?._count.questions ?? 0}개
                      {!s.isActive && " · 비활성"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {latest && <Badge value={latest.status} />}
                    <LinkButton href={`/admin/scales/${s.id}`} variant="secondary" size="sm">
                      편집
                    </LinkButton>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
