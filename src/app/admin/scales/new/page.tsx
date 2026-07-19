"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";

type ScaleType = "LIKERT" | "SINGLE" | "MULTIPLE" | "TEXT" | "MIXED";

const SCALE_TYPE_LABEL: Record<ScaleType, string> = {
  LIKERT: "리커트",
  SINGLE: "객관식 (단일 선택)",
  MULTIPLE: "다중선택",
  TEXT: "주관식 (줄글)",
  MIXED: "혼합",
};

const LIKERT_PLACEHOLDERS = ["전혀 아니다", "아니다", "보통이다", "그렇다", "매우 그렇다"];

function usesLikertRange(t: ScaleType) {
  return t === "LIKERT" || t === "MIXED";
}

export default function NewScalePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    description: "",
    sourceTitle: "",
    sourceAuthor: "",
    scaleType: "LIKERT" as ScaleType,
    minScore: "1",
    maxScore: "5",
  });
  const [likertLabels, setLikertLabels] = useState<string[]>(["", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const min = Number(form.minScore) || 1;
  const max = Number(form.maxScore) || 5;
  const pointCount = Math.max(0, max - min + 1);
  const showLikert = usesLikertRange(form.scaleType);

  const labelSlots = useMemo(() => {
    return Array.from({ length: pointCount }, (_, i) => ({
      value: min + i,
      label: likertLabels[i] ?? "",
    }));
  }, [pointCount, min, likertLabels]);

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setScaleType(scaleType: ScaleType) {
    setForm((f) => ({ ...f, scaleType }));
  }

  function setMinMax(key: "minScore" | "maxScore", value: string) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      const nextMin = Number(key === "minScore" ? value : f.minScore) || 1;
      const nextMax = Number(key === "maxScore" ? value : f.maxScore) || 5;
      const count = Math.max(0, nextMax - nextMin + 1);
      setLikertLabels((prev) => {
        const arr = [...prev];
        while (arr.length < count) arr.push("");
        return arr.slice(0, count);
      });
      return next;
    });
  }

  function updateLabel(idx: number, value: string) {
    setLikertLabels((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }

  async function onSubmitFixed(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (showLikert && min >= max) {
      setError("리커트 최댓값은 최솟값보다 커야 합니다.");
      return;
    }
    setLoading(true);
    const hasAnyLabel = labelSlots.some((s) => s.label.trim());
    const res = await api.post<{ scale: { id: string } }>("/api/admin/scales", {
      name: form.name,
      description: form.description || undefined,
      sourceTitle: form.sourceTitle || undefined,
      sourceAuthor: form.sourceAuthor || undefined,
      scaleType: form.scaleType,
      minScore: showLikert ? min : 1,
      maxScore: showLikert ? max : 5,
      likertLabels: showLikert && hasAnyLabel ? labelSlots.map((s) => s.label) : undefined,
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
        <form onSubmit={onSubmitFixed} className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}
          <Field label="척도명" htmlFor="name" required>
            <Input id="name" value={form.name} onChange={(e) => update("name", e.target.value)} required />
          </Field>
          <Field label="척도 유형" htmlFor="scaleType" required
            hint="문항 추가 시 기본 유형입니다. 문항별로 나중에 바꿀 수 있습니다.">
            <Select
              id="scaleType"
              value={form.scaleType}
              onChange={(e) => setScaleType(e.target.value as ScaleType)}
            >
              {(Object.keys(SCALE_TYPE_LABEL) as ScaleType[]).map((k) => (
                <option key={k} value={k}>{SCALE_TYPE_LABEL[k]}</option>
              ))}
            </Select>
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

          {showLikert && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-sm font-medium text-slate-800">리커트 점수 범위</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  설문 참여자에게 몇 점 척도로 보일지 정합니다. 예: 1~5점이면
                  &quot;전혀 아니다&quot; ~ &quot;매우 그렇다&quot;처럼 점수마다 라벨을 붙일 수 있습니다.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="리커트 최솟값" htmlFor="minScore" required>
                  <Input id="minScore" type="number" value={form.minScore}
                    onChange={(e) => setMinMax("minScore", e.target.value)} required />
                </Field>
                <Field label="리커트 최댓값" htmlFor="maxScore" required>
                  <Input id="maxScore" type="number" value={form.maxScore}
                    onChange={(e) => setMinMax("maxScore", e.target.value)} required />
                </Field>
              </div>
              {pointCount > 0 && pointCount <= 20 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-600">점수별 라벨 (참여자에게 보이는 문구)</p>
                  <div className="space-y-2">
                    {labelSlots.map((slot, idx) => (
                      <div key={slot.value} className="flex items-center gap-2">
                        <span className="w-10 shrink-0 text-center text-xs font-mono text-slate-400">
                          {slot.value}
                        </span>
                        <Input
                          placeholder={
                            LIKERT_PLACEHOLDERS[idx] ??
                            (idx === 0
                              ? "예: 전혀 아니다"
                              : idx === pointCount - 1
                                ? "예: 매우 그렇다"
                                : `점수 ${slot.value} 라벨`)
                          }
                          value={slot.label}
                          onChange={(e) => updateLabel(idx, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">
                    비워 두면 숫자({min}~{max})로 표시됩니다. 새로 추가하는 리커트 문항부터 적용됩니다.
                  </p>
                </div>
              )}
            </div>
          )}

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
