"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";

interface AvailableVersion {
  id: string;
  versionNumber: number;
  status: string;
  scale: { name: string };
  _count: { questions: number };
}

export default function NewSurveyPage() {
  const router = useRouter();
  const [versions, setVersions] = useState<AvailableVersion[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    instructions: "",
    requireLogin: true,
    allowDuplicate: false,
    showResult: true,
    targetResponseCount: "",
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await api.get<{ versions: AvailableVersion[] }>("/api/admin/scale-versions");
      if (res.ok) setVersions(res.data.versions);
    })();
  }, []);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selected.length === 0) {
      setError("최소 하나의 척도를 선택하세요.");
      return;
    }
    setLoading(true);
    const res = await api.post<{ survey: { id: string } }>("/api/admin/surveys", {
      title: form.title,
      description: form.description || undefined,
      instructions: form.instructions || undefined,
      requireLogin: form.requireLogin,
      allowDuplicate: form.allowDuplicate,
      showResult: form.showResult,
      targetResponseCount: form.targetResponseCount ? Number(form.targetResponseCount) : undefined,
      scales: selected.map((id, idx) => ({
        scaleVersionId: id,
        displayOrder: idx + 1,
        isRequired: true,
      })),
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    router.push(`/admin/surveys/${res.data.survey.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-slate-900">새 설문</h1>
      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}
          <Field label="설문 제목" htmlFor="title" required>
            <Input id="title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
          </Field>
          <Field label="설명" htmlFor="description">
            <Textarea id="description" rows={2} value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Field>
          <Field label="안내문" htmlFor="instructions">
            <Textarea id="instructions" rows={3} value={form.instructions}
              onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} />
          </Field>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">포함할 척도 (게시/잠금된 버전)</p>
            {versions.length === 0 ? (
              <Alert variant="warning">연결 가능한 게시된 척도 버전이 없습니다. 먼저 척도를 게시하세요.</Alert>
            ) : (
              <ul className="space-y-2">
                {versions.map((v, idx) => {
                  const order = selected.indexOf(v.id);
                  return (
                    <li key={v.id}>
                      <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                        <input type="checkbox" checked={order >= 0} onChange={() => toggle(v.id)} />
                        <span className="flex-1">
                          {v.scale.name} <span className="text-slate-400">v{v.versionNumber} · 문항 {v._count.questions}개</span>
                        </span>
                        {order >= 0 && (
                          <span className="rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700">순서 {order + 1}</span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="목표 응답 수" htmlFor="target">
              <Input id="target" type="number" value={form.targetResponseCount}
                onChange={(e) => setForm((f) => ({ ...f, targetResponseCount: e.target.value }))} />
            </Field>
          </div>

          <fieldset className="space-y-2 rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-xs font-medium text-slate-500">옵션</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!form.requireLogin}
                onChange={(e) => setForm((f) => ({ ...f, requireLogin: !e.target.checked }))} />
              비회원 응답 허용 (로그인 없이 참여 가능)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.requireLogin}
                onChange={(e) => setForm((f) => ({ ...f, requireLogin: e.target.checked }))} />
              회원 전용 (로그인 필수)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.allowDuplicate}
                onChange={(e) => setForm((f) => ({ ...f, allowDuplicate: e.target.checked }))} /> 중복 응답 허용
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.showResult}
                onChange={(e) => setForm((f) => ({ ...f, showResult: e.target.checked }))} /> 응답자에게 결과 공개
            </label>
          </fieldset>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => router.back()}>취소</Button>
            <Button type="submit" disabled={loading}>{loading ? "생성 중..." : "생성"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
