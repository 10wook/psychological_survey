import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card, EmptyState, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MySurveysPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/surveys");

  const participant = await prisma.participant.findUnique({
    where: { userId: user.id },
  });

  const responses = participant
    ? await prisma.surveyResponse.findMany({
        where: { participantId: participant.id },
        orderBy: { updatedAt: "desc" },
        include: { survey: true },
      })
    : [];

  const respondedSurveyIds = new Set(responses.map((r) => r.surveyId));

  const availableSurveys = await prisma.survey.findMany({
    where: {
      status: "PUBLISHED",
      OR: [{ endAt: null }, { endAt: { gte: new Date() } }],
    },
    orderBy: { publishedAt: "desc" },
  });

  const inProgress = responses.filter((r) => r.status === "IN_PROGRESS");
  const completed = responses.filter((r) => r.status === "COMPLETED");
  const available = availableSurveys.filter((s) => !respondedSurveyIds.has(s.id));

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">내 설문</h1>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">참여 가능한 설문</h2>
          {available.length === 0 ? (
            <EmptyState title="참여 가능한 새 설문이 없습니다." />
          ) : (
            available.map((s) => (
              <Card key={s.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-slate-900">{s.title}</p>
                  <p className="text-xs text-slate-500">{s.description}</p>
                </div>
                <LinkButton href={`/s/${s.publicId}`} size="sm">
                  참여하기
                </LinkButton>
              </Card>
            ))
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">작성 중인 설문</h2>
          {inProgress.length === 0 ? (
            <EmptyState title="작성 중인 설문이 없습니다." />
          ) : (
            inProgress.map((r) => (
              <Card key={r.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-slate-900">{r.survey.title}</p>
                  <p className="text-xs text-slate-500">
                    마지막 저장 {r.lastSavedAt.toLocaleString("ko-KR")}
                  </p>
                </div>
                <LinkButton href={`/respond/${r.id}`} size="sm">
                  이어서 응답
                </LinkButton>
              </Card>
            ))
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">완료한 설문</h2>
          {completed.length === 0 ? (
            <EmptyState title="완료한 설문이 없습니다." />
          ) : (
            completed.map((r) => (
              <Card key={r.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900">{r.survey.title}</p>
                  <Badge value={r.status} />
                </div>
                {r.survey.showResult ? (
                  <Link href={`/result/${r.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                    결과 보기
                  </Link>
                ) : (
                  <span className="text-xs text-slate-400">결과 비공개</span>
                )}
              </Card>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
