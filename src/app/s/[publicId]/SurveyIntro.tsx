"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";

interface Intro {
  title: string;
  description: string | null;
  instructions: string | null;
  requireLogin: boolean;
  notStarted: boolean;
  ended: boolean;
  totalQuestions: number;
  estimatedSeconds: number;
  scales: Array<{ id: string; name: string; questionCount: number }>;
}

type Step = "intro" | "choose" | "guest-form";

const CURRENT_YEAR = new Date().getFullYear();
const GUEST_HINT = "회원가입해두면 매번 귀찮게 입력할 필요가 없어요!";

const emptyGuest = {
  name: "",
  email: "",
  phone: "",
  birthYear: "",
  birthMonth: "",
  birthDay: "",
  gender: "",
};

const emptyGuestConsent = {
  resultDelivery: false,
  personalIdentification: false,
};

export function SurveyIntro({ publicId }: { publicId: string }) {
  const router = useRouter();
  const [intro, setIntro] = useState<Intro | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>("intro");
  const [guest, setGuest] = useState(emptyGuest);
  const [guestConsent, setGuestConsent] = useState(emptyGuestConsent);
  const [error, setError] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [starting, setStarting] = useState(false);
  const [hint, setHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void (async () => {
      const [introRes, meRes] = await Promise.all([
        api.get<{ survey: Intro }>(`/api/public/surveys/${publicId}`),
        api.get<{ user: unknown | null }>("/api/auth/me"),
      ]);
      if (introRes.ok) setIntro(introRes.data.survey);
      else setError(introRes.error.message);
      if (meRes.ok) setLoggedIn(!!meRes.data.user);
    })();
  }, [publicId]);

  function showGuestHint() {
    setHint(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(false), 4000);
  }

  async function startMember() {
    setError(null);
    setStarting(true);
    const res = await api.post<{ responseId: string }>(`/api/public/surveys/${publicId}/start`, {});
    setStarting(false);
    if (!res.ok) {
      if (res.error.code === "UNAUTHORIZED") {
        router.push(`/login?next=/s/${publicId}`);
        return;
      }
      setError(res.error.message);
      return;
    }
    router.push(`/respond/${res.data.responseId}`);
  }

  async function startGuest() {
    setError(null);
    if (!guest.name || !guest.email || !guest.phone) {
      setError("이름, 이메일, 연락처를 모두 입력해 주세요.");
      return;
    }
    if (!guest.gender) {
      setError("성별을 선택하세요.");
      return;
    }
    if (!guestConsent.resultDelivery || !guestConsent.personalIdentification) {
      setError("이메일·연락처 개인정보 수집 및 이용 동의 항목에 모두 체크해야 합니다.");
      return;
    }
    setStarting(true);
    const res = await api.post<{ responseId: string }>(`/api/public/surveys/${publicId}/start`, {
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
      birthYear: Number(guest.birthYear),
      birthMonth: Number(guest.birthMonth),
      birthDay: Number(guest.birthDay),
      gender: guest.gender,
      consentResultDelivery: guestConsent.resultDelivery,
      consentPersonalIdentification: guestConsent.personalIdentification,
    });
    setStarting(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    router.push(`/respond/${res.data.responseId}`);
  }

  function onStartClick() {
    if (!agree) return;
    if (loggedIn) {
      void startMember();
      return;
    }
    if (intro?.requireLogin) {
      router.push(`/login?next=/s/${publicId}`);
      return;
    }
    setStep("choose");
  }

  if (error && !intro) return <Alert variant="error">{error}</Alert>;
  if (!intro || loggedIn === null) return <p className="text-sm text-slate-500">불러오는 중...</p>;

  const minutes = Math.max(1, Math.round(intro.estimatedSeconds / 60));

  // --- 회원/비회원 선택 ---
  if (step === "choose") {
    return (
      <Card className="space-y-5 p-6">
        <h1 className="text-xl font-bold text-slate-900">응답 방법 선택</h1>
        <p className="text-sm text-slate-600">{intro.title}</p>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => router.push(`/login?next=/s/${publicId}`)}
            className="rounded-xl border-2 border-slate-200 p-5 text-left transition hover:border-brand-400 hover:bg-brand-50"
          >
            <p className="font-semibold text-slate-900">회원으로 응답</p>
            <p className="mt-1 text-xs text-slate-500">로그인 후 응답합니다. 다음에도 정보 입력 없이 참여할 수 있습니다.</p>
          </button>
          <button
            type="button"
            onClick={() => setStep("guest-form")}
            className="rounded-xl border-2 border-slate-200 p-5 text-left transition hover:border-brand-400 hover:bg-brand-50"
          >
            <p className="font-semibold text-slate-900">비회원으로 응답</p>
            <p className="mt-1 text-xs text-slate-500">별도 가입 없이 정보를 입력하고 바로 응답합니다.</p>
          </button>
        </div>
        <Button variant="secondary" onClick={() => setStep("intro")}>← 돌아가기</Button>
      </Card>
    );
  }

  // --- 비회원 정보 입력 ---
  if (step === "guest-form") {
    return (
      <Card className="relative space-y-4 p-6">
        {hint && (
          <div className="fixed inset-x-0 top-4 z-50 mx-auto max-w-md animate-pulse rounded-lg bg-brand-600 px-4 py-3 text-center text-sm text-white shadow-lg">
            {GUEST_HINT}{" "}
            <Link href={`/register?next=/s/${publicId}`} className="underline">
              회원가입
            </Link>
          </div>
        )}
        <h1 className="text-xl font-bold text-slate-900">비회원 응답</h1>
        <p className="text-sm text-slate-500">아래 정보를 입력한 뒤 설문을 시작합니다.</p>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="space-y-3">
          <Field label="이름" htmlFor="g-name" required>
            <Input id="g-name" value={guest.name} onChange={(e) => { setGuest((g) => ({ ...g, name: e.target.value })); showGuestHint(); }} required />
          </Field>
          <Field label="이메일" htmlFor="g-email" required>
            <Input id="g-email" type="email" value={guest.email} onChange={(e) => { setGuest((g) => ({ ...g, email: e.target.value })); showGuestHint(); }} required />
          </Field>
          <Field label="연락처" htmlFor="g-phone" required>
            <Input id="g-phone" value={guest.phone} onChange={(e) => { setGuest((g) => ({ ...g, phone: e.target.value })); showGuestHint(); }} required />
          </Field>
          <fieldset className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <legend className="px-1 text-xs font-medium text-slate-600">
              개인정보 수집 및 이용 동의 (이메일·연락처)
            </legend>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" checked={guestConsent.resultDelivery}
                onChange={(e) => setGuestConsent((c) => ({ ...c, resultDelivery: e.target.checked }))} />
              <span>[필수] 응답 결과 발송</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" checked={guestConsent.personalIdentification}
                onChange={(e) => setGuestConsent((c) => ({ ...c, personalIdentification: e.target.checked }))} />
              <span>[필수] 개인 식별</span>
            </label>
          </fieldset>
          <div className="grid grid-cols-3 gap-2">
            <Field label="출생년" htmlFor="g-by" required>
              <Input id="g-by" type="number" min={1900} max={CURRENT_YEAR} placeholder="1998"
                value={guest.birthYear} onChange={(e) => setGuest((g) => ({ ...g, birthYear: e.target.value }))} required />
            </Field>
            <Field label="월" htmlFor="g-bm" required>
              <Input id="g-bm" type="number" min={1} max={12} placeholder="1"
                value={guest.birthMonth} onChange={(e) => setGuest((g) => ({ ...g, birthMonth: e.target.value }))} required />
            </Field>
            <Field label="일" htmlFor="g-bd" required>
              <Input id="g-bd" type="number" min={1} max={31} placeholder="1"
                value={guest.birthDay} onChange={(e) => setGuest((g) => ({ ...g, birthDay: e.target.value }))} required />
            </Field>
          </div>
          <Field label="성별" htmlFor="g-gender" required>
            <Select id="g-gender" value={guest.gender} onChange={(e) => setGuest((g) => ({ ...g, gender: e.target.value }))} required>
              <option value="" disabled>선택하세요</option>
              <option value="MALE">남성</option>
              <option value="FEMALE">여성</option>
              <option value="OTHER">기타</option>
            </Select>
          </Field>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setStep("choose")}>← 돌아가기</Button>
          <Button className="flex-1" onClick={startGuest} disabled={starting}>
            {starting ? "시작하는 중..." : "설문 시작"}
          </Button>
        </div>
      </Card>
    );
  }

  // --- 소개 화면 ---
  return (
    <Card className="space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{intro.title}</h1>
        {intro.description && <p className="mt-1 text-slate-600">{intro.description}</p>}
      </div>

      <div className="flex gap-4 text-sm text-slate-600">
        <span>문항 {intro.totalQuestions}개</span>
        <span>예상 소요 약 {minutes}분</span>
      </div>

      {intro.instructions && (
        <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-line">
          {intro.instructions}
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-slate-700">포함된 척도</p>
        <ul className="mt-1 list-inside list-disc text-sm text-slate-600">
          {intro.scales.map((s) => (
            <li key={s.id}>
              {s.name} <span className="text-slate-400">({s.questionCount}문항)</span>
            </li>
          ))}
        </ul>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {intro.notStarted ? (
        <Alert variant="warning">아직 시작되지 않은 설문입니다.</Alert>
      ) : intro.ended ? (
        <Alert variant="warning">종료된 설문입니다. 응답을 받을 수 없습니다.</Alert>
      ) : (
        <>
          <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm">
            <input type="checkbox" className="mt-0.5" checked={agree}
              onChange={(e) => setAgree(e.target.checked)} />
            <span>연구 참여 및 개인정보 수집·이용에 동의하며 설문에 응답합니다.</span>
          </label>
          <Button className="w-full" onClick={onStartClick} disabled={!agree || starting}>
            {starting ? "시작하는 중..." : loggedIn ? "설문 시작" : intro.requireLogin ? "로그인 후 시작" : "설문 시작"}
          </Button>
        </>
      )}
    </Card>
  );
}
