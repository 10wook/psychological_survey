export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">개인정보 처리방침</h1>
        <div className="prose prose-slate mt-6 space-y-4 text-sm text-slate-700">
          <section>
            <h2 className="font-semibold">1. 수집하는 개인정보 항목</h2>
            <p>이메일, 비밀번호(암호화 저장), 출생연도, 성별을 수집합니다. 연구 응답
              데이터는 직접 식별정보와 분리되어 익명 코드로 관리됩니다.</p>
          </section>
          <section>
            <h2 className="font-semibold">2. 이용 목적</h2>
            <p>연구 목적의 설문 응답 수집·분석 및 결과 제공을 위해 이용합니다.</p>
          </section>
          <section>
            <h2 className="font-semibold">3. 보관 및 파기</h2>
            <p>연구 종료 또는 회원 탈퇴 시 관련 법령 및 연구 윤리 기준에 따라 처리합니다.</p>
          </section>
          <section>
            <h2 className="font-semibold">4. 동의 이력</h2>
            <p>동의 문구의 버전과 동의 시각을 기록·보관합니다.</p>
          </section>
          <p className="text-xs text-slate-400">본 문서는 예시이며 실제 배포 시 기관 정책에 맞게 수정해야 합니다.</p>
        </div>
      </main>
    </div>
  );
}
