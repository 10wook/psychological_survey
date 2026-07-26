import Link from "next/link";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ownedScaleWhere } from "@/lib/ownership";
import { Badge, Card, EmptyState, LinkButton, cn } from "@/components/ui";

export const dynamic = "force-dynamic";

type ScaleTab = "published" | "locked" | "inactive";

const TABS: Array<{ id: ScaleTab; label: string }> = [
  { id: "published", label: "게시됨" },
  { id: "locked", label: "잠금" },
  { id: "inactive", label: "비활성화" },
];

function tabOf(sp: { tab?: string }): ScaleTab {
  if (sp.tab === "locked" || sp.tab === "inactive") return sp.tab;
  return "published";
}

export default async function ScalesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "RESEARCHER")) redirect("/login?next=/admin");
  const sp = await searchParams;
  const tab = tabOf(sp);

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

  const filtered = scales.filter((s) => {
    const latest = s.versions[0];
    if (tab === "inactive") return !s.isActive;
    if (!s.isActive) return false;
    if (tab === "locked") return latest?.status === "LOCKED";
    // published 탭: 활성 + 최신 버전이 DRAFT/PUBLISHED/ARCHIVED (잠금·비활성 제외)
    return latest?.status !== "LOCKED";
  });

  const counts = {
    published: scales.filter((s) => s.isActive && s.versions[0]?.status !== "LOCKED").length,
    locked: scales.filter((s) => s.isActive && s.versions[0]?.status === "LOCKED").length,
    inactive: scales.filter((s) => !s.isActive).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">척도 관리</h1>
        <LinkButton href="/admin/scales/new" size="sm">
          새 척도
        </LinkButton>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/scales?tab=${t.id}`}
            className={cn(
              "px-3 py-2 text-sm font-medium transition",
              tab === t.id
                ? "border-b-2 border-brand-600 text-brand-700"
                : "text-slate-500 hover:text-slate-800",
            )}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-slate-400">{counts[t.id]}</span>
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={
            tab === "inactive"
              ? "비활성화된 척도가 없습니다."
              : tab === "locked"
                ? "잠긴 척도가 없습니다."
                : "등록된 척도가 없습니다."
          }
          description={
            tab === "published"
              ? "첫 척도를 만들어 문항과 하위요인을 구성하세요."
              : undefined
          }
          action={
            tab === "published" ? (
              <LinkButton href="/admin/scales/new" size="sm">
                새 척도 만들기
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((s) => {
            const latest = s.versions[0];
            return (
              <Card key={s.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/scales/${s.id}`}
                      className="font-medium text-slate-900 hover:text-brand-600"
                    >
                      {s.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500">
                      최신 v{latest?.versionNumber ?? "-"} · 문항 {latest?._count.questions ?? 0}개
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!s.isActive && <Badge value="INACTIVE" />}
                    {latest && s.isActive && <Badge value={latest.status} />}
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
