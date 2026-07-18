import { getCurrentUser } from "@/lib/auth";
import { LinkButton } from "@/components/ui";

export default async function HomePage() {
  const user = await getCurrentUser();
  const isStaff = user && (user.role === "ADMIN" || user.role === "RESEARCHER");

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-4 py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            심리척도 기반 설문·분석 플랫폼
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">
            척도를 재사용 단위로 관리하고, 역문항·하위요인을 자동 채점하며, 버전과 잠금으로
            과거 응답을 재현 가능하게 보존하는 연구 특화 설문 도구입니다.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            {user ? (
              <>
                <LinkButton href="/surveys">내 설문 보기</LinkButton>
                {isStaff && (
                  <LinkButton href="/admin" variant="secondary">
                    관리자 콘솔
                  </LinkButton>
                )}
              </>
            ) : (
              <>
                <LinkButton href="/register">응답자로 시작하기</LinkButton>
                <LinkButton href="/login" variant="secondary">
                  로그인
                </LinkButton>
              </>
            )}
          </div>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            { t: "척도 재사용", d: "척도와 설문을 분리해 동일 척도를 여러 설문에서 재사용" },
            { t: "자동 채점", d: "역문항 변환·하위요인 합계/평균을 서버에서 자동 계산" },
            { t: "버전·잠금", d: "응답이 시작된 척도는 잠그고 새 버전으로 안전하게 수정" },
          ].map((f) => (
            <div key={f.t} className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="font-semibold text-slate-900">{f.t}</p>
              <p className="mt-1 text-sm text-slate-600">{f.d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
