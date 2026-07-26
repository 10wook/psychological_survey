import Link from "next/link";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ownedSurveyWhere } from "@/lib/ownership";
import { Badge, Card, EmptyState, LinkButton, cn } from "@/components/ui";

export const dynamic = "force-dynamic";

type SurveyTab = "active" | "ended";

const TABS: Array<{ id: SurveyTab; label: string }> = [
  { id: "active", label: "진행 중" },
  { id: "ended", label: "종료" },
];

function tabOf(sp: { tab?: string }): SurveyTab {
  return sp.tab === "ended" ? "ended" : "active";
}

export default async function SurveysPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "RESEARCHER")) redirect("/login?next=/admin");
  const sp = await searchParams;
  const tab = tabOf(sp);

  const surveys = await prisma.survey.findMany({
    where: ownedSurveyWhere(user),
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { responses: true, surveyScales: true } } },
  });

  const filtered = surveys.filter((s) => {
    if (tab === "active") return s.status === "DRAFT" || s.status === "PUBLISHED";
    // 종료 탭: CLOSED / LOCKED / ARCHIVED
    return s.status === "CLOSED" || s.status === "LOCKED" || s.status === "ARCHIVED";
  });

  const counts = {
    active: surveys.filter((s) => s.status === "DRAFT" || s.status === "PUBLISHED").length,
    ended: surveys.filter(
      (s) => s.status === "CLOSED" || s.status === "LOCKED" || s.status === "ARCHIVED",
    ).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">설문 관리</h1>
        <LinkButton href="/admin/surveys/new" size="sm">
          새 설문
        </LinkButton>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/surveys?tab=${t.id}`}
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
          title={tab === "ended" ? "종료된 설문이 없습니다." : "등록된 설문이 없습니다."}
          description={
            tab === "active" ? "척도를 묶어 새 설문을 만들어 배포하세요." : undefined
          }
          action={
            tab === "active" ? (
              <LinkButton href="/admin/surveys/new" size="sm">
                새 설문 만들기
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((s) => (
            <Card key={s.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Link
                  href={`/admin/surveys/${s.id}`}
                  className="font-medium text-slate-900 hover:text-brand-600"
                >
                  {s.title}
                </Link>
                <p className="mt-0.5 text-xs text-slate-500">
                  척도 {s._count.surveyScales}개 · 응답 {s._count.responses}건
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge value={s.status} />
                <LinkButton href={`/admin/surveys/${s.id}`} variant="secondary" size="sm">
                  관리
                </LinkButton>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
