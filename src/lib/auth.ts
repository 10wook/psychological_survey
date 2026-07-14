import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { forbidden, unauthorized } from "@/lib/http";
import type { User, UserRole } from "@prisma/client";

const SESSION_COOKIE = "psych_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14일

// 문서 4.4 / 6.1: HttpOnly, Secure, SameSite 세션 쿠키. DB 저장으로 로그아웃 시 무효화.
export async function createSession(userId: string): Promise<void> {
  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.id, {
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
    await prisma.session.deleteMany({ where: { id: token } });
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

  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.deleteMany({ where: { id: token } });
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
