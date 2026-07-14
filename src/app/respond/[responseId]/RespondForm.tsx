"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Alert, Button, Card } from "@/components/ui";

interface QuestionDTO {
  id: string;
  code: string;
  content: string;
  rawScore: number | null;
  options: Array<{ value: number; label: string }>;
}
interface ScaleDTO {
  surveyScaleId: string;
  scaleVersionId: string;
  scaleName: string;
  isRequired: boolean;
  questions: QuestionDTO[];
}
interface ResponseDTO {
  id: string;
  status: string;
  surveyTitle: string;
  instructions: string | null;
  showResult: boolean;
  scales: ScaleDTO[];
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function RespondForm({ responseId }: { responseId: string }) {
  const router = useRouter();
  const [data, setData] = useState<ResponseDTO | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [scaleIndex, setScaleIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [submitting, setSubmitting] = useState(false);

  const dirtyRef = useRef<Map<string, number | null>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await api.get<{ response: ResponseDTO }>(`/api/responses/${responseId}`);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      if (res.data.response.status === "COMPLETED") {
        router.replace(`/respond/${responseId}/complete`);
        return;
      }
      setData(res.data.response);
      const init: Record<string, number> = {};
      for (const s of res.data.response.scales) {
        for (const q of s.questions) {
          if (q.rawScore !== null) init[q.id] = q.rawScore;
        }
      }
      setAnswers(init);
    })();
  }, [responseId, router]);

  const flush = useCallback(async () => {
    if (dirtyRef.current.size === 0) return;
    const payload = [...dirtyRef.current.entries()].map(([questionId, rawScore]) => ({
      questionId,
      rawScore,
    }));
    dirtyRef.current.clear();
    setSaveState("saving");
    const res = await api.put(`/api/responses/${responseId}/answers`, { answers: payload });
    setSaveState(res.ok ? "saved" : "error");
    if (!res.ok) setError(res.error.message);
  }, [responseId]);

  // debounce 저장 (문서 6.10)
  function scheduleSave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(), 800);
  }

  function select(questionId: string, value: number) {
    setAnswers((a) => ({ ...a, [questionId]: value }));
    dirtyRef.current.set(questionId, value);
    setSaveState("saving");
    scheduleSave();
  }

  // 페이지 이탈 전 저장 시도
  useEffect(() => {
    const handler = () => {
      if (dirtyRef.current.size > 0) void flush();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [flush]);

  if (error && !data) return <div className="mx-auto max-w-2xl p-6"><Alert variant="error">{error}</Alert></div>;
  if (!data) return <div className="mx-auto max-w-2xl p-6 text-sm text-slate-500">불러오는 중...</div>;

  const scale = data.scales[scaleIndex]!;
  const totalQuestions = data.scales.reduce((n, s) => n + s.questions.length, 0);
  const answeredCount = data.scales.reduce(
    (n, s) => n + s.questions.filter((q) => answers[q.id] !== undefined).length,
    0,
  );
  const progress = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const isLastScale = scaleIndex === data.scales.length - 1;

  const scaleUnanswered = scale.questions.filter((q) => answers[q.id] === undefined);

  async function goNext() {
    await flush();
    if (scale.isRequired && scaleUnanswered.length > 0) {
      setError(`이 척도의 모든 문항에 응답해야 다음으로 이동할 수 있습니다. (남은 ${scaleUnanswered.length}개)`);
      return;
    }
    setError(null);
    setScaleIndex((i) => Math.min(i + 1, data!.scales.length - 1));
    window.scrollTo({ top: 0 });
  }

  function goPrev() {
    setError(null);
    setScaleIndex((i) => Math.max(i - 1, 0));
    window.scrollTo({ top: 0 });
  }

  async function submit() {
    await flush();
    setSubmitting(true);
    setError(null);
    const res = await api.post<{ showResult: boolean }>(`/api/responses/${responseId}/submit`);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    router.push(`/respond/${responseId}/complete`);
  }

  const saveLabel: Record<SaveState, string> = {
    idle: "",
    saving: "저장 중...",
    saved: "임시 저장됨",
    error: "저장 실패",
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 진행 헤더 */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-900">{scale.scaleName}</span>
            <span className="text-xs text-slate-400" aria-live="polite">
              {saveLabel[saveState]}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {scaleIndex + 1} / {data.scales.length} 척도 · {answeredCount}/{totalQuestions} 응답 ({progress}%)
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        {error && <Alert variant="error">{error}</Alert>}

        {scale.questions.map((q, idx) => (
          <Card key={q.id} className="p-4">
            <p className="mb-3 text-sm font-medium text-slate-800">
              <span className="mr-2 text-slate-400">{idx + 1}.</span>
              {q.content}
            </p>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label={q.content}>
              {q.options.map((o) => {
                const checked = answers[q.id] === o.value;
                return (
                  <label
                    key={o.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                      checked ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={o.value}
                      checked={checked}
                      onChange={() => select(q.id, o.value)}
                    />
                    <span>{o.label}</span>
                  </label>
                );
              })}
            </div>
          </Card>
        ))}

        <div className="flex items-center justify-between pt-2">
          <Button variant="secondary" onClick={goPrev} disabled={scaleIndex === 0}>
            이전
          </Button>
          {isLastScale ? (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "제출 중..." : "제출하기"}
            </Button>
          ) : (
            <Button onClick={goNext}>다음</Button>
          )}
        </div>
      </main>
    </div>
  );
}
