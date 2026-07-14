import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge, Card, EmptyState, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SurveysPage() {
  const surveys = await prisma.survey.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { responses: true, surveyScales: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">설문 관리</h1>
        <LinkButton href="/admin/surveys/new" size="sm">
          새 설문
        </LinkButton>
      </div>

      {surveys.length === 0 ? (
        <EmptyState
          title="등록된 설문이 없습니다."
          description="척도를 묶어 새 설문을 만들어 배포하세요."
          action={<LinkButton href="/admin/surveys/new" size="sm">새 설문 만들기</LinkButton>}
        />
      ) : (
        <div className="grid gap-3">
          {surveys.map((s) => (
            <Card key={s.id} className="flex items-center justify-between p-4">
              <div>
                <Link href={`/admin/surveys/${s.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                  {s.title}
                </Link>
                <p className="mt-0.5 text-xs text-slate-500">
                  척도 {s._count.surveyScales}개 · 응답 {s._count.responses}건
                </p>
              </div>
              <div className="flex items-center gap-2">
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
