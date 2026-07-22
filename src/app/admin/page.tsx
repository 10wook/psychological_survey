import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ownedSurveyWhere } from "@/lib/ownership";
import { Card, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "RESEARCHER")) redirect("/login?next=/admin");
  const surveyWhere = ownedSurveyWhere(user);

  const [surveyCount, activeSurveys, completedResponses, recentResponses] =
    await Promise.all([
      prisma.survey.count({ where: surveyWhere }),
      prisma.survey.count({ where: { ...surveyWhere, status: "PUBLISHED" } }),
      prisma.surveyResponse.count({
        where: { status: "COMPLETED", survey: surveyWhere },
      }),
      prisma.surveyResponse.findMany({
        where: { status: "COMPLETED", survey: surveyWhere },
        orderBy: { completedAt: "desc" },
        take: 5,
        include: { survey: true, participant: true },
      }),
    ]);

  const cards = [
    { label: "전체 설문 수", value: surveyCount },
    { label: "활성(게시) 설문", value: activeSurveys },
    { label: "총 완료 응답", value: completedResponses },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">대시보드</h1>
        <div className="flex gap-2">
          <LinkButton href="/admin/scales/new" variant="secondary" size="sm">
            척도 만들기
          </LinkButton>
          <LinkButton href="/admin/surveys/new" size="sm">
            설문 만들기
          </LinkButton>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{c.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">최근 완료 응답</h2>
        {recentResponses.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">아직 완료된 응답이 없습니다.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {recentResponses.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-700">{r.survey.title}</span>
                <span className="text-slate-400">
                  {r.participant.anonymousCode} ·{" "}
                  {r.completedAt?.toLocaleString("ko-KR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
