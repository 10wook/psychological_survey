import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { responseCookieName } from "@/lib/responseAuth";
import { Card, LinkButton } from "@/components/ui";

export default async function CompletePage({
  params,
}: {
  params: Promise<{ responseId: string }>;
}) {
  const { responseId } = await params;
  const user = await getCurrentUser();

  const response = await prisma.surveyResponse.findUnique({
    where: { id: responseId },
    include: { participant: true, survey: true },
  });
  if (!response) redirect("/");

  const isOwnerMember = Boolean(
    user &&
      response.participant.userId &&
      response.participant.userId === user.id,
  );

  // 비회원(게스트)은 응답별 쿠키 토큰으로 완료 화면 접근을 허용한다.
  let isGuest = false;
  if (!isOwnerMember) {
    const cookieStore = await cookies();
    const token = cookieStore.get(responseCookieName(responseId))?.value;
    isGuest = Boolean(
      token && response.accessToken && token === response.accessToken,
    );
  }

  if (!isOwnerMember && !isGuest) redirect("/");

  const showResult = response.survey.showResult && response.status === "COMPLETED";

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">
          ✓
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">설문이 완료되었습니다</h1>
        <p className="mt-2 text-sm text-slate-600">응답해 주셔서 감사합니다.</p>

        {isGuest ? (
          <>
            <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50 p-5 text-left">
              <p className="text-sm font-semibold text-brand-700">
                더 많은 경험과 연결될 기회!
              </p>
              <p className="mt-1 text-sm text-slate-600">
                회원가입하면 내 응답 기록을 저장하고, 결과를 다시 확인하거나 새로운
                설문에 참여할 수 있어요.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <LinkButton href="/register?next=/surveys">
                  회원가입하고 계속하기
                </LinkButton>
                <LinkButton href="/login?next=/surveys" variant="secondary">
                  이미 계정이 있어요 (로그인)
                </LinkButton>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {showResult && (
                <LinkButton href={`/result/${responseId}`} variant="secondary">
                  결과 보기
                </LinkButton>
              )}
              <LinkButton href="/" variant="ghost">
                괜찮아요, 나가기
              </LinkButton>
            </div>
          </>
        ) : (
          <div className="mt-6 flex flex-col gap-2">
            {showResult && (
              <LinkButton href={`/result/${responseId}`}>결과 보기</LinkButton>
            )}
            <LinkButton href="/surveys" variant="secondary">
              내 설문으로 이동
            </LinkButton>
          </div>
        )}
      </Card>
    </div>
  );
}
