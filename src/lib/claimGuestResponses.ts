import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { formatAnonymousCode } from "@/lib/ids";
import { RESPONSE_COOKIE_PREFIX } from "@/lib/responseAuth";

// 비회원(게스트)으로 참여한 응답을 로그인/회원가입한 계정으로 귀속시킨다 (이슈 #15).
// 브라우저의 응답 쿠키(ra_<responseId>)와 저장된 accessToken 이 일치하는
// 게스트 응답만 대상으로 하므로, 본인 브라우저에서 참여한 응답만 이전된다.
export async function claimGuestResponses(userId: string): Promise<number> {
  const cookieStore = await cookies();
  const candidates = cookieStore
    .getAll()
    .filter((c) => c.name.startsWith(RESPONSE_COOKIE_PREFIX) && c.value)
    .map((c) => ({
      responseId: c.name.slice(RESPONSE_COOKIE_PREFIX.length),
      token: c.value,
      cookieName: c.name,
    }));
  if (candidates.length === 0) return 0;

  const responses = await prisma.surveyResponse.findMany({
    where: { id: { in: candidates.map((c) => c.responseId) } },
    include: { participant: true },
  });
  const tokenByResponseId = new Map(candidates.map((c) => [c.responseId, c.token]));

  const claimable = responses.filter(
    (r) =>
      r.accessToken &&
      r.accessToken === tokenByResponseId.get(r.id) &&
      r.participant.isGuest &&
      r.participant.userId === null,
  );
  if (claimable.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    let participant = await tx.participant.findUnique({ where: { userId } });
    if (!participant) {
      const count = await tx.participant.count();
      participant = await tx.participant.create({
        data: { userId, anonymousCode: formatAnonymousCode(count + 1) },
      });
    }

    const guestParticipantIds = [...new Set(claimable.map((r) => r.participantId))];

    await tx.surveyResponse.updateMany({
      where: { id: { in: claimable.map((r) => r.id) } },
      data: { participantId: participant.id, accessToken: null },
    });

    // 응답이 모두 이전된 게스트 참가자 레코드(PII 포함)는 정리한다.
    const orphanGuests = await tx.participant.findMany({
      where: {
        id: { in: guestParticipantIds },
        isGuest: true,
        userId: null,
        responses: { none: {} },
      },
      select: { id: true },
    });
    if (orphanGuests.length > 0) {
      await tx.participant.deleteMany({
        where: { id: { in: orphanGuests.map((p) => p.id) } },
      });
    }
  });

  // 계정 귀속 후에는 세션 기반 인가를 사용하므로 게스트 쿠키는 제거한다.
  for (const r of claimable) {
    const candidate = candidates.find((c) => c.responseId === r.id);
    if (candidate) cookieStore.delete(candidate.cookieName);
  }

  return claimable.length;
}
