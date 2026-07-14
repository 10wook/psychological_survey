"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await api.post<{ role: string }>("/api/auth/login", { email, password });
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    // 역할 기반 이동: 관리자/연구자는 관리자 콘솔로 바로 이동
    const isStaff = res.data.role === "ADMIN" || res.data.role === "RESEARCHER";
    const target = nextParam ?? (isStaff ? "/admin" : "/surveys");
    router.push(target);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md p-8">
      <h1 className="text-xl font-bold text-slate-900">로그인</h1>
      <p className="mt-1 text-sm text-slate-500">이메일과 비밀번호로 로그인하세요.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <Field label="이메일" htmlFor="email" required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="비밀번호" htmlFor="password" required>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "로그인 중..." : "로그인"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        계정이 없으신가요?{" "}
        <Link href="/register" className="font-medium text-brand-600 hover:underline">
          회원가입
        </Link>
      </p>
    </Card>
  );
}
