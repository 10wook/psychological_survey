"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Alert, Card, LinkButton } from "@/components/ui";

interface ResultDTO {
  surveyTitle: string;
  completedAt: string | null;
  disclaimer: string;
  scales: Array<{
    scaleName: string;
    rawTotal: number;
    convertedTotal: number;
    averageScore: number;
    completedQuestionCount: number;
    interpretation: { label: string; description?: string } | null;
    comparison: { overallAverage: number } | null;
    subfactors: Array<{ name: string; totalScore: number; averageScore: number }>;
  }>;
}

export function ResultView({ responseId }: { responseId: string }) {
  const [result, setResult] = useState<ResultDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await api.get<{ result: ResultDTO }>(`/api/responses/${responseId}/result`);
      if (res.ok) setResult(res.data.result);
      else setError(res.error.message);
    })();
  }, [responseId]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!result) return <p className="text-sm text-slate-500">불러오는 중...</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{result.surveyTitle} 결과</h1>
        {result.completedAt && (
          <p className="text-xs text-slate-400">
            완료 {new Date(result.completedAt).toLocaleString("ko-KR")}
          </p>
        )}
      </div>

      {result.scales.map((s) => (
        <Card key={s.scaleName} className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">{s.scaleName}</h2>
            {s.interpretation && (
              <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
                {s.interpretation.label}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Stat label="총점" value={s.convertedTotal} />
            <Stat label="평균" value={s.averageScore} />
            <Stat label="응답 문항" value={s.completedQuestionCount} />
          </div>

          {s.interpretation?.description && (
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              {s.interpretation.description}
            </p>
          )}

          {s.comparison && (
            <p className="text-sm text-slate-500">
              전체 응답 평균 총점: {s.comparison.overallAverage}점
              {s.convertedTotal > s.comparison.overallAverage ? " (평균보다 높음)" : s.convertedTotal < s.comparison.overallAverage ? " (평균보다 낮음)" : " (평균과 비슷)"}
            </p>
          )}

          {s.subfactors.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">하위요인</p>
              <ul className="space-y-1">
                {s.subfactors.map((sf) => (
                  <li key={sf.name} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{sf.name}</span>
                    <span className="text-slate-500">총점 {sf.totalScore} · 평균 {sf.averageScore}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      ))}

      <Alert variant="warning">{result.disclaimer}</Alert>

      <LinkButton href="/surveys" variant="secondary">
        내 설문으로 이동
      </LinkButton>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
