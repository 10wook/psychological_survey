import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { LinkButton } from "@/components/ui";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-sm font-semibold text-slate-900">
          심리척도 설문·분석 플랫폼
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Link href="/surveys" className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900">
                내 설문
              </Link>
              <span className="hidden text-xs text-slate-400 sm:inline">{user.email}</span>
              {/* 응답자/설문자 구분 없이 회원이면 설문자 콘솔 접근 가능 (이슈 #31) */}
              <LinkButton href="/admin" variant="secondary" size="sm">
                설문자 콘솔
              </LinkButton>
              <LogoutButton />
            </>
          ) : (
            <>
              <LinkButton href="/login" variant="secondary" size="sm">
                로그인
              </LinkButton>
              <LinkButton href="/register" size="sm">
                회원가입
              </LinkButton>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
