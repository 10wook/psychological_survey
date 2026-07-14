import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { forbidden } from "@/lib/http";
import { getCurrentUser, type SafeUser } from "@/lib/auth";

// 비회원(게스트) 응답 인가.
// 회원: 세션 사용자가 응답의 참가자를 소유하면 통과.
// 비회원: 응답별 쿠키(ra_<id>)의 토큰이 저장된 accessToken 과 일치하면 통과.

export function responseCookieName(responseId: string): string {
  return `ra_${responseId}`;
}

export function generateAccessToken(): string {
  return randomBytes(24).toString("hex");
}

interface AuthorizableResponse {
  id: string;
  accessToken: string | null;
  participant: { userId: string | null };
}

/** 이미 로드된 응답에 대한 접근 인가. 실패 시 403. 성공 시 현재 사용자(없으면 null) 반환. */
export async function assertCanAccessResponse(
  response: AuthorizableResponse,
): Promise<{ user: SafeUser | null }> {
  const user = await getCurrentUser();
  if (user && response.participant.userId && response.participant.userId === user.id) {
    return { user };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(responseCookieName(response.id))?.value;
  if (token && response.accessToken && token === response.accessToken) {
    return { user };
  }

  throw forbidden();
}

/** 게스트 응답 시작 시 쿠키에 토큰을 심는다. */
export async function setResponseAccessCookie(
  responseId: string,
  token: string,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(responseCookieName(responseId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7일
  });
}
