import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { forbidden, unauthorized } from "@/lib/http";
import type { User, UserRole } from "@prisma/client";

const SESSION_COOKIE = "psych_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14일

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set to a long random string in production.");
  }
  // 로컬 개발 폴백 (프로덕션에서는 사용하지 않음)
  return "dev-only-session-secret-change-me";
}

/** 쿠키 값: `${sessionId}.${hmac}` */
export function signSessionToken(sessionId: string): string {
  const sig = createHmac("sha256", sessionSecret()).update(sessionId).digest("base64url");
  return `${sessionId}.${sig}`;
}

export function verifySessionToken(token: string): string | null {
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const sessionId = token.slice(0, i);
  const sig = token.slice(i + 1);
  if (!sessionId || !sig) return null;

  const expected = createHmac("sha256", sessionSecret()).update(sessionId).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return sessionId;
}

// 문서 4.4 / 6.1: HttpOnly, Secure, SameSite 세션 쿠키. DB 저장으로 로그아웃 시 무효화.
export async function createSession(userId: string): Promise<void> {
  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, signSessionToken(session.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const sessionId = verifySessionToken(token);
    if (sessionId) {
      await prisma.session.deleteMany({ where: { id: sessionId } });
    }
    cookieStore.delete(SESSION_COOKIE);
  }
}

export type SafeUser = Omit<User, "passwordHash">;

function stripUser(user: User): SafeUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

/** 현재 로그인 사용자. 없으면 null */
export async function getCurrentUser(): Promise<SafeUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sessionId = verifySessionToken(token);
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.deleteMany({ where: { id: sessionId } });
    return null;
  }

  if (session.user.status !== "ACTIVE") return null;

  return stripUser(session.user);
}

/** 로그인 필수 (없으면 401 throw) */
export async function requireUser(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

const ROLE_RANK: Record<UserRole, number> = {
  RESPONDENT: 0,
  RESEARCHER: 1,
  ADMIN: 2,
};

/** 최소 권한 검증. RESEARCHER 이상 = 관리자 콘솔 접근 */
export async function requireRole(min: UserRole): Promise<SafeUser> {
  const user = await requireUser();
  if (ROLE_RANK[user.role] < ROLE_RANK[min]) throw forbidden();
  return user;
}

export async function requireStaff(): Promise<SafeUser> {
  return requireRole("RESEARCHER");
}

export async function requireAdmin(): Promise<SafeUser> {
  return requireRole("ADMIN");
}

export function canViewPii(user: SafeUser): boolean {
  return user.role === "ADMIN" || user.canViewPii;
}
