"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";

export default function NewScalePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    description: "",
    sourceTitle: "",
    sourceAuthor: "",
    minScore: "1",
    maxScore: "5",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await api.post<{ scale: { id: string } }>("/api/admin/scales", {
      name: form.name,
      description: form.description || undefined,
      sourceTitle: form.sourceTitle || undefined,
      sourceAuthor: form.sourceAuthor || undefined,
      minScore: Number(form.minScore),
      maxScore: Number(form.maxScore),
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    router.push(`/admin/scales/${res.data.scale.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-slate-900">새 척도</h1>
      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}
          <Field label="척도명" htmlFor="name" required>
            <Input id="name" value={form.name} onChange={(e) => update("name", e.target.value)} required />
          </Field>
          <Field label="설명" htmlFor="description">
            <Textarea id="description" rows={3} value={form.description}
              onChange={(e) => update("description", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="출처 제목" htmlFor="sourceTitle">
              <Input id="sourceTitle" value={form.sourceTitle}
                onChange={(e) => update("sourceTitle", e.target.value)} />
            </Field>
            <Field label="출처 저자" htmlFor="sourceAuthor">
              <Input id="sourceAuthor" value={form.sourceAuthor}
                onChange={(e) => update("sourceAuthor", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="응답 최솟값" htmlFor="minScore" required>
              <Input id="minScore" type="number" value={form.minScore}
                onChange={(e) => update("minScore", e.target.value)} required />
            </Field>
            <Field label="응답 최댓값" htmlFor="maxScore" required>
              <Input id="maxScore" type="number" value={form.maxScore}
                onChange={(e) => update("maxScore", e.target.value)} required />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "생성 중..." : "생성"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
