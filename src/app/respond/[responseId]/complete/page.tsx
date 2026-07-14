import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, LinkButton } from "@/components/ui";

export default async function CompletePage({
  params,
}: {
  params: Promise<{ responseId: string }>;
}) {
  const { responseId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const response = await prisma.surveyResponse.findUnique({
    where: { id: responseId },
    include: { participant: true, survey: true },
  });
  if (!response || response.participant.userId !== user.id) redirect("/surveys");

  const showResult = response.survey.showResult && response.status === "COMPLETED";

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">
          ✓
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">설문이 완료되었습니다</h1>
        <p className="mt-2 text-sm text-slate-600">응답해 주셔서 감사합니다.</p>
        <div className="mt-6 flex flex-col gap-2">
          {showResult && (
            <LinkButton href={`/result/${responseId}`}>결과 보기</LinkButton>
          )}
          <LinkButton href="/surveys" variant="secondary">
            내 설문으로 이동
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}
