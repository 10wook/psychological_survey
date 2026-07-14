"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";

const CURRENT_YEAR = new Date().getFullYear();

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    passwordConfirm: "",
    birthYear: "",
    gender: "UNDISCLOSED",
  });
  const [consent, setConsent] = useState({
    privacy: false,
    research: false,
    emailResult: false,
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
      email: form.email,
      password: form.password,
      passwordConfirm: form.passwordConfirm,
      birthYear: form.birthYear ? Number(form.birthYear) : undefined,
      gender: form.gender,
      consentPrivacy: consent.privacy,
      consentResearch: consent.research,
      consentEmailResult: consent.emailResult,
      consentMarketing: consent.marketing,
      documentVersion: "v1",
    });
    setLoading(false);

    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    router.push("/surveys");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-xl font-bold text-slate-900">회원가입</h1>
        <p className="mt-1 text-sm text-slate-500">응답자 계정을 생성합니다.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {error && <Alert variant="error">{error}</Alert>}

          <Field label="이메일" htmlFor="email" required>
            <Input id="email" type="email" autoComplete="email" value={form.email}
              onChange={(e) => update("email", e.target.value)} required />
          </Field>
          <Field label="비밀번호" htmlFor="password" hint="8자 이상, 영문·숫자 포함" required>
            <Input id="password" type="password" autoComplete="new-password" value={form.password}
              onChange={(e) => update("password", e.target.value)} required />
          </Field>
          <Field label="비밀번호 확인" htmlFor="passwordConfirm" required>
            <Input id="passwordConfirm" type="password" autoComplete="new-password"
              value={form.passwordConfirm}
              onChange={(e) => update("passwordConfirm", e.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="출생연도" htmlFor="birthYear">
              <Input id="birthYear" type="number" min={1900} max={CURRENT_YEAR}
                placeholder="예: 1998" value={form.birthYear}
                onChange={(e) => update("birthYear", e.target.value)} />
            </Field>
            <Field label="성별" htmlFor="gender">
              <Select id="gender" value={form.gender} onChange={(e) => update("gender", e.target.value)}>
                <option value="UNDISCLOSED">응답 안 함</option>
                <option value="MALE">남성</option>
                <option value="FEMALE">여성</option>
                <option value="OTHER">기타</option>
              </Select>
            </Field>
          </div>

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
              <input type="checkbox" className="mt-0.5" checked={consent.emailResult}
                onChange={(e) => setConsent((c) => ({ ...c, emailResult: e.target.checked }))} />
              <span>[선택] 이메일로 결과 수신에 동의합니다.</span>
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
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            로그인
          </Link>
        </p>
      </Card>
    </div>
  );
}
