"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Alert, Card, LinkButton } from "@/components/ui";

interface Stats {
  count: number;
  mean: number | null;
  variance: number | null;
  standardDeviation: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
}
interface Row { key: string; label: string; stats: Stats; code?: string; isReverse?: boolean }
interface FreeQuestionStat {
  questionId: string;
  code: string;
  content: string;
  type: "SINGLE" | "MULTIPLE" | "TEXT";
  responseCount: number;
  optionDistribution?: Array<{ label: string; value: number; count: number }>;
  textResponses?: string[];
}
interface Payload {
  survey: { title: string };
  statistics: {
    scaleStats: Row[];
    subfactorStats: Row[];
    questionStats: Array<Row & { code: string; isReverse: boolean }>;
    freeQuestionStats: FreeQuestionStat[];
  };
}

function fmt(v: number | null): string {
  return v === null ? "-" : v.toFixed(2);
}

function StatTable({ title, rows, showCode }: { title: string; rows: Row[]; showCode?: boolean }) {
  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">데이터가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-2 pr-4">{showCode ? "문항" : "항목"}</th>
                <th className="py-2 pr-4 text-right">N</th>
                <th className="py-2 pr-4 text-right">평균</th>
                <th className="py-2 pr-4 text-right">표준편차</th>
                <th className="py-2 pr-4 text-right">분산</th>
                <th className="py-2 pr-4 text-right">중앙값</th>
                <th className="py-2 pr-4 text-right">최소</th>
                <th className="py-2 text-right">최대</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-slate-100">
                  <td className="py-2 pr-4">
                    {showCode && <span className="mr-2 font-mono text-xs text-slate-400">{r.code}</span>}
                    {r.label}
                    {r.isReverse && <span className="ml-1 text-xs text-amber-600">(역)</span>}
                  </td>
                  <td className="py-2 pr-4 text-right">{r.stats.count}</td>
                  <td className="py-2 pr-4 text-right">{fmt(r.stats.mean)}</td>
                  <td className="py-2 pr-4 text-right">{fmt(r.stats.standardDeviation)}</td>
                  <td className="py-2 pr-4 text-right">{fmt(r.stats.variance)}</td>
                  <td className="py-2 pr-4 text-right">{fmt(r.stats.median)}</td>
                  <td className="py-2 pr-4 text-right">{fmt(r.stats.min)}</td>
                  <td className="py-2 text-right">{fmt(r.stats.max)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const TYPE_LABEL: Record<string, string> = {
  SINGLE: "단일 선택",
  MULTIPLE: "다중 선택",
  TEXT: "줄글",
};

function FreeQuestionCharts({ stats }: { stats: FreeQuestionStat[] }) {
  if (stats.length === 0) return null;
  return (
    <Card className="space-y-6 p-4">
      <h2 className="text-sm font-semibold text-slate-900">자유 문항 응답 분포</h2>
      {stats.map((q) => {
        const maxCount = Math.max(
          ...(q.optionDistribution?.map((o) => o.count) ?? [1]),
          1,
        );
        return (
          <div key={q.questionId} className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
            <p className="text-sm font-medium text-slate-800">
              <span className="mr-2 font-mono text-xs text-slate-400">{q.code}</span>
              {q.content}
              <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                {TYPE_LABEL[q.type]}
              </span>
              <span className="ml-1 text-xs text-slate-400">({q.responseCount}건)</span>
            </p>
            {q.type === "TEXT" && q.textResponses && (
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm text-slate-600">
                {q.textResponses.length === 0 ? (
                  <li className="text-slate-400">응답 없음</li>
                ) : (
                  q.textResponses.map((t, i) => (
                    <li key={i} className="rounded bg-slate-50 px-3 py-1.5">{t}</li>
                  ))
                )}
              </ul>
            )}
            {q.optionDistribution && (
              <div className="mt-3 space-y-2">
                {q.optionDistribution.map((o) => (
                  <div key={o.value} className="flex items-center gap-3 text-sm">
                    <span className="w-32 shrink-0 truncate text-slate-600">{o.label}</span>
                    <div className="flex-1">
                      <div className="h-6 overflow-hidden rounded bg-slate-100">
                        <div
                          className="h-full bg-brand-500 transition-all"
                          style={{ width: `${maxCount > 0 ? (o.count / maxCount) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-8 text-right text-slate-500">{o.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}

export function StatisticsView({ surveyId }: { surveyId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await api.get<Payload>(`/api/admin/surveys/${surveyId}/statistics`);
      if (res.ok) setData(res.data);
      else setError(res.error.message);
    })();
  }, [surveyId]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!data) return <p className="text-sm text-slate-500">불러오는 중...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">통계 · {data.survey.title}</h1>
        <LinkButton href={`/admin/surveys/${surveyId}`} variant="ghost" size="sm">
          ← 설문으로
        </LinkButton>
      </div>
      <Alert variant="info">완료 응답 기준 · 표본 표준편차/분산(ddof=1) · 응답자 1명이면 분산·표준편차는 계산 불가(-)</Alert>
      <StatTable title="척도별 통계 (총점)" rows={data.statistics.scaleStats} />
      <StatTable title="하위요인별 통계 (총점)" rows={data.statistics.subfactorStats} />
      <StatTable title="문항별 통계 (리커트 변환점수)" rows={data.statistics.questionStats} showCode />
      <FreeQuestionCharts stats={data.statistics.freeQuestionStats ?? []} />
    </div>
  );
}
