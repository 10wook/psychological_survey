import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/scales", label: "척도 관리" },
  { href: "/admin/surveys", label: "설문 관리" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 응답자/설문자 계정 구분 없음 (이슈 #31): 로그인한 회원 누구나 접근 가능
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:block">
          <div className="flex h-14 items-center px-4 text-sm font-semibold text-slate-900">
            설문자 콘솔
          </div>
          <nav className="space-y-1 px-2 py-2">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="block rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex-1">
          <div className="flex h-10 items-center justify-end gap-3 border-b border-slate-200 bg-white px-4">
            <Link href="/surveys" className="text-xs text-slate-500 hover:text-slate-800">
              ← 응답자 페이지
            </Link>
            <span className="text-xs text-slate-400">{user.email}</span>
          </div>
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
