"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { api } from "@/lib/client";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";

const CURRENT_YEAR = new Date().getFullYear();

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/surveys";

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    passwordConfirm: "",
    birthYear: "",
    birthMonth: "",
    birthDay: "",
    gender: "",
  });
  const [consent, setConsent] = useState({
    resultDelivery: false,
    personalIdentification: false,
    privacy: false,
    research: false,
    marketing: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.gender) {
      setError("성별을 선택하세요.");
      return;
    }
    if (!consent.resultDelivery || !consent.personalIdentification) {
      setError("이메일·연락처 개인정보 수집 및 이용 동의 항목에 모두 체크해야 합니다.");
      return;
    }
    if (!consent.privacy || !consent.research) {
      setError("필수 동의 항목에 모두 체크해야 가입할 수 있습니다.");
      return;
    }
    if (form.password !== form.passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    const res = await api.post("/api/auth/register", {
      name: form.name,
      email: form.email,
      phone: form.phone,
      password: form.password,
      passwordConfirm: form.passwordConfirm,
      birthYear: Number(form.birthYear),
      birthMonth: Number(form.birthMonth),
      birthDay: Number(form.birthDay),
      gender: form.gender,
      consentResultDelivery: consent.resultDelivery,
      consentPersonalIdentification: consent.personalIdentification,
      consentPrivacy: consent.privacy,
      consentResearch: consent.research,
      consentMarketing: consent.marketing,
      documentVersion: "v1",
    });
    setLoading(false);

    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md p-8">
      <h1 className="text-xl font-bold text-slate-900">회원가입</h1>
      <p className="mt-1 text-sm text-slate-500">응답자 계정을 생성합니다.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <Field label="이름" htmlFor="name" required>
          <Input id="name" value={form.name} onChange={(e) => update("name", e.target.value)} required />
        </Field>
        <Field label="이메일" htmlFor="email" required>
          <Input id="email" type="email" autoComplete="email" value={form.email}
            onChange={(e) => update("email", e.target.value)} required />
        </Field>
        <Field label="연락처" htmlFor="phone" required>
          <Input id="phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} required />
        </Field>

        <fieldset className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <legend className="px-1 text-xs font-medium text-slate-600">
            개인정보 수집 및 이용 동의 (이메일·연락처)
          </legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5" checked={consent.resultDelivery}
              onChange={(e) => setConsent((c) => ({ ...c, resultDelivery: e.target.checked }))} />
            <span>[필수] 응답 결과 발송</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5" checked={consent.personalIdentification}
              onChange={(e) => setConsent((c) => ({ ...c, personalIdentification: e.target.checked }))} />
            <span>[필수] 개인 식별</span>
          </label>
        </fieldset>

        <Field label="비밀번호" htmlFor="password" hint="8자 이상, 영문·숫자 포함" required>
          <Input id="password" type="password" autoComplete="new-password" value={form.password}
            onChange={(e) => update("password", e.target.value)} required />
        </Field>
        <Field label="비밀번호 확인" htmlFor="passwordConfirm" required>
          <Input id="passwordConfirm" type="password" autoComplete="new-password"
            value={form.passwordConfirm}
            onChange={(e) => update("passwordConfirm", e.target.value)} required />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="출생년" htmlFor="birthYear" required>
            <Input id="birthYear" type="number" min={1900} max={CURRENT_YEAR} placeholder="1998"
              value={form.birthYear} onChange={(e) => update("birthYear", e.target.value)} required />
          </Field>
          <Field label="월" htmlFor="birthMonth" required>
            <Input id="birthMonth" type="number" min={1} max={12} placeholder="1"
              value={form.birthMonth} onChange={(e) => update("birthMonth", e.target.value)} required />
          </Field>
          <Field label="일" htmlFor="birthDay" required>
            <Input id="birthDay" type="number" min={1} max={31} placeholder="1"
              value={form.birthDay} onChange={(e) => update("birthDay", e.target.value)} required />
          </Field>
        </div>
        <Field label="성별" htmlFor="gender" required>
          <Select id="gender" value={form.gender} onChange={(e) => update("gender", e.target.value)} required>
            <option value="" disabled>선택하세요</option>
            <option value="MALE">남성</option>
            <option value="FEMALE">여성</option>
            <option value="OTHER">기타</option>
          </Select>
        </Field>

        <fieldset className="space-y-2 rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-xs font-medium text-slate-500">동의</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5" checked={consent.privacy}
              onChange={(e) => setConsent((c) => ({ ...c, privacy: e.target.checked }))} />
            <span>[필수] 개인정보 수집·이용에 동의합니다.</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5" checked={consent.research}
              onChange={(e) => setConsent((c) => ({ ...c, research: e.target.checked }))} />
            <span>[필수] 연구 참여에 동의합니다.</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5" checked={consent.marketing}
              onChange={(e) => setConsent((c) => ({ ...c, marketing: e.target.checked }))} />
            <span>[선택] 마케팅 정보 수신에 동의합니다.</span>
          </label>
        </fieldset>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "가입 중..." : "회원가입"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        이미 계정이 있으신가요?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-medium text-brand-600 hover:underline">
          로그인
        </Link>
      </p>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Suspense fallback={<p className="text-sm text-slate-500">불러오는 중...</p>}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
