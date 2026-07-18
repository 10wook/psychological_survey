"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Alert, Button, Card, Textarea } from "@/components/ui";

type QuestionType = "LIKERT" | "SINGLE" | "MULTIPLE" | "TEXT";

interface QuestionDTO {
  id: string;
  code: string;
  content: string;
  type: QuestionType;
  isRequired: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  rawScore: number | null;
  textValue: string | null;
  selectedValues: number[];
  options: Array<{ value: number; label: string }>;
}
interface ScaleDTO {
  surveyScaleId: string | null;
  scaleVersionId: string | null;
  scaleName: string | null;
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

interface AnswerState {
  rawScore?: number | null;
  textValue?: string | null;
  selectedValues?: number[];
}

type SaveState = "idle" | "saving" | "saved" | "error";
type DirtyEntry = AnswerState;

function isAnswered(q: QuestionDTO, a: AnswerState | undefined): boolean {
  if (!a) return false;
  switch (q.type) {
    case "TEXT":
      return typeof a.textValue === "string" && a.textValue.trim().length > 0;
    case "MULTIPLE": {
      const n = a.selectedValues?.length ?? 0;
      if (n === 0) return false;
      if (q.minSelect != null && n < q.minSelect) return false;
      return true;
    }
    default:
      return a.rawScore !== null && a.rawScore !== undefined;
  }
}

function toPayload(questionId: string, a: AnswerState) {
  return {
    questionId,
    rawScore: a.rawScore ?? null,
    textValue: a.textValue ?? null,
    selectedValues: a.selectedValues ?? [],
  };
}

export function RespondForm({ responseId }: { responseId: string }) {
  const router = useRouter();
  const [data, setData] = useState<ResponseDTO | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [scaleIndex, setScaleIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [highlightUnanswered, setHighlightUnanswered] = useState(false);

  const dirtyRef = useRef<Map<string, DirtyEntry>>(new Map());
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
      const init: Record<string, AnswerState> = {};
      for (const s of res.data.response.scales) {
        for (const q of s.questions) {
          init[q.id] = {
            rawScore: q.rawScore,
            textValue: q.textValue,
            selectedValues: q.selectedValues ?? [],
          };
        }
      }
      setAnswers(init);
    })();
  }, [responseId, router]);

  const flush = useCallback(async () => {
    if (dirtyRef.current.size === 0) return;
    const entries = [...dirtyRef.current.entries()];
    const payload = entries.map(([questionId, val]) => toPayload(questionId, val));
    setSaveState("saving");
    const res = await api.put(`/api/responses/${responseId}/answers`, { answers: payload });
    if (res.ok) {
      for (const [qid, val] of entries) {
        const cur = dirtyRef.current.get(qid);
        if (cur && JSON.stringify(cur) === JSON.stringify(val)) dirtyRef.current.delete(qid);
      }
      setSaveState("saved");
    } else {
      setSaveState("error");
      setError(res.error.message);
    }
  }, [responseId]);

  function scheduleSave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(), 800);
  }

  function updateAnswer(questionId: string, patch: Partial<AnswerState>) {
    setAnswers((prev) => {
      const next = { ...prev[questionId], ...patch };
      dirtyRef.current.set(questionId, next);
      return { ...prev, [questionId]: next };
    });
    setSaveState("saving");
    scheduleSave();
    if (highlightUnanswered) setHighlightUnanswered(false);
  }

  useEffect(() => {
    const handler = () => {
      if (dirtyRef.current.size > 0) void flush();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [flush]);

  if (error && !data) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Alert variant="error">{error}</Alert>
      </div>
    );
  }
  if (!data) return <div className="mx-auto max-w-2xl p-6 text-sm text-slate-500">불러오는 중...</div>;

  const scale = data.scales[scaleIndex]!;
  const allQuestions = data.scales.flatMap((s) => s.questions);
  const totalQuestions = allQuestions.length;
  const answeredCount = allQuestions.filter((q) => isAnswered(q, answers[q.id])).length;
  const progress = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const isLastScale = scaleIndex === data.scales.length - 1;

  const scaleUnanswered = scale.questions.filter(
    (q) => q.isRequired && !isAnswered(q, answers[q.id]),
  );

  async function goNext() {
    await flush();
    if (scale.isRequired && scaleUnanswered.length > 0) {
      setError(`이 척도의 모든 필수 문항에 응답해야 다음으로 이동할 수 있습니다. (남은 ${scaleUnanswered.length}개)`);
      setHighlightUnanswered(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
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
    setSubmitting(true);
    setError(null);
    const fullPayload = Object.entries(answers).map(([questionId, val]) =>
      toPayload(questionId, val),
    );
    setSaveState("saving");
    const saveRes = await api.put(`/api/responses/${responseId}/answers`, { answers: fullPayload });
    if (!saveRes.ok) {
      setSaveState("error");
      setSubmitting(false);
      setError(`응답 저장에 실패했습니다. (${saveRes.error.message})`);
      return;
    }
    dirtyRef.current.clear();
    setSaveState("saved");

    const res = await api.post<{ showResult: boolean }>(`/api/responses/${responseId}/submit`);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error.message);
      const firstIncomplete = data!.scales.findIndex((s) =>
        s.isRequired && s.questions.some((q) => q.isRequired && !isAnswered(q, answers[q.id])),
      );
      if (firstIncomplete >= 0) setScaleIndex(firstIncomplete);
      setHighlightUnanswered(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
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
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-900">{scale.scaleName ?? "설문 문항"}</span>
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

        {scale.questions.map((q, idx) => {
          const a = answers[q.id] ?? {};
          const unanswered = q.isRequired && !isAnswered(q, a);
          const flag = highlightUnanswered && unanswered;
          return (
            <Card key={q.id} className={`p-4 ${flag ? "border-red-300 bg-red-50" : ""}`}>
              <p className="mb-3 text-sm font-medium text-slate-800">
                <span className="mr-2 text-slate-400">{idx + 1}.</span>
                {q.content}
                {q.isRequired && <span className="ml-1 text-red-500">*</span>}
                {flag && (
                  <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-600">
                    미응답
                  </span>
                )}
              </p>

              {q.type === "TEXT" && (
                <Textarea
                  rows={4}
                  placeholder="답변을 입력하세요"
                  value={a.textValue ?? ""}
                  onChange={(e) => updateAnswer(q.id, { textValue: e.target.value, rawScore: null, selectedValues: [] })}
                />
              )}

              {(q.type === "LIKERT" || q.type === "SINGLE") && (
                <div className="flex flex-col gap-2" role="radiogroup" aria-label={q.content}>
                  {q.options.map((o) => {
                    const checked = a.rawScore === o.value;
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
                          checked={checked}
                          onChange={() =>
                            updateAnswer(q.id, { rawScore: o.value, textValue: null, selectedValues: [] })
                          }
                        />
                        <span>{o.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {q.type === "MULTIPLE" && (
                <div className="flex flex-col gap-2">
                  {(q.minSelect != null || q.maxSelect != null) && (
                    <p className="text-xs text-slate-500">
                      {q.minSelect != null && q.maxSelect != null
                        ? `${q.minSelect}~${q.maxSelect}개 선택`
                        : q.minSelect != null
                          ? `최소 ${q.minSelect}개 선택`
                          : `최대 ${q.maxSelect}개 선택`}
                    </p>
                  )}
                  {q.options.map((o) => {
                    const selected = a.selectedValues ?? [];
                    const checked = selected.includes(o.value);
                    const atMax = q.maxSelect != null && !checked && selected.length >= q.maxSelect;
                    return (
                      <label
                        key={o.value}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                          checked ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:bg-slate-50"
                        } ${atMax ? "opacity-50" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={atMax}
                          onChange={() => {
                            const next = checked
                              ? selected.filter((v) => v !== o.value)
                              : [...selected, o.value];
                            updateAnswer(q.id, { selectedValues: next, rawScore: null, textValue: null });
                          }}
                        />
                        <span>{o.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}

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
